"""
marketplace.py — Recycler Marketplace API.

Provides:
- GET /marketplace/lots: Filterable list of eligible LISTED lots.
- GET /marketplace/lots/{id}: Detailed lot review data for the Recycler portal.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user, require_role
from app.core.errors import ApiError
from app.domain.lot_models import (
    EvidenceMetadata,
    LotItem,
    LotRecord,
    LotStatus,
    PickupInfo,
    PricingResult,
    RecyclerMatch,
    VerificationResult,
)
from app.domain.roles import UserRole
from app.repositories.demo_store import (
    LOTS,
    assert_collector_owns,
    ensure_demo_pcb_lot,
    get_lot,
    get_matches,
    get_pricing_result,
    get_verification_result,
)
from app.services.matching_service import MatchingService
from app.services.pricing_service import PricingService
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


class MarketplaceLotSummary(BaseModel):
    id: str
    humanId: str
    title: str
    materialCategoryId: str | None = None
    condition: str | None = None
    estimatedWeightKg: float = 0.0
    cityArea: str | None = None
    pinCode: str | None = None
    pickupPreference: str | None = None
    evidenceCount: int = 0
    trustScore: int | None = None
    confidenceLevel: str | None = None
    fairLow: float | None = None
    fairMid: float | None = None
    fairHigh: float | None = None
    currency: str = "INR"
    status: LotStatus
    listedAt: str | None = None
    isDemo: bool = True
    matchScore: int | None = None


class MarketplaceLotReview(BaseModel):
    lot: LotRecord
    verification: VerificationResult | None = None
    pricing: PricingResult | None = None
    matchInfo: RecyclerMatch | None = None
    isDemo: bool = True


@router.get("/lots", response_model=list[MarketplaceLotSummary])
async def list_marketplace_lots(
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    material: str | None = Query(None, description="Filter by material category ID"),
    min_weight: float | None = Query(None, alias="minWeight"),
    max_weight: float | None = Query(None, alias="maxWeight"),
) -> list[MarketplaceLotSummary]:
    """
    Returns eligible lots visible to recyclers:
    Status must be LISTED or OFFERS_RECEIVED.
    """
    ensure_demo_pcb_lot()

    results: list[MarketplaceLotSummary] = []
    matching_svc = MatchingService()

    for lot in LOTS.values():
        if lot.status not in {LotStatus.LISTED, LotStatus.OFFERS_RECEIVED}:
            continue

        item = lot.item
        mat_id = item.materialCategoryId if item else None
        weight = item.estimatedWeightKg if item else 0.0

        if material and mat_id != material:
            continue
        if min_weight is not None and weight < min_weight:
            continue
        if max_weight is not None and weight > max_weight:
            continue

        # Get match score if available for this recycler
        match_score = None
        try:
            matches = matching_svc.find_matches(lot)
            for m in matches:
                if m.recyclerId == user.id or m.recyclerId in {"rec-001", "rec-005"}:
                    match_score = m.matchScore
                    break
        except Exception:
            pass

        results.append(
            MarketplaceLotSummary(
                id=lot.id,
                humanId=lot.humanId,
                title=lot.title,
                materialCategoryId=mat_id,
                condition=item.condition.value if item and hasattr(item.condition, "value") else (item.condition if item else None),
                estimatedWeightKg=weight,
                cityArea=lot.pickup.cityArea if lot.pickup else None,
                pinCode=lot.pickup.pinCode if lot.pickup else None,
                pickupPreference=lot.pickup.preference.value if lot.pickup and hasattr(lot.pickup.preference, "value") else (lot.pickup.preference if lot.pickup else None),
                evidenceCount=len(lot.evidence),
                trustScore=lot.trustScore,
                confidenceLevel=lot.confidenceLevel.value if lot.confidenceLevel and hasattr(lot.confidenceLevel, "value") else lot.confidenceLevel,
                fairLow=lot.fairLow,
                fairMid=lot.fairMid,
                fairHigh=lot.fairHigh,
                currency=lot.currency,
                status=lot.status,
                listedAt=lot.listedAt,
                isDemo=True,
                matchScore=match_score,
            )
        )

    # Sort: highest match score first, then newest
    return sorted(results, key=lambda x: (x.matchScore or 0), reverse=True)


@router.get("/lots/{lot_id}", response_model=MarketplaceLotReview)
async def get_marketplace_lot_review(
    lot_id: str,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
) -> MarketplaceLotReview:
    """Detailed inspection view of a listed lot for a recycler before making an offer."""
    ensure_demo_pcb_lot()
    lot = get_lot(lot_id)

    if lot.status not in {LotStatus.LISTED, LotStatus.OFFERS_RECEIVED, LotStatus.OFFER_ACCEPTED}:
        raise ApiError(404, "NOT_FOUND", f"Lot {lot_id} is not accessible in the marketplace.")

    verification = get_verification_result(lot.id)
    pricing = get_pricing_result(lot.id)

    # Compute or retrieve match info for this recycler
    match_info = None
    try:
        matches = MatchingService().find_matches(lot)
        for m in matches:
            if m.recyclerId == user.id or m.recyclerId in {"rec-001", "rec-005"}:
                match_info = m
                break
        if not match_info and matches:
            match_info = matches[0]
    except Exception:
        pass

    return MarketplaceLotReview(
        lot=lot,
        verification=verification,
        pricing=pricing,
        matchInfo=match_info,
        isDemo=True,
    )
