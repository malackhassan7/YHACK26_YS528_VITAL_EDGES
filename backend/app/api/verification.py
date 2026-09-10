"""
Verification API routes.

POST /lots/{id}/verify          — Run evidence verification pipeline (CAPTURED → VERIFYING → VERIFIED/FLAGGED)
GET  /lots/{id}/verification    — Get stored verification result
POST /lots/{id}/verify/confirm-category — Collector manually confirms category
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, require_role
from app.core.config import get_settings
from app.core.errors import ApiError
from app.domain.lot_models import VerificationResult
from app.domain.roles import UserRole
from app.repositories import demo_store
from app.services.classification_adapter import get_classification_adapter
from app.services.lot_transition import LotTransitionService
from app.services.verification_service import (
    VerificationService,
    _sha256_of_data_url,
    _sha256_of_filename_and_size,
    _compute_phash_from_data_url,
)

router = APIRouter(tags=["verification"])

Collector = Annotated[AuthenticatedUser, Depends(require_role(UserRole.COLLECTOR))]
Idempotency = Annotated[str | None, Header(alias="Idempotency-Key")]


class ConfirmCategoryRequest(BaseModel):
    confirmedCategoryId: str


@router.post("/lots/{lot_id}/verify", response_model=VerificationResult)
def verify_lot(lot_id: str, user: Collector, idempotency_key: Idempotency = None) -> VerificationResult:
    """
    Run the full verification pipeline for a CAPTURED lot.
    Transitions: CAPTURED → VERIFYING → VERIFIED or FLAGGED.
    Returns the complete VerificationResult with trust score and checks.
    """
    settings = get_settings()
    lot = demo_store.get_lot_for_collector(lot_id, user)

    transition = LotTransitionService()

    # 1. Build and store image hashes BEFORE transitioning (lot still CAPTURED here)
    for ev in lot.evidence:
        sha = (
            _sha256_of_data_url(ev.previewDataUrl)
            if ev.previewDataUrl
            else _sha256_of_filename_and_size(ev.filename, ev.sizeBytes)
        )
        phash = _compute_phash_from_data_url(ev.previewDataUrl) if ev.previewDataUrl else None
        demo_store.store_image_hashes(lot.id, sha, phash, ev.localId)

    # 2. Run verification pipeline (validates lot.status == CAPTURED internally)
    adapter = get_classification_adapter(
        ai_enabled=settings.ai_classification_enabled,
        api_key=settings.ai_api_key,
    )
    service = VerificationService(
        classification_adapter=adapter,
        phash_threshold=settings.perceptual_hash_threshold,
        min_trust_for_verified=settings.min_trust_score_for_verified,
    )

    result = service.run(
        lot=lot,
        user=user,
        existing_sha256s=demo_store.IMAGE_SHA256S,
        existing_phashes=demo_store.IMAGE_PHASHES,
    )

    # 3. Store result (append-only checks per database-schema.md)
    demo_store.store_verification_result(result)

    # 4. Apply transitions: CAPTURED → VERIFYING → VERIFIED/FLAGGED
    lot = transition.start_verification(lot, user, idempotency_key)
    lot = transition.complete_verification(lot, user, result, idempotency_key)

    return result



@router.get("/lots/{lot_id}/verification", response_model=VerificationResult)
def get_verification(lot_id: str, user: Collector) -> VerificationResult:
    """Return the stored verification result for a lot."""
    demo_store.get_lot_for_collector(lot_id, user)  # ownership check
    result = demo_store.get_verification_result(lot_id)
    if result is None:
        raise ApiError(404, "NOT_FOUND", "No verification result found for this lot. Run verification first.")
    return result


@router.post("/lots/{lot_id}/verify/confirm-category", response_model=VerificationResult)
def confirm_category(lot_id: str, request: ConfirmCategoryRequest, user: Collector, idempotency_key: Idempotency = None) -> VerificationResult:
    """
    Collector manually confirms material category when AI classification is
    unavailable or returned low confidence. Updates item category and re-runs
    the scoring to update requiresManualCategoryConfirmation flag.
    """
    lot = demo_store.get_lot_for_collector(lot_id, user)
    # Validate the category exists
    demo_store.get_material(request.confirmedCategoryId)

    transition = LotTransitionService()
    lot = transition.manual_category_confirm(lot, user, request.confirmedCategoryId, idempotency_key)

    # Retrieve existing verification result and patch it
    existing = demo_store.get_verification_result(lot_id)
    if existing is None:
        raise ApiError(409, "INVALID_STATE", "No verification result to confirm category for.")

    # Mark manual confirmation complete
    existing.requiresManualCategoryConfirmation = False
    existing.isDemoClassification = False
    if existing.classificationResult:
        existing.classificationResult.source = "manual"
        existing.classificationResult.isDemo = False

    demo_store.store_verification_result(existing)

    # If lot is still FLAGGED due to low confidence but category is now confirmed,
    # re-run the pipeline to potentially lift to VERIFIED
    if lot.status.value == "FLAGGED":
        settings = get_settings()
        adapter = get_classification_adapter(
            ai_enabled=settings.ai_classification_enabled,
            api_key=settings.ai_api_key,
        )
        service = VerificationService(
            classification_adapter=adapter,
            phash_threshold=settings.perceptual_hash_threshold,
            min_trust_for_verified=settings.min_trust_score_for_verified,
        )
        # Force lot to CAPTURED-like check for re-run (service checks CAPTURED)
        from app.domain.lot_status import LotStatus
        lot.status = LotStatus.CAPTURED
        new_result = service.run(
            lot=lot,
            user=user,
            existing_sha256s=demo_store.IMAGE_SHA256S,
            existing_phashes=demo_store.IMAGE_PHASHES,
        )
        demo_store.store_verification_result(new_result)
        lot = LotTransitionService().start_verification(lot, user)
        lot = LotTransitionService().complete_verification(lot, user, new_result, idempotency_key)
        return new_result

    return existing
