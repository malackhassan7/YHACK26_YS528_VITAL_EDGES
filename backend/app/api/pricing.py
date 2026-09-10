"""
Pricing API routes.

POST /lots/{id}/price           — Calculate and store fair-value range (VERIFIED lot)
GET  /lots/{id}/price-explanation — Retrieve stored pricing result with full breakdown
GET  /reference-prices          — List all demo reference prices
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, require_role
from app.core.errors import ApiError
from app.domain.lot_models import PricingResult
from app.domain.roles import UserRole
from app.repositories import demo_store
from app.services.pricing_service import PricingService

router = APIRouter(tags=["pricing"])

Collector = Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR))]
AnyAuthed = Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR, UserRole.RECYCLER, UserRole.ADMIN))]


@router.post("/lots/{lot_id}/price", response_model=PricingResult)
def price_lot(lot_id: str, user: Collector) -> PricingResult:
    """
    Calculate the deterministic fair-value range for a VERIFIED lot.
    Stores the result and returns the full breakdown.
    Does NOT change lot status — listing is a separate explicit command.
    """
    lot = demo_store.get_lot_for_collector(lot_id, user)
    service = PricingService()
    result = service.calculate(lot)
    demo_store.store_pricing_result(result)
    return result


@router.get("/lots/{lot_id}/price-explanation", response_model=PricingResult)
def get_price_explanation(lot_id: str, user: Collector) -> PricingResult:
    """Return the stored pricing result with full adjustment breakdown."""
    demo_store.get_lot_for_collector(lot_id, user)  # ownership check
    result = demo_store.get_pricing_result(lot_id)
    if result is None:
        raise ApiError(404, "NOT_FOUND", "No pricing result found. Run POST /lots/{id}/price first.")
    return result


@router.get("/reference-prices")
def get_reference_prices(user: AnyAuthed) -> list[dict]:
    """Return all demo/reference price data. Clearly labeled as demo."""
    return PricingService().get_reference_prices()
