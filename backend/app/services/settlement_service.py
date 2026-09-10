"""
SettlementService — Authoritative management of Payments, Processing,
Recycling Evidence, and Lifecycle Closure for Sprint C.
"""

from __future__ import annotations

from uuid import uuid4

from app.core.auth import AuthenticatedUser
from app.core.errors import ApiError
from app.domain.lot_models import (
    CollectorEarningsSummary,
    LotRecord,
    LotStatus,
    MaterialRecoveryItem,
    PaymentRecord,
    ProcessingRecord,
    RecyclingEvidenceRecord,
    TransactionRecord,
    TransactionStatus,
)
from app.repositories.demo_store import (
    LOTS,
    PAYMENTS,
    PROCESSING_RECORDS,
    RECYCLING_EVIDENCE_RECORDS,
    TRACE_EVENTS,
    TRANSACTIONS,
    get_lot,
    get_transaction,
    get_transaction_by_lot,
    list_transactions_for_collector,
    now_iso,
    save_lot,
    save_transaction,
)
from app.services.lot_transition import LotTransitionService


class SettlementService:
    def __init__(self) -> None:
        self.transition_service = LotTransitionService()

    def confirm_demo_payment(
        self,
        transaction_id: str,
        user: AuthenticatedUser,
        idempotency_key: str | None = None,
    ) -> dict:
        tx = get_transaction(transaction_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {transaction_id} not found.")

        # Authorization: recycler associated with transaction or admin
        if user.role != "ADMIN" and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Only the assigned authorized recycler can confirm demo payment.")

        lot = get_lot(tx.lotId)
        if not lot:
            raise ApiError(404, "NOT_FOUND", f"Lot {tx.lotId} not found.")

        # Idempotency check: return existing payment if already confirmed
        existing_payment = next((p for p in PAYMENTS.values() if p.transactionId == tx.id), None)
        if existing_payment:
            return {
                "payment": existing_payment,
                "transaction": tx,
                "lot": lot,
                "message": "Demo payment already confirmed.",
            }

        if lot.status != LotStatus.WEIGHT_VERIFIED:
            raise ApiError(
                409,
                "INVALID_STATE",
                f"Lot must be in WEIGHT_VERIFIED state before payment confirmation (current: {lot.status}).",
            )

        final_amount = tx.finalAmount if tx.finalAmount is not None else round(tx.agreedPricePerKg * (tx.verifiedWeightKg or tx.declaredWeightSnapshot), 2)
        ref_id = f"UPI-DEMO-{uuid4().hex[:8].upper()}"
        now = now_iso()

        payment = PaymentRecord(
            id=f"pay-{uuid4().hex[:10]}",
            transactionId=tx.id,
            lotId=lot.id,
            collectorId=tx.collectorId,
            recyclerId=tx.recyclerId,
            amount=final_amount,
            currency=tx.currency,
            method="SIMULATED_DIRECT_PAYMENT",
            referenceId=ref_id,
            status="CONFIRMED",
            confirmedAt=now,
            isDemo=True,
        )
        PAYMENTS[payment.id] = payment

        # Update transaction state
        tx.status = TransactionStatus.PAYMENT_CONFIRMED
        tx.updatedAt = now
        save_transaction(tx)

        # Transition lot state & append trace event
        self.transition_service.confirm_demo_payment(lot, user, final_amount, ref_id, idempotency_key)
        save_lot(lot)

        return {
            "payment": payment,
            "transaction": tx,
            "lot": lot,
            "message": f"Demo payout of ₹{final_amount:.2f} confirmed successfully.",
        }

    def start_processing(
        self,
        transaction_id: str,
        user: AuthenticatedUser,
        facility_name: str,
        method: str,
        notes: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict:
        tx = get_transaction(transaction_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {transaction_id} not found.")

        if user.role != "ADMIN" and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Only the assigned recycler can start processing.")

        lot = get_lot(tx.lotId)
        if not lot:
            raise ApiError(404, "NOT_FOUND", f"Lot {tx.lotId} not found.")

        if lot.status != LotStatus.PAYMENT_CONFIRMED:
            raise ApiError(
                409,
                "INVALID_STATE",
                f"Payment must be confirmed before processing (current lot status: {lot.status}).",
            )

        existing_proc = next((pr for pr in PROCESSING_RECORDS.values() if pr.transactionId == tx.id), None)
        if existing_proc:
            return {"processing": existing_proc, "transaction": tx, "lot": lot, "message": "Processing already active."}

        now = now_iso()
        proc = ProcessingRecord(
            id=f"proc-{uuid4().hex[:10]}",
            lotId=lot.id,
            transactionId=tx.id,
            recyclerId=tx.recyclerId,
            facilityName=facility_name,
            method=method,
            startedAt=now,
            notes=notes,
        )
        PROCESSING_RECORDS[proc.id] = proc

        tx.status = TransactionStatus.PROCESSING
        tx.updatedAt = now
        save_transaction(tx)

        self.transition_service.start_processing(lot, user, facility_name, method, idempotency_key)
        save_lot(lot)

        return {
            "processing": proc,
            "transaction": tx,
            "lot": lot,
            "message": f"Recycling processing started at facility '{facility_name}'.",
        }

    def add_recycling_evidence(
        self,
        transaction_id: str,
        user: AuthenticatedUser,
        facility_name: str,
        recovery_breakdown: list[MaterialRecoveryItem],
        residual_percentage: float,
        certificate_number: str,
        document_url: str | None = None,
        notes: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict:
        tx = get_transaction(transaction_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {transaction_id} not found.")

        if user.role != "ADMIN" and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Only the assigned recycler can record recycling evidence.")

        lot = get_lot(tx.lotId)
        if not lot:
            raise ApiError(404, "NOT_FOUND", f"Lot {tx.lotId} not found.")

        if lot.status != LotStatus.PROCESSING:
            raise ApiError(
                409,
                "INVALID_STATE",
                f"Lot must be in PROCESSING state to record recycling evidence (current: {lot.status}).",
            )

        if not recovery_breakdown or len(recovery_breakdown) == 0:
            raise ApiError(400, "INVALID_BREAKDOWN", "At least one recovered material category breakdown is required.")

        if not certificate_number or not certificate_number.strip():
            raise ApiError(400, "INVALID_CERTIFICATE", "Official recycling/destruction certificate number is required.")

        now = now_iso()
        evidence = RecyclingEvidenceRecord(
            id=f"evid-{uuid4().hex[:10]}",
            lotId=lot.id,
            transactionId=tx.id,
            recyclerId=tx.recyclerId,
            facilityName=facility_name,
            recoveryBreakdown=recovery_breakdown,
            residualPercentage=residual_percentage,
            certificateNumber=certificate_number.strip(),
            documentUrl=document_url,
            notes=notes,
            createdAt=now,
            isDemo=True,
        )
        RECYCLING_EVIDENCE_RECORDS[evidence.id] = evidence

        tx.status = TransactionStatus.RECYCLING_EVIDENCE_ADDED
        tx.updatedAt = now
        save_transaction(tx)

        summary_parts = [f"{item.materialName}: {item.percentage:.1f}% ({item.recoveredWeightKg:.2f}kg)" for item in recovery_breakdown]
        summary_str = ", ".join(summary_parts)

        self.transition_service.add_recycling_evidence(lot, user, certificate_number, summary_str, idempotency_key)
        save_lot(lot)

        return {
            "evidence": evidence,
            "transaction": tx,
            "lot": lot,
            "message": f"Recycling evidence Certificate #{certificate_number} recorded successfully.",
        }

    def close_lot(
        self,
        transaction_id: str,
        user: AuthenticatedUser,
        idempotency_key: str | None = None,
    ) -> dict:
        tx = get_transaction(transaction_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {transaction_id} not found.")

        lot = get_lot(tx.lotId)
        if not lot:
            raise ApiError(404, "NOT_FOUND", f"Lot {tx.lotId} not found.")

        # Recycler, collector, or admin can trigger final closure once evidence is present
        if user.role != "ADMIN" and user.id != tx.recyclerId and user.id != tx.collectorId:
            raise ApiError(403, "FORBIDDEN", "Not authorized to close this lot.")

        if lot.status != LotStatus.RECYCLING_EVIDENCE_ADDED:
            raise ApiError(
                409,
                "INVALID_STATE",
                f"Lot must have RECYCLING_EVIDENCE_ADDED before closure (current: {lot.status}).",
            )

        now = now_iso()
        tx.status = TransactionStatus.CLOSED
        tx.updatedAt = now
        save_transaction(tx)

        self.transition_service.close_lot(lot, user, idempotency_key)
        save_lot(lot)

        return {
            "transaction": tx,
            "lot": lot,
            "message": "Material lot recycling lifecycle is now CLOSED and permanently archived.",
        }

    def get_collector_earnings(
        self,
        collector_id: str,
        user: AuthenticatedUser,
    ) -> CollectorEarningsSummary:
        if user.role != "ADMIN" and user.id != collector_id:
            raise ApiError(403, "FORBIDDEN", "Not authorized to view another collector's earnings.")

        all_tx = list_transactions_for_collector(collector_id)

        completed_statuses = {
            TransactionStatus.PAYMENT_CONFIRMED,
            TransactionStatus.PROCESSING,
            TransactionStatus.RECYCLING_EVIDENCE_ADDED,
            TransactionStatus.CLOSED,
        }

        total_earnings = 0.0
        completed_count = 0
        pending_count = 0
        pending_amount = 0.0

        for tx in all_tx:
            if tx.status in completed_statuses:
                amt = tx.finalAmount if tx.finalAmount is not None else tx.provisionalEstimatedTotal
                total_earnings += amt
                completed_count += 1
            elif tx.status != TransactionStatus.CANCELLED and tx.status != TransactionStatus.DISPUTED:
                amt = tx.finalAmount if tx.finalAmount is not None else tx.provisionalEstimatedTotal
                pending_amount += amt
                pending_count += 1

        return CollectorEarningsSummary(
            collectorId=collector_id,
            totalEarnings=round(total_earnings, 2),
            completedPayoutsCount=completed_count,
            pendingPayoutsCount=pending_count,
            pendingAmount=round(pending_amount, 2),
            transactions=all_tx,
            currency="INR",
        )

    def get_recycling_evidence(self, transaction_id: str, user: AuthenticatedUser) -> RecyclingEvidenceRecord | None:
        tx = get_transaction(transaction_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {transaction_id} not found.")
        if user.role != "ADMIN" and user.id != tx.collectorId and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Not authorized to view this evidence.")

        return next((ev for ev in RECYCLING_EVIDENCE_RECORDS.values() if ev.transactionId == tx.id), None)
