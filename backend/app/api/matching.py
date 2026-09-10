"""
Matching API routes.

GET  /lots/{id}/matches  — Get ranked recycler matches for VERIFIED/LISTED lot
POST /lots/{id}/list     — Transition VERIFIED → LISTED (requires pricing stored)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.core.auth import AuthenticatedUser, require_role
from app.core.errors import ApiError
from app.domain.lot_models import LotRecord, RecyclerMatch
from app.domain.roles import UserRole
from app.repositories import demo_store
from app.services.lot_transition import LotTransitionService
from app.services.matching_service import MatchingService

router = APIRouter(tags=["matching"])

Collector = Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR))]
Idempotency = Annotated[str | None, Header(alias="Idempotency-Key")]


@router.get("/lots/{lot_id}/matches", response_model=list[RecyclerMatch])
def get_matches(lot_id: str, user: Collector) -> list[RecyclerMatch]:
    """
    Return ranked compatible recycler matches for a VERIFIED or LISTED lot.
    Re-runs matching if not yet cached; uses cached result if available.
    All recycler data is labeled isDemo=True.
    """
    lot = demo_store.get_lot_for_collector(lot_id, user)
    from app.domain.lot_status import LotStatus
    if lot.status not in {LotStatus.VERIFIED, LotStatus.LISTED, LotStatus.OFFERS_RECEIVED, LotStatus.FLAGGED}:
        raise ApiError(409, "INVALID_LOT_STATE",
                       f"Matches require VERIFIED or LISTED lot (current: {lot.status}).")

    cached = demo_store.get_matches(lot_id)
    if cached is not None:
        return cached

    service = MatchingService()
    matches = service.match(lot)
    demo_store.store_matches(lot_id, matches)
    return matches


@router.post("/lots/{lot_id}/list", response_model=LotRecord)
def list_lot(lot_id: str, user: Collector, idempotency_key: Idempotency = None) -> LotRecord:
    """
    Transition VERIFIED → LISTED.
    Requires POST /lots/{id}/price to have been called first.
    Computes and stores recycler matches.
    Returns the updated lot record.
    """
    lot = demo_store.get_lot_for_collector(lot_id, user)

    pricing = demo_store.get_pricing_result(lot_id)
    if pricing is None:
        raise ApiError(409, "PRICING_REQUIRED",
                       "Calculate fair value first (POST /lots/{id}/price) before listing.")

    transition = LotTransitionService()
    lot = transition.list_lot(lot, user, pricing, idempotency_key)

    # Compute and cache matches at listing time
    service = MatchingService()
    matches = service.match(lot)
    demo_store.store_matches(lot_id, matches)

    return lot
