from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from app.core.auth import AuthenticatedUser, require_role
from app.domain.lot_models import EvidenceMetadata, LotItem, LotRecord, PickupInfo, TraceEvent
from app.domain.roles import UserRole
from app.repositories import demo_store
from app.services.lot_transition import LotTransitionService

router = APIRouter(prefix="/lots", tags=["lots"])


class DraftLotRequest(BaseModel):
    clientDraftId: str = Field(min_length=3, max_length=120)
    title: str = Field(default="Digital E-Waste Lot", max_length=120)
    item: LotItem | None = None
    pickup: PickupInfo | None = None


class EvidenceRequest(EvidenceMetadata):
    pass


class LotWithTimeline(BaseModel):
    lot: LotRecord
    traceEvents: list[TraceEvent]


Collector = Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR))]
Idempotency = Annotated[str | None, Header(alias="Idempotency-Key")]


@router.get("", response_model=list[LotRecord])
def list_lots(user: Collector) -> list[LotRecord]:
    return [lot for lot in demo_store.LOTS.values() if lot.collectorId == user.id]


@router.post("/drafts", response_model=LotRecord)
def create_draft(request: DraftLotRequest, user: Collector, idempotency_key: Idempotency = None) -> LotRecord:
    return demo_store.create_lot(user, request.clientDraftId, request.title, request.item, request.pickup, idempotency_key)


@router.get("/{lot_id}", response_model=LotWithTimeline)
def get_lot(lot_id: str, user: Collector) -> LotWithTimeline:
    lot = demo_store.get_lot_for_collector(lot_id, user)
    events = [event for event in demo_store.TRACE_EVENTS if event.lotId == lot.id]
    return LotWithTimeline(lot=lot, traceEvents=events)


@router.put("/{lot_id}/draft", response_model=LotRecord)
def update_draft(lot_id: str, request: DraftLotRequest, user: Collector, idempotency_key: Idempotency = None) -> LotRecord:
    lot = demo_store.get_lot_for_collector(lot_id, user)
    return demo_store.update_lot(lot, user, request.title, request.item, request.pickup, idempotency_key)


@router.post("/{lot_id}/evidence", response_model=LotRecord)
def add_evidence(lot_id: str, request: EvidenceRequest, user: Collector, idempotency_key: Idempotency = None) -> LotRecord:
    lot = demo_store.get_lot_for_collector(lot_id, user)
    return demo_store.add_evidence(lot, user, request, idempotency_key)


@router.post("/{lot_id}/capture", response_model=LotRecord)
def capture_lot(lot_id: str, user: Collector, idempotency_key: Idempotency = None) -> LotRecord:
    lot = demo_store.get_lot_for_collector(lot_id, user)
    return LotTransitionService().capture(lot, user, idempotency_key)