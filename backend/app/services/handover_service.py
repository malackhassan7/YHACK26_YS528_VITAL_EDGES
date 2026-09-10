"""
HandoverService — Manages logistics handover, secure QR verification, and physical weight settlement.

Key invariants:
- Secure random opaque QR tokens (never encodes sensitive data directly).
- Reliable manual token entry fallback for demo reliability.
- Role-based custody tracking (SCHEDULED → PICKED_UP → IN_TRANSIT → RECEIVED).
- Physical scale weight calculation: final_amount = agreed_price_per_kg * verified_weight_kg.
"""

from __future__ import annotations

import hashlib
import secrets
from uuid import uuid4

from app.core.auth import AuthenticatedUser
from app.core.errors import ApiError
from app.domain.lot_models import (
    HandoverRecord,
    LotRecord,
    LotStatus,
    TransactionRecord,
    TransactionStatus,
    WeightVerificationResult,
)
from app.domain.roles import UserRole
from app.repositories.demo_store import (
    get_handover,
    get_handover_by_token,
    get_lot,
    get_transaction,
    now_iso,
    save_handover,
)
from app.services.lot_transition import LotTransitionService


class HandoverService:
    def __init__(self) -> None:
        self._transition_service = LotTransitionService()

    def schedule_handover(
        self,
        tx_id: str,
        user: AuthenticatedUser,
        scheduled_at: str,
        pickup_address: str,
        pickup_window: str = "09:00 - 18:00",
        method: str = "RECYCLER_PICKUP",
        idempotency_key: str | None = None,
    ) -> HandoverRecord:
        tx = get_transaction(tx_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {tx_id} not found.")

        # Check authorization: collector, recycler, or admin
        if user.role != UserRole.ADMIN and user.id != tx.collectorId and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Not authorized to schedule handover for this transaction.")

        lot = get_lot(tx.lotId)
        if lot.status != LotStatus.OFFER_ACCEPTED:
            raise ApiError(409, "INVALID_STATE",
                           f"Handover can only be scheduled for OFFER_ACCEPTED lots (current: {lot.status}).")

        # Generate secure random opaque handover token
        opaque_token = f"ho_{secrets.token_urlsafe(12)}"
        token_hash = hashlib.sha256(opaque_token.encode()).hexdigest()

        handover = HandoverRecord(
            id=f"ho-{uuid4().hex[:8]}",
            transactionId=tx.id,
            lotId=lot.id,
            scheduledAt=scheduled_at,
            pickupAddress=pickup_address,
            pickupWindow=pickup_window,
            method=method,
            qrToken=opaque_token,
            qrTokenHash=token_hash,
            status="SCHEDULED",
            createdAt=now_iso(),
        )

        save_handover(handover)
        tx.status = TransactionStatus.HANDOVER_SCHEDULED
        tx.updatedAt = now_iso()

        self._transition_service.schedule_handover(
            lot=lot,
            user=user,
            scheduled_at=scheduled_at,
            pickup_address=pickup_address,
            idempotency_key=idempotency_key,
        )

        return handover

    def get_qr_credential(self, tx_id: str, user: AuthenticatedUser) -> dict:
        """Returns safe QR display data with manual code fallback."""
        tx = get_transaction(tx_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {tx_id} not found.")

        if user.role != UserRole.ADMIN and user.id != tx.collectorId and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Not authorized to view QR credential.")

        handover = get_handover(tx.id)
        if not handover:
            raise ApiError(404, "NOT_FOUND", "Handover has not been scheduled yet.")

        return {
            "transactionId": tx.id,
            "lotId": tx.lotId,
            "qrToken": handover.qrToken,
            "manualCode": handover.qrToken,
            "scheduledAt": handover.scheduledAt,
            "pickupAddress": handover.pickupAddress,
            "pickupWindow": handover.pickupWindow,
            "status": handover.status,
            "isDemo": True,
        }

    def confirm_pickup(
        self,
        token_or_code: str,
        user: AuthenticatedUser,
        location: str | None = None,
        idempotency_key: str | None = None,
    ) -> tuple[HandoverRecord, LotRecord]:
        """Recycler validates QR token or manual code and confirms pickup."""
        if user.role != UserRole.RECYCLER and user.role != UserRole.ADMIN:
            raise ApiError(403, "FORBIDDEN", "Only recyclers can confirm pickup.")

        handover = get_handover_by_token(token_or_code)
        if not handover:
            raise ApiError(404, "INVALID_TOKEN", "Handover token or manual code not recognized. Check the code and try again.")

        tx = get_transaction(handover.transactionId)
        if not tx:
            raise ApiError(404, "NOT_FOUND", "Associated transaction not found.")

        if user.role != UserRole.ADMIN and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Only the assigned recycler can confirm pickup for this lot.")

        lot = get_lot(tx.lotId)
        if lot.status != LotStatus.HANDOVER_SCHEDULED:
            raise ApiError(409, "INVALID_STATE",
                           f"Pickup requires HANDOVER_SCHEDULED status (current: {lot.status}).")

        now = now_iso()
        handover.pickupConfirmedAt = now
        handover.status = "PICKED_UP"

        tx.status = TransactionStatus.PICKED_UP
        tx.updatedAt = now

        self._transition_service.confirm_pickup(lot, user, idempotency_key=idempotency_key)
        return handover, lot

    def mark_in_transit(
        self,
        tx_id: str,
        user: AuthenticatedUser,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        """Mark lot as in transit to recycler facility."""
        tx = get_transaction(tx_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {tx_id} not found.")

        if user.role != UserRole.ADMIN and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Only the assigned recycler can update transit status.")

        lot = get_lot(tx.lotId)
        tx.status = TransactionStatus.IN_TRANSIT
        tx.updatedAt = now_iso()

        return self._transition_service.mark_in_transit(lot, user, idempotency_key=idempotency_key)

    def confirm_receipt(
        self,
        tx_id: str,
        user: AuthenticatedUser,
        facility_note: str | None = None,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        """Recycler confirms receipt of physical e-waste lot at facility."""
        tx = get_transaction(tx_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {tx_id} not found.")

        if user.role != UserRole.ADMIN and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Only the assigned recycler can confirm receipt.")

        lot = get_lot(tx.lotId)
        now = now_iso()

        handover = get_handover(tx.id)
        if handover:
            handover.receivedAt = now
            handover.status = "RECEIVED"

        tx.status = TransactionStatus.RECEIVED
        tx.updatedAt = now

        return self._transition_service.confirm_receipt(
            lot=lot,
            user=user,
            facility_note=facility_note,
            idempotency_key=idempotency_key,
        )

    def verify_physical_weight(
        self,
        tx_id: str,
        user: AuthenticatedUser,
        verified_weight_kg: float,
        variance_reason: str | None = None,
        idempotency_key: str | None = None,
    ) -> WeightVerificationResult:
        """
        Record certified scale weight at facility.
        Authoritative commercial settlement: final_amount = agreed_price_per_kg * verified_weight_kg.
        """
        tx = get_transaction(tx_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {tx_id} not found.")

        if user.role != UserRole.ADMIN and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Only the assigned recycler can verify physical weight.")

        lot = get_lot(tx.lotId)
        if lot.status != LotStatus.RECEIVED:
            raise ApiError(409, "INVALID_STATE",
                           f"Physical weight verification requires RECEIVED status (current: {lot.status}).")

        if verified_weight_kg <= 0:
            raise ApiError(400, "INVALID_WEIGHT", "Verified scale weight must be greater than zero.")

        declared = tx.declaredWeightSnapshot
        diff_kg = round(verified_weight_kg - declared, 2)
        diff_pct = round((diff_kg / declared * 100), 2) if declared else 0.0
        final_amount = round(tx.agreedPricePerKg * verified_weight_kg, 2)

        # Anomaly threshold: > 20% variance requires variance reason per docs/pricing-engine.md
        is_anomalous = abs(diff_pct) > 20.0

        tx.verifiedWeightKg = verified_weight_kg
        tx.finalAmount = final_amount
        tx.status = TransactionStatus.WEIGHT_VERIFIED
        tx.updatedAt = now_iso()

        self._transition_service.verify_weight(
            lot=lot,
            user=user,
            verified_weight_kg=verified_weight_kg,
            final_amount=final_amount,
            idempotency_key=idempotency_key,
        )

        return WeightVerificationResult(
            transactionId=tx.id,
            lotId=lot.id,
            declaredWeightKg=declared,
            verifiedWeightKg=verified_weight_kg,
            diffKg=diff_kg,
            diffPercent=diff_pct,
            agreedPricePerKg=tx.agreedPricePerKg,
            finalAmount=final_amount,
            currency=tx.currency,
            isAnomalous=is_anomalous,
            varianceReason=variance_reason,
        )
