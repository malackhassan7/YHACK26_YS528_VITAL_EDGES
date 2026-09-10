"""
offers.py — Recycler Offers and Acceptance API.

Endpoints:
- POST /lots/{id}/offers: Recycler submits offer with price per kg.
- GET  /lots/{id}/offers: Collector views received offers with fairness analysis.
- POST /offers/{id}/accept: Collector accepts offer → transitions to OFFER_ACCEPTED & creates Transaction.
- POST /offers/{id}/withdraw: Recycler withdraws pending offer.
- GET  /recycler/offers: Recycler views own submitted offers.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from app.core.auth import AuthenticatedUser, get_current_user, require_role
from app.domain.lot_models import LotRecord, OfferRecord, TransactionRecord
from app.domain.roles import UserRole
from app.services.offer_service import OfferService

router = APIRouter(tags=["Offers"])
offer_service = OfferService()


class CreateOfferRequest(BaseModel):
    pricePerKg: float = Field(gt=0, description="Offered price in INR per kg")
    pickupOption: str = Field(default="RECYCLER_PICKUP")
    note: str | None = None


class AcceptOfferResponse(BaseModel):
    transaction: TransactionRecord
    lot: LotRecord
    message: str = "Offer accepted. Commercial transaction created. Next step: schedule handover."


@router.post("/lots/{lot_id}/offers", response_model=OfferRecord)
async def submit_offer(
    lot_id: str,
    payload: CreateOfferRequest,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> OfferRecord:
    """Recycler submits a commercial offer on an active lot."""
    return offer_service.create_offer(
        lot_id=lot_id,
        user=user,
        price_per_kg=payload.pricePerKg,
        pickup_option=payload.pickupOption,
        note=payload.note,
        idempotency_key=idempotency_key,
    )


@router.get("/lots/{lot_id}/offers", response_model=list[OfferRecord])
async def list_lot_offers(
    lot_id: str,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR, UserRole.ADMIN))],
) -> list[OfferRecord]:
    """Collector views all offers submitted for their lot."""
    return offer_service.get_offers_for_lot(lot_id, user)


@router.post("/offers/{offer_id}/accept", response_model=AcceptOfferResponse)
async def accept_offer(
    offer_id: str,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> AcceptOfferResponse:
    """Collector accepts a specific offer, initiating the commercial transaction."""
    tx, lot = offer_service.accept_offer(
        offer_id=offer_id,
        user=user,
        idempotency_key=idempotency_key,
    )
    return AcceptOfferResponse(transaction=tx, lot=lot)


@router.post("/offers/{offer_id}/withdraw", response_model=OfferRecord)
async def withdraw_offer(
    offer_id: str,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
) -> OfferRecord:
    """Recycler withdraws their active pending offer."""
    return offer_service.withdraw_offer(offer_id, user)


@router.get("/recycler/offers", response_model=list[OfferRecord])
async def list_recycler_offers(
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
) -> list[OfferRecord]:
    """Recycler views their own submitted offers."""
    return offer_service.list_for_recycler(user.id)
