"""
TransactionService — Authoritative management of accepted commercial agreements.

Formed when a Collector accepts a Recycler's offer.
Tracks:
- Agreed price per kg
- Declared weight snapshot
- Provisional estimated amount
- Verified physical weight & final commercial settlement
- Custody / lifecycle status
"""

from __future__ import annotations

from uuid import uuid4

from app.core.auth import AuthenticatedUser
from app.core.errors import ApiError
from app.domain.lot_models import (
    LotRecord,
    OfferRecord,
    TransactionRecord,
    TransactionStatus,
)
from app.repositories.demo_store import (
    TRANSACTIONS,
    append_trace,
    get_transaction,
    get_transaction_by_lot,
    list_transactions_for_collector,
    list_transactions_for_recycler,
    now_iso,
    save_transaction,
)


class TransactionService:
    def create_transaction(
        self,
        lot: LotRecord,
        accepted_offer: OfferRecord,
        idempotency_key: str | None = None,
    ) -> TransactionRecord:
        """Create a commercial transaction record upon offer acceptance."""
        # Check if transaction already exists for this lot
        existing = get_transaction_by_lot(lot.id)
        if existing:
            return existing

        declared_weight = lot.item.estimatedWeightKg if lot.item else 0.0
        provisional = round(accepted_offer.pricePerKg * declared_weight, 2)
        now = now_iso()

        tx = TransactionRecord(
            id=f"tx-{uuid4().hex[:10]}",
            lotId=lot.id,
            collectorId=lot.collectorId,
            recyclerId=accepted_offer.recyclerId,
            recyclerName=accepted_offer.recyclerName,
            offerId=accepted_offer.id,
            agreedPricePerKg=accepted_offer.pricePerKg,
            declaredWeightSnapshot=declared_weight,
            provisionalEstimatedTotal=provisional,
            currency=accepted_offer.currency,
            status=TransactionStatus.CREATED,
            acceptedAt=now,
            isDemo=True,
            createdAt=now,
            updatedAt=now,
        )
        save_transaction(tx)

        msg = (f"Transaction {tx.id} created. Agreed price: ₹{tx.agreedPricePerKg:.2f}/kg. "
               f"Declared weight: {tx.declaredWeightSnapshot:.2f} kg. "
               f"Provisional total: ₹{tx.provisionalEstimatedTotal:.2f} (pending physical recycler scale weight).")
        append_trace(lot.id, lot.collectorId, "TRANSACTION_CREATED", lot.status, lot.status, msg, idempotency_key)
        return tx

    def get_by_id(self, tx_id: str, user: AuthenticatedUser) -> TransactionRecord:
        tx = get_transaction(tx_id)
        if not tx:
            raise ApiError(404, "NOT_FOUND", f"Transaction {tx_id} not found.")
        # Authorize: collector, recycler, or admin
        if user.role != "ADMIN" and user.id != tx.collectorId and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Not authorized to view this transaction.")
        return tx

    def get_by_lot(self, lot_id: str, user: AuthenticatedUser) -> TransactionRecord | None:
        tx = get_transaction_by_lot(lot_id)
        if not tx:
            return None
        if user.role != "ADMIN" and user.id != tx.collectorId and user.id != tx.recyclerId:
            raise ApiError(403, "FORBIDDEN", "Not authorized to view this transaction.")
        return tx

    def list_for_collector(self, collector_id: str) -> list[TransactionRecord]:
        return list_transactions_for_collector(collector_id)

    def list_for_recycler(self, recycler_id: str) -> list[TransactionRecord]:
        return list_transactions_for_recycler(recycler_id)
