"""
OfferService — Authoritative management of Recycler offers and fairness validation.

Features:
- Validates recycler role and lot status (LISTED or OFFERS_RECEIVED).
- Compares offer against PricingService fair-value reference for anomaly classification.
- Enforces single pending offer per recycler per lot.
- Transactional offer acceptance with competing offer rejection.
- Integration with LotTransitionService and TransactionService.
"""

from __future__ import annotations

from uuid import uuid4

from app.core.auth import AuthenticatedUser
from app.core.errors import ApiError
from app.domain.lot_models import (
    LotRecord,
    LotStatus,
    OfferAnomalyLevel,
    OfferRecord,
    OfferStatus,
    TransactionRecord,
)
from app.domain.roles import UserRole
from app.repositories.demo_store import (
    append_trace,
    get_lot,
    get_offer,
    list_offers_for_lot,
    list_offers_for_recycler,
    now_iso,
    save_offer,
)
from app.services.lot_transition import LotTransitionService
from app.services.pricing_service import calculate_offer_anomaly
from app.services.transaction_service import TransactionService

# Recycler capability lookup: material_id -> allowed recycler IDs
_RECYCLER_NAMES: dict[str, str] = {
    "recycler-profile": "GreenLoop Recycler",
    "rec-001": "GreenCycle Recycling",
    "rec-002": "EcoSafe Processors",
    "rec-003": "HazMat Specialists",
    "rec-004": "CircuitLoop India",
    "rec-005": "AllElec Recyclers Pvt Ltd",
    "rec-scrap-traders": "EcoScrap Traders",
}


class OfferService:
    def __init__(self) -> None:
        self._transition_service = LotTransitionService()
        self._transaction_service = TransactionService()

    def create_offer(
        self,
        lot_id: str,
        user: AuthenticatedUser,
        price_per_kg: float,
        pickup_option: str = "RECYCLER_PICKUP",
        note: str | None = None,
        idempotency_key: str | None = None,
    ) -> OfferRecord:
        """Recycler submits an offer on a LISTED or OFFERS_RECEIVED lot."""
        if user.role != UserRole.RECYCLER:
            raise ApiError(403, "FORBIDDEN", "Only recyclers can submit commercial offers.")

        lot = get_lot(lot_id)
        if lot.status not in {LotStatus.LISTED, LotStatus.OFFERS_RECEIVED}:
            raise ApiError(409, "INVALID_LOT_STATE",
                           f"Cannot offer on lot in status '{lot.status}'. Lot must be LISTED or OFFERS_RECEIVED.")

        if price_per_kg <= 0:
            raise ApiError(400, "INVALID_PRICE", "Price per kg must be greater than zero.")

        # Check for active existing offer by this recycler on this lot
        existing = [
            o for o in list_offers_for_lot(lot_id)
            if o.recyclerId == user.id and o.status == OfferStatus.PENDING
        ]
        if existing:
            raise ApiError(409, "DUPLICATE_OFFER",
                           "You already have an active pending offer on this lot. Withdraw it before submitting a new one.")

        weight = lot.item.estimatedWeightKg if lot.item else 1.0
        total = round(price_per_kg * weight, 2)

        # Fairness anomaly analysis
        fair_mid = lot.fairMid if lot.fairMid else (price_per_kg * weight)
        anomaly = calculate_offer_anomaly(fair_mid=fair_mid, offer_amount=total)

        recycler_name = _RECYCLER_NAMES.get(user.id, user.displayName or "Authorized Recycler")

        offer = OfferRecord(
            id=f"offer-{uuid4().hex[:8]}",
            lotId=lot.id,
            recyclerId=user.id,
            recyclerName=recycler_name,
            pricePerKg=round(price_per_kg, 2),
            estimatedTotal=total,
            currency=lot.currency,
            pickupOption=pickup_option,
            note=note,
            status=OfferStatus.PENDING,
            anomalyLevel=anomaly.anomalyLevel,
            anomalyMessage=anomaly.message,
            deviationPercent=anomaly.deviationPercent,
            createdAt=now_iso(),
            isDemo=True,
        )

        # Transition lot status to OFFERS_RECEIVED
        self._transition_service.record_offer(
            lot=lot,
            user=user,
            offer_id=offer.id,
            recycler_name=recycler_name,
            price_per_kg=price_per_kg,
            idempotency_key=idempotency_key,
        )

        save_offer(offer)
        return offer

    def get_offers_for_lot(self, lot_id: str, user: AuthenticatedUser) -> list[OfferRecord]:
        """Collector views all offers submitted for their lot."""
        lot = get_lot(lot_id)
        if user.role != UserRole.ADMIN and lot.collectorId != user.id:
            raise ApiError(403, "FORBIDDEN", "Only the lot owner or admin can view received offers.")

        return list_offers_for_lot(lot_id)

    def accept_offer(
        self,
        offer_id: str,
        user: AuthenticatedUser,
        idempotency_key: str | None = None,
    ) -> tuple[TransactionRecord, LotRecord]:
        """Collector accepts one commercial offer. Rejects other pending offers."""
        offer = get_offer(offer_id)
        if not offer:
            raise ApiError(404, "NOT_FOUND", f"Offer {offer_id} not found.")

        lot = get_lot(offer.lotId)
        if lot.collectorId != user.id:
            raise ApiError(403, "FORBIDDEN", "Only the lot owner can accept an offer.")

        if offer.status != OfferStatus.PENDING:
            raise ApiError(409, "OFFER_NOT_PENDING",
                           f"Cannot accept offer with status '{offer.status}'.")

        if lot.status != LotStatus.OFFERS_RECEIVED:
            raise ApiError(409, "INVALID_LOT_STATE",
                           f"Cannot accept offer on lot in status '{lot.status}'.")

        # Mark accepted offer
        offer.status = OfferStatus.ACCEPTED

        # Reject all competing active offers for this lot
        for competing in list_offers_for_lot(lot.id):
            if competing.id != offer.id and competing.status == OfferStatus.PENDING:
                competing.status = OfferStatus.REJECTED

        # Transition lot to OFFER_ACCEPTED
        self._transition_service.accept_offer(
            lot=lot,
            user=user,
            offer_id=offer.id,
            recycler_name=offer.recyclerName,
            price_per_kg=offer.pricePerKg,
            idempotency_key=idempotency_key,
        )

        # Form the commercial transaction
        tx = self._transaction_service.create_transaction(
            lot=lot,
            accepted_offer=offer,
            idempotency_key=idempotency_key,
        )

        return tx, lot

    def withdraw_offer(self, offer_id: str, user: AuthenticatedUser) -> OfferRecord:
        """Recycler withdraws their pending offer."""
        offer = get_offer(offer_id)
        if not offer:
            raise ApiError(404, "NOT_FOUND", f"Offer {offer_id} not found.")

        if user.role != UserRole.ADMIN and offer.recyclerId != user.id:
            raise ApiError(403, "FORBIDDEN", "Only the offering recycler can withdraw this offer.")

        if offer.status != OfferStatus.PENDING:
            raise ApiError(409, "CANNOT_WITHDRAW",
                           f"Cannot withdraw offer in status '{offer.status}'. Only PENDING offers may be withdrawn.")

        offer.status = OfferStatus.WITHDRAWN
        append_trace(offer.lotId, user.id, "OFFER_WITHDRAWN", None, None,
                     f"Offer from {offer.recyclerName} was withdrawn by the recycler.")
        return offer

    def list_for_recycler(self, recycler_id: str) -> list[OfferRecord]:
        return list_offers_for_recycler(recycler_id)
