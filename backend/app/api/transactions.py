"""
transactions.py — Commercial Transactions, Handover Coordination, and Weight Verification API.

Endpoints per docs/api-contract.md:
- GET  /transactions/{id}: View transaction details.
- GET  /collector/transactions: Collector's transactions list.
- GET  /recycler/transactions: Recycler's active transactions list.
- GET  /lots/{id}/transaction: Get transaction for a specific lot.
- POST /transactions/{id}/handover/schedule: Schedule pickup window and address.
- GET  /transactions/{id}/handover/qr: Fetch QR display credential and manual fallback code.
- POST /transactions/handover/confirm-pickup: Recycler scans QR or enters manual code to confirm pickup.
- POST /transactions/{id}/handover/in-transit: Recycler marks lot as in-transit.
- POST /transactions/{id}/receive: Recycler confirms receipt at processing facility.
- POST /transactions/{id}/verify-weight: Recycler records certified physical scale weight.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from app.core.auth import AuthenticatedUser, get_current_user, require_role
from app.domain.lot_models import (
    HandoverRecord,
    LotRecord,
    TransactionRecord,
    WeightVerificationResult,
)
from app.domain.roles import UserRole
from app.services.handover_service import HandoverService
from app.services.transaction_service import TransactionService

router = APIRouter(tags=["Transactions & Handover"])
tx_service = TransactionService()
handover_service = HandoverService()


class ScheduleHandoverRequest(BaseModel):
    scheduledAt: str = Field(description="ISO timestamp or date string for scheduled handover")
    pickupAddress: str = Field(min_length=3, description="Address or meeting point for handover")
    pickupWindow: str = Field(default="09:00 - 18:00")
    method: str = Field(default="RECYCLER_PICKUP")


class ConfirmPickupRequest(BaseModel):
    qrToken: str = Field(min_length=1, description="Opaque QR token or manual code from collector")
    location: str | None = None


class ReceiveRequest(BaseModel):
    facilityNote: str | None = None


class VerifyWeightRequest(BaseModel):
    verifiedWeightKg: float = Field(gt=0, description="Certified scale weight in kg")
    varianceReason: str | None = None


@router.get("/transactions/{transaction_id}", response_model=TransactionRecord)
async def get_transaction(
    transaction_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TransactionRecord:
    """View details of a commercial transaction."""
    return tx_service.get_by_id(transaction_id, user)


@router.get("/collector/transactions", response_model=list[TransactionRecord])
async def list_collector_transactions(
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR, UserRole.ADMIN))],
) -> list[TransactionRecord]:
    """Collector views all their commercial transactions."""
    return tx_service.list_for_collector(user.id)


@router.get("/recycler/transactions", response_model=list[TransactionRecord])
async def list_recycler_transactions(
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
) -> list[TransactionRecord]:
    """Recycler views all their accepted transactions."""
    return tx_service.list_for_recycler(user.id)


@router.get("/lots/{lot_id}/transaction", response_model=TransactionRecord | None)
async def get_lot_transaction(
    lot_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TransactionRecord | None:
    """Find the active transaction for a lot, if one exists."""
    return tx_service.get_by_lot(lot_id, user)


@router.post("/transactions/{transaction_id}/handover/schedule", response_model=HandoverRecord)
async def schedule_handover(
    transaction_id: str,
    payload: ScheduleHandoverRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> HandoverRecord:
    """Schedule the physical handover window, generating a secure random QR credential."""
    return handover_service.schedule_handover(
        tx_id=transaction_id,
        user=user,
        scheduled_at=payload.scheduledAt,
        pickup_address=payload.pickupAddress,
        pickup_window=payload.pickupWindow,
        method=payload.method,
        idempotency_key=idempotency_key,
    )


@router.get("/transactions/{transaction_id}/handover/qr")
async def get_handover_qr(
    transaction_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> dict:
    """Returns the opaque QR token and manual fallback code for the collector."""
    return handover_service.get_qr_credential(transaction_id, user)


@router.post("/transactions/handover/confirm-pickup")
async def confirm_pickup_global(
    payload: ConfirmPickupRequest,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """Recycler scans QR code or enters manual fallback code to confirm physical custody."""
    handover, lot = handover_service.confirm_pickup(
        token_or_code=payload.qrToken,
        user=user,
        location=payload.location,
        idempotency_key=idempotency_key,
    )
    return {
        "status": "PICKED_UP",
        "lotId": lot.id,
        "transactionId": handover.transactionId,
        "message": "Custody transfer confirmed. E-waste lot is now ready for transit.",
    }


@router.post("/transactions/{transaction_id}/handover/confirm-pickup")
async def confirm_pickup_by_id(
    transaction_id: str,
    payload: ConfirmPickupRequest,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """Recycler confirms pickup directly referencing transaction ID."""
    handover, lot = handover_service.confirm_pickup(
        token_or_code=payload.qrToken,
        user=user,
        location=payload.location,
        idempotency_key=idempotency_key,
    )
    return {
        "status": "PICKED_UP",
        "lotId": lot.id,
        "transactionId": handover.transactionId,
        "message": "Custody transfer confirmed. E-waste lot is now ready for transit.",
    }


@router.post("/transactions/{transaction_id}/handover/in-transit", response_model=LotRecord)
async def mark_in_transit(
    transaction_id: str,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LotRecord:
    """Recycler updates custody status to IN_TRANSIT."""
    return handover_service.mark_in_transit(
        tx_id=transaction_id,
        user=user,
        idempotency_key=idempotency_key,
    )


@router.post("/transactions/{transaction_id}/receive", response_model=LotRecord)
async def confirm_receipt(
    transaction_id: str,
    payload: ReceiveRequest,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> LotRecord:
    """Recycler confirms lot arrival at processing facility."""
    return handover_service.confirm_receipt(
        tx_id=transaction_id,
        user=user,
        facility_note=payload.facilityNote,
        idempotency_key=idempotency_key,
    )


@router.post("/transactions/{transaction_id}/verify-weight", response_model=WeightVerificationResult)
async def verify_weight(
    transaction_id: str,
    payload: VerifyWeightRequest,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> WeightVerificationResult:
    """
    Recycler measures physical weight on scale.
    Calculates final commercial settlement amount: accepted_price * verified_weight.
    """
    return handover_service.verify_physical_weight(
        tx_id=transaction_id,
        user=user,
        verified_weight_kg=payload.verifiedWeightKg,
        variance_reason=payload.varianceReason,
        idempotency_key=idempotency_key,
    )


# ─── Sprint C: Payments, Processing, Evidence, & Closure ──────────────────────

from app.domain.lot_models import (
    CollectorEarningsSummary,
    MaterialRecoveryItem,
    PaymentRecord,
    ProcessingRecord,
    RecyclingEvidenceRecord,
)
from app.services.settlement_service import SettlementService

settlement_service = SettlementService()


class ConfirmPaymentRequest(BaseModel):
    notes: str | None = None


class StartProcessingRequest(BaseModel):
    facilityName: str = Field(default="Apex Eco-Refining Facility Unit 2", min_length=2)
    method: str = Field(default="Mechanical Shredding & Hydrometallurgical Separation", min_length=2)
    notes: str | None = None


class RecyclingEvidenceRequest(BaseModel):
    facilityName: str = Field(default="Apex Eco-Refining Facility Unit 2", min_length=2)
    recoveryBreakdown: list[MaterialRecoveryItem]
    residualPercentage: float = Field(default=8.5, ge=0, le=100)
    certificateNumber: str = Field(min_length=3, description="Official Certificate / Manifest Number")
    documentUrl: str | None = None
    notes: str | None = None


@router.post("/transactions/{transaction_id}/payment/confirm")
async def confirm_payment(
    transaction_id: str,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """
    Recycler confirms simulated demo payment for verified physical weight.
    Transitions: WEIGHT_VERIFIED -> PAYMENT_CONFIRMED.
    """
    return settlement_service.confirm_demo_payment(
        transaction_id=transaction_id,
        user=user,
        idempotency_key=idempotency_key,
    )


@router.post("/transactions/{transaction_id}/processing/start")
async def start_processing(
    transaction_id: str,
    payload: StartProcessingRequest,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """
    Recycler starts formal processing at authorized facility.
    Transitions: PAYMENT_CONFIRMED -> PROCESSING.
    """
    return settlement_service.start_processing(
        transaction_id=transaction_id,
        user=user,
        facility_name=payload.facilityName,
        method=payload.method,
        notes=payload.notes,
        idempotency_key=idempotency_key,
    )


@router.post("/transactions/{transaction_id}/recycling-evidence")
async def add_recycling_evidence(
    transaction_id: str,
    payload: RecyclingEvidenceRequest,
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.RECYCLER, UserRole.ADMIN))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """
    Recycler records recycling recovery breakdown and official destruction certificate.
    Transitions: PROCESSING -> RECYCLING_EVIDENCE_ADDED.
    """
    return settlement_service.add_recycling_evidence(
        transaction_id=transaction_id,
        user=user,
        facility_name=payload.facilityName,
        recovery_breakdown=payload.recoveryBreakdown,
        residual_percentage=payload.residualPercentage,
        certificate_number=payload.certificateNumber,
        document_url=payload.documentUrl,
        notes=payload.notes,
        idempotency_key=idempotency_key,
    )


@router.get("/transactions/{transaction_id}/recycling-evidence", response_model=RecyclingEvidenceRecord | None)
async def get_recycling_evidence(
    transaction_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> RecyclingEvidenceRecord | None:
    """Fetch recorded recycling evidence for a transaction."""
    return settlement_service.get_recycling_evidence(transaction_id, user)


@router.post("/transactions/{transaction_id}/close")
async def close_lot(
    transaction_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """
    Finalize and close digital lot traceability chain once recycling evidence is submitted.
    Transitions: RECYCLING_EVIDENCE_ADDED -> CLOSED.
    """
    return settlement_service.close_lot(
        transaction_id=transaction_id,
        user=user,
        idempotency_key=idempotency_key,
    )


@router.get("/collector/earnings", response_model=CollectorEarningsSummary)
async def get_collector_earnings(
    user: Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR, UserRole.ADMIN))],
) -> CollectorEarningsSummary:
    """Collector views total verified earnings and payment history."""
    return settlement_service.get_collector_earnings(user.id, user)

