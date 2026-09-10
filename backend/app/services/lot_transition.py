"""
LotTransitionService — single authoritative gateway for all lot lifecycle changes.

All lifecycle changes MUST go through this service.
UI components and routes must never directly set lot.status.
Every transition appends a trace event in the same logical operation.
"""

from app.core.auth import AuthenticatedUser
from app.core.errors import ApiError
from app.domain.lot_models import ConfidenceLevel, LotRecord, PricingResult, VerificationResult
from app.domain.lot_status import LotStatus
from app.repositories.demo_store import append_trace


class LotTransitionService:
    # ── Phase 2: DRAFT → CAPTURED ─────────────────────────────────────────────

    def capture(self, lot: LotRecord, user: AuthenticatedUser, idempotency_key: str | None = None) -> LotRecord:
        if lot.collectorId != user.id:
            raise ApiError(status_code=403, code="FORBIDDEN", message="Collector cannot capture another collector's lot.")
        if lot.status != LotStatus.DRAFT:
            raise ApiError(status_code=409, code="INVALID_TRANSITION", message="Only DRAFT lots can move to CAPTURED in Phase 2.")
        if lot.item is None:
            raise ApiError(status_code=400, code="INCOMPLETE_LOT", message="Select material, condition, quantity, and weight before capture.")
        if lot.pickup is None:
            raise ApiError(status_code=400, code="INCOMPLETE_LOT", message="Pickup area and preference are required before capture.")
        if len(lot.evidence) < 1:
            raise ApiError(status_code=400, code="INCOMPLETE_LOT", message="Add at least one evidence photo before capture.")
        previous = lot.status
        lot.status = LotStatus.CAPTURED
        append_trace(lot.id, user.id, "LOT_CAPTURED", previous, LotStatus.CAPTURED, "Evidence captured. Verification is the next step.", idempotency_key)
        return lot

    # ── Sprint A: CAPTURED → VERIFYING ────────────────────────────────────────

    def start_verification(self, lot: LotRecord, user: AuthenticatedUser, idempotency_key: str | None = None) -> LotRecord:
        """Transition CAPTURED → VERIFYING. Begins evidence analysis."""
        if lot.collectorId != user.id:
            raise ApiError(403, "FORBIDDEN", "Collector cannot verify another collector's lot.")
        if lot.status != LotStatus.CAPTURED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only CAPTURED lots can move to VERIFYING (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.VERIFYING
        append_trace(lot.id, user.id, "VERIFICATION_STARTED", previous, LotStatus.VERIFYING,
                     "Evidence verification pipeline has started.", idempotency_key)
        return lot

    # ── Sprint A: VERIFYING → VERIFIED / REJECTED / FLAGGED ──────────────────

    def complete_verification(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        result: VerificationResult,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        """
        Transition VERIFYING → VERIFIED, REJECTED, or FLAGGED based on trust score.
        HIGH (≥75) or MEDIUM (≥50) → VERIFIED.
        LOW (<50) without manual override → FLAGGED for admin/collector review.
        """
        if lot.status != LotStatus.VERIFYING:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Lot must be VERIFYING to complete verification (current: {lot.status}).")

        previous = lot.status
        lot.trustScore = result.trustScore
        lot.confidenceLevel = result.confidenceLevel

        if result.confidenceLevel in {ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM}:
            lot.status = LotStatus.VERIFIED
            message = (f"Verification complete. Trust score: {result.trustScore}/100 "
                       f"({result.confidenceLevel} confidence). Lot is verified and ready for pricing.")
            append_trace(lot.id, user.id, "LOT_VERIFIED", previous, LotStatus.VERIFIED, message, idempotency_key)
        else:
            # LOW confidence → FLAGGED for review rather than auto-REJECTED
            lot.status = LotStatus.FLAGGED
            message = (f"Verification completed with LOW confidence ({result.trustScore}/100). "
                       "Lot flagged for collector review. Confirm category or add more evidence.")
            append_trace(lot.id, user.id, "LOT_FLAGGED", previous, LotStatus.FLAGGED, message, idempotency_key)

        return lot

    def manual_category_confirm(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        confirmed_category_id: str,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        """
        Collector manually confirms category when AI classification is unavailable.
        Valid from VERIFYING or FLAGGED. Updates item and re-emits verification trace.
        """
        if lot.collectorId != user.id:
            raise ApiError(403, "FORBIDDEN", "Only the collector can confirm their lot's category.")
        if lot.status not in {LotStatus.VERIFYING, LotStatus.FLAGGED, LotStatus.VERIFIED}:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Category confirmation not available in state {lot.status}.")
        if lot.item is None:
            raise ApiError(400, "INCOMPLETE_LOT", "No item attached to update category.")
        lot.item.materialCategoryId = confirmed_category_id
        append_trace(lot.id, user.id, "CATEGORY_CONFIRMED_MANUALLY", lot.status, lot.status,
                     f"Collector confirmed material category: {confirmed_category_id}.", idempotency_key)
        return lot

    # ── Sprint A: VERIFIED → LISTED ───────────────────────────────────────────

    def list_lot(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        pricing: PricingResult,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        """
        Transition VERIFIED → LISTED. Requires price calculation to have run.
        Stores fair-value range on the lot record.
        """
        if lot.collectorId != user.id:
            raise ApiError(403, "FORBIDDEN", "Only the collector can list their lot.")
        if lot.status not in {LotStatus.VERIFIED, LotStatus.FLAGGED}:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only VERIFIED lots can be listed (current: {lot.status}).")

        from datetime import UTC, datetime
        now = datetime.now(UTC).isoformat()

        lot.status = LotStatus.LISTED
        lot.fairLow = pricing.lotValueLow
        lot.fairMid = pricing.lotValueMid
        lot.fairHigh = pricing.lotValueHigh
        lot.currency = pricing.currency
        lot.listedAt = now

        message = (f"Lot listed for recycler offers. "
                   f"Fair value range: ₹{pricing.lotValueLow:.0f}–₹{pricing.lotValueHigh:.0f}. "
                   f"Trust score: {lot.trustScore}/100.")
        append_trace(lot.id, user.id, "LOT_LISTED", LotStatus.VERIFIED, LotStatus.LISTED, message, idempotency_key)
        return lot

    # ── Sprint B: LISTED → OFFERS_RECEIVED ────────────────────────────────────

    def record_offer(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        offer_id: str,
        recycler_name: str,
        price_per_kg: float,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status not in {LotStatus.LISTED, LotStatus.OFFERS_RECEIVED}:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Offers can only be submitted on LISTED or OFFERS_RECEIVED lots (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.OFFERS_RECEIVED
        msg = f"Offer received from {recycler_name} at ₹{price_per_kg:.2f}/kg."
        append_trace(lot.id, user.id, "OFFER_RECEIVED", previous, LotStatus.OFFERS_RECEIVED, msg, idempotency_key)
        return lot

    # ── Sprint B: OFFERS_RECEIVED → OFFER_ACCEPTED ────────────────────────────

    def accept_offer(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        offer_id: str,
        recycler_name: str,
        price_per_kg: float,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.collectorId != user.id:
            raise ApiError(403, "FORBIDDEN", "Only the lot owner can accept an offer.")
        if lot.status != LotStatus.OFFERS_RECEIVED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only lots with OFFERS_RECEIVED can accept an offer (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.OFFER_ACCEPTED
        msg = f"Offer accepted from {recycler_name} at ₹{price_per_kg:.2f}/kg. Commercial transaction created."
        append_trace(lot.id, user.id, "OFFER_ACCEPTED", previous, LotStatus.OFFER_ACCEPTED, msg, idempotency_key)
        return lot

    # ── Sprint B: OFFER_ACCEPTED → HANDOVER_SCHEDULED ─────────────────────────

    def schedule_handover(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        scheduled_at: str,
        pickup_address: str,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.OFFER_ACCEPTED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only OFFER_ACCEPTED lots can schedule handover (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.HANDOVER_SCHEDULED
        msg = f"Handover scheduled for {scheduled_at} at {pickup_address}. QR credential generated."
        append_trace(lot.id, user.id, "HANDOVER_SCHEDULED", previous, LotStatus.HANDOVER_SCHEDULED, msg, idempotency_key)
        return lot

    # ── Sprint B: HANDOVER_SCHEDULED → PICKED_UP ──────────────────────────────

    def confirm_pickup(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.HANDOVER_SCHEDULED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only HANDOVER_SCHEDULED lots can be picked up (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.PICKED_UP
        msg = "QR handover validated. Custody transferred to recycler."
        append_trace(lot.id, user.id, "LOT_PICKED_UP", previous, LotStatus.PICKED_UP, msg, idempotency_key)
        return lot

    # ── Sprint B: PICKED_UP → IN_TRANSIT ──────────────────────────────────────

    def mark_in_transit(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.PICKED_UP:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only PICKED_UP lots can move to IN_TRANSIT (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.IN_TRANSIT
        msg = "E-waste lot is in transit to the recycling facility."
        append_trace(lot.id, user.id, "LOT_IN_TRANSIT", previous, LotStatus.IN_TRANSIT, msg, idempotency_key)
        return lot

    # ── Sprint B: IN_TRANSIT → RECEIVED ───────────────────────────────────────

    def confirm_receipt(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        facility_note: str | None = None,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status not in {LotStatus.IN_TRANSIT, LotStatus.PICKED_UP}:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only lots in transit or picked up can be received (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.RECEIVED
        msg = f"Lot received at facility. {facility_note or ''}".strip()
        append_trace(lot.id, user.id, "LOT_RECEIVED", previous, LotStatus.RECEIVED, msg, idempotency_key)
        return lot

    # ── Sprint B: RECEIVED → WEIGHT_VERIFIED ──────────────────────────────────

    def verify_weight(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        verified_weight_kg: float,
        final_amount: float,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.RECEIVED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only RECEIVED lots can verify weight (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.WEIGHT_VERIFIED
        lot.verifiedWeightKg = verified_weight_kg
        lot.finalAmount = final_amount

        declared = lot.item.estimatedWeightKg if lot.item else 0.0
        diff = verified_weight_kg - declared
        diff_pct = (diff / declared * 100) if declared else 0.0
        msg = (f"Physical scale weight verified: {verified_weight_kg:.2f} kg "
               f"(declared: {declared:.2f} kg, {diff_pct:+.1f}%). "
               f"Final commercial amount: ₹{final_amount:.2f}.")
        append_trace(lot.id, user.id, "WEIGHT_VERIFIED", previous, LotStatus.WEIGHT_VERIFIED, msg, idempotency_key)
        return lot

    # ── Sprint C: WEIGHT_VERIFIED → PAYMENT_CONFIRMED ─────────────────────────

    def confirm_demo_payment(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        amount: float,
        reference_id: str,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.WEIGHT_VERIFIED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only WEIGHT_VERIFIED lots can confirm payment (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.PAYMENT_CONFIRMED
        msg = f"Simulated demo payout of ₹{amount:.2f} confirmed (Ref: {reference_id})."
        append_trace(lot.id, user.id, "DEMO_PAYMENT_CONFIRMED", previous, LotStatus.PAYMENT_CONFIRMED, msg, idempotency_key)
        return lot

    # ── Sprint C: PAYMENT_CONFIRMED → PROCESSING ──────────────────────────────

    def start_processing(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        facility_name: str,
        method: str,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.PAYMENT_CONFIRMED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only PAYMENT_CONFIRMED lots can start processing (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.PROCESSING
        msg = f"Recycling processing started at facility '{facility_name}' using method '{method}'."
        append_trace(lot.id, user.id, "PROCESSING_STARTED", previous, LotStatus.PROCESSING, msg, idempotency_key)
        return lot

    # ── Sprint C: PROCESSING → RECYCLING_EVIDENCE_ADDED ───────────────────────

    def add_recycling_evidence(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        certificate_number: str,
        recovery_summary: str,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.PROCESSING:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only PROCESSING lots can add recycling evidence (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.RECYCLING_EVIDENCE_ADDED
        msg = f"Recycling certificate {certificate_number} added. Material recovery: {recovery_summary}."
        append_trace(lot.id, user.id, "RECYCLING_EVIDENCE_ADDED", previous, LotStatus.RECYCLING_EVIDENCE_ADDED, msg, idempotency_key)
        return lot

    # ── Sprint C: RECYCLING_EVIDENCE_ADDED → CLOSED ───────────────────────────

    def close_lot(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        idempotency_key: str | None = None,
    ) -> LotRecord:
        if lot.status != LotStatus.RECYCLING_EVIDENCE_ADDED:
            raise ApiError(409, "INVALID_TRANSITION",
                           f"Only lots with RECYCLING_EVIDENCE_ADDED can be closed (current: {lot.status}).")
        previous = lot.status
        lot.status = LotStatus.CLOSED
        msg = "Formal recycling completed. Material traceability lifecycle is now CLOSED and immutable."
        append_trace(lot.id, user.id, "LOT_CLOSED", previous, LotStatus.CLOSED, msg, idempotency_key)
        return lot