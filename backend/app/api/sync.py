from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from app.core.auth import AuthenticatedUser, require_role
from app.core.errors import ApiError
from app.domain.lot_models import EvidenceMetadata, LotItem, LotRecord, PickupInfo
from app.domain.roles import UserRole
from app.repositories import demo_store
from app.services.lot_transition import LotTransitionService

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncPayload(BaseModel):
    clientDraftId: str = Field(min_length=3, max_length=120)
    serverId: str | None = None
    title: str = "Digital E-Waste Lot"
    item: LotItem | None = None
    pickup: PickupInfo | None = None
    evidence: list[EvidenceMetadata] = []


class SyncMutation(BaseModel):
    mutationId: str = Field(min_length=3, max_length=160)
    idempotencyKey: str = Field(min_length=3, max_length=200)
    operation: Literal["CREATE_DRAFT", "UPDATE_DRAFT", "ADD_EVIDENCE", "CAPTURE_LOT"]
    payload: SyncPayload


class SyncAck(BaseModel):
    mutationId: str
    status: Literal["COMPLETE", "FAILED"]
    lot: LotRecord | None = None
    error: str | None = None


class SyncRequest(BaseModel):
    mutations: list[SyncMutation]


class SyncResponse(BaseModel):
    results: list[SyncAck]


Collector = Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR))]


def _execute_mutation(mutation: SyncMutation, user: AuthenticatedUser) -> LotRecord:
    payload = mutation.payload
    if mutation.operation == "CREATE_DRAFT":
        lot = demo_store.create_lot(user, payload.clientDraftId, payload.title, payload.item, payload.pickup, mutation.idempotencyKey)
        for evidence in payload.evidence:
            demo_store.add_evidence(lot, user, evidence, mutation.idempotencyKey)
        return lot
    if payload.serverId is None:
        raise ApiError(status_code=400, code="SERVER_ID_REQUIRED", message="Synchronized mutations require a server lot id.")
    lot = demo_store.get_lot_for_collector(payload.serverId, user)
    if mutation.operation == "UPDATE_DRAFT":
        return demo_store.update_lot(lot, user, payload.title, payload.item, payload.pickup, mutation.idempotencyKey)
    if mutation.operation == "ADD_EVIDENCE":
        for evidence in payload.evidence:
            lot = demo_store.add_evidence(lot, user, evidence, mutation.idempotencyKey)
        return lot
    if mutation.operation == "CAPTURE_LOT":
        return LotTransitionService().capture(lot, user, mutation.idempotencyKey)
    raise ApiError(status_code=400, code="UNKNOWN_SYNC_OPERATION", message="Unsupported sync operation.")


@router.post("/mutations", response_model=SyncResponse)
def sync_mutations(request: SyncRequest, user: Collector, request_idempotency: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> SyncResponse:
    results: list[SyncAck] = []
    for mutation in request.mutations:
        key = (user.id, mutation.idempotencyKey or request_idempotency or mutation.mutationId)
        if key in demo_store.SYNC_RESULTS:
            results.append(SyncAck(**demo_store.SYNC_RESULTS[key]))
            continue
        try:
            lot = _execute_mutation(mutation, user)
            ack = SyncAck(mutationId=mutation.mutationId, status="COMPLETE", lot=lot)
        except ApiError as error:
            ack = SyncAck(mutationId=mutation.mutationId, status="FAILED", error=error.detail["message"])
        demo_store.SYNC_RESULTS[key] = ack.model_dump(mode="json")
        results.append(ack)
    return SyncResponse(results=results)


@router.get("/bootstrap", response_model=list[LotRecord])
def sync_bootstrap(user: Collector) -> list[LotRecord]:
    return [lot for lot in demo_store.LOTS.values() if lot.collectorId == user.id]