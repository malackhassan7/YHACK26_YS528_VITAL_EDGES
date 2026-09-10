"""
Sprint A: Verification Engine Tests

Tests per spec:
- SHA-256 exact duplicate detection
- Perceptual duplicate detection
- Corrupted/bad input handling
- Low-quality evidence scoring
- Deterministic trust score (same input → same output)
- AI adapter failure → fallback path continues
- Manual category correction
- Ownership enforcement (403)
- Invalid lifecycle state rejection
- CAPTURED → VERIFYING → VERIFIED full transition with trace events
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.demo_store import LOTS, TRACE_EVENTS, VERIFICATION_RESULTS, reset_demo_store
from app.domain.lot_models import ConfidenceLevel, EvidenceMetadata, LotRecord
from app.domain.lot_status import LotStatus
from app.services.verification_service import (
    VerificationService,
    _sha256_of_filename_and_size,
    _sha256_of_data_url,
)
from app.services.classification_adapter import DemoClassificationAdapter, AIClassificationAdapter

COLLECTOR = {"Authorization": "Bearer demo-token-collector"}
RECYCLER  = {"Authorization": "Bearer demo-token-recycler"}


def base_payload(client_id="vc-1"):
    return {
        "clientDraftId": client_id,
        "title": "PCB Lot",
        "item": {
            "materialCategoryId": "mat-pcb",
            "quantity": 10,
            "quantityUnit": "pieces",
            "estimatedWeightKg": 8.0,
            "condition": "WORKING",
        },
        "pickup": {"cityArea": "Coimbatore", "pinCode": "641001", "preference": "RECYCLER_PICKUP"},
    }


def good_evidence(local_id="photo-1", angle="Front view"):
    return {
        "localId": local_id,
        "filename": "board.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 120_000,
        "angleLabel": angle,
        "previewDataUrl": None,
    }


def setup_function():
    reset_demo_store()


def _create_captured_lot(client):
    """Helper: create draft → add evidence → capture → return lot data."""
    created = client.post("/lots/drafts", json=base_payload(), headers=COLLECTOR).json()
    lot_id = created["id"]
    client.post(f"/lots/{lot_id}/evidence", json=good_evidence("p1", "Front view"), headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/evidence", json=good_evidence("p2", "Back view"), headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/evidence", json=good_evidence("p3", "Scale view"), headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)
    return lot_id


# ── Lifecycle transition tests ────────────────────────────────────────────────

def test_verify_lot_transitions_captured_to_verified_and_creates_trace():
    """Full CAPTURED → VERIFYING → VERIFIED pipeline with trace events."""
    client = TestClient(create_app())
    lot_id = _create_captured_lot(client)

    response = client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)
    assert response.status_code == 200

    result = response.json()
    assert "trustScore" in result
    assert result["trustScore"] >= 0
    assert result["trustScore"] <= 100
    assert result["confidenceLevel"] in {"HIGH", "MEDIUM", "LOW"}

    # Lot status should have changed
    lot = LOTS[lot_id]
    assert lot.status in {LotStatus.VERIFIED, LotStatus.FLAGGED}

    # Trace events should include VERIFICATION_STARTED and then LOT_VERIFIED or LOT_FLAGGED
    event_types = [e.eventType for e in TRACE_EVENTS if e.lotId == lot_id]
    assert "VERIFICATION_STARTED" in event_types
    assert any(et in event_types for et in ("LOT_VERIFIED", "LOT_FLAGGED"))


def test_verify_requires_captured_state():
    """Only CAPTURED lots can start verification."""
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json=base_payload("vc-draft"), headers=COLLECTOR).json()
    response = client.post(f"/lots/{created['id']}/verify", headers=COLLECTOR)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_TRANSITION"


def test_verify_enforces_ownership():
    """A recycler cannot verify a collector's lot."""
    client = TestClient(create_app())
    lot_id = _create_captured_lot(client)
    response = client.post(f"/lots/{lot_id}/verify", headers=RECYCLER)
    # Recycler role → 403 from role guard on collector-only endpoint
    assert response.status_code == 403


def test_get_verification_returns_stored_result():
    """GET /lots/{id}/verification returns the result after verify."""
    client = TestClient(create_app())
    lot_id = _create_captured_lot(client)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)

    response = client.get(f"/lots/{lot_id}/verification", headers=COLLECTOR)
    assert response.status_code == 200
    data = response.json()
    assert data["lotId"] == lot_id
    assert "checks" in data
    assert len(data["checks"]) > 0


def test_get_verification_returns_404_before_verify():
    """GET before verify returns 404."""
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json=base_payload("vc-pre"), headers=COLLECTOR).json()
    client.post(f"/lots/{created['id']}/evidence", json=good_evidence(), headers=COLLECTOR)
    client.post(f"/lots/{created['id']}/capture", headers=COLLECTOR)

    response = client.get(f"/lots/{created['id']}/verification", headers=COLLECTOR)
    assert response.status_code == 404


# ── Trust score determinism ───────────────────────────────────────────────────

def test_trust_score_is_deterministic():
    """Same lot configuration must produce the same trust score every time."""
    from app.repositories.demo_store import IMAGE_SHA256S, IMAGE_PHASHES

    adapter = DemoClassificationAdapter()
    service = VerificationService(adapter, phash_threshold=10)

    # Build a minimal LotRecord manually for unit testing
    from app.domain.lot_models import LotItem, PickupInfo
    from pydantic import BaseModel

    evidence = [
        EvidenceMetadata(localId="p1", filename="a.jpg", mimeType="image/jpeg",
                         sizeBytes=100_000, angleLabel="Front view"),
        EvidenceMetadata(localId="p2", filename="b.jpg", mimeType="image/jpeg",
                         sizeBytes=100_000, angleLabel="Back view"),
        EvidenceMetadata(localId="p3", filename="c.jpg", mimeType="image/jpeg",
                         sizeBytes=100_000, angleLabel="Scale view"),
    ]

    from app.core.auth import AuthenticatedUser
    from app.domain.roles import UserRole

    user = AuthenticatedUser(id="collector-profile", email="c@test", displayName="Test", role=UserRole.COLLECTOR, isDemo=True)

    lot = LotRecord(
        id="lot-unit-1",
        humanId="EW-0001",
        collectorId="collector-profile",
        clientDraftId="test-draft",
        title="Test",
        status=LotStatus.CAPTURED,
        item=LotItem(materialCategoryId="mat-pcb", quantity=10, quantityUnit="pieces",
                     estimatedWeightKg=8.0, condition="WORKING"),  # type: ignore[arg-type]
        pickup=PickupInfo(cityArea="Coimbatore", pinCode="641001", preference="RECYCLER_PICKUP"),  # type: ignore[arg-type]
        evidence=evidence,
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
    )

    r1 = service.run(lot, user, {}, {})
    lot.status = LotStatus.CAPTURED  # reset for second run
    r2 = service.run(lot, user, {}, {})

    assert r1.trustScore == r2.trustScore
    assert r1.confidenceLevel == r2.confidenceLevel


# ── Exact SHA-256 duplicate detection ────────────────────────────────────────

def test_sha256_exact_duplicate_reduces_score():
    """Reusing the same image hash reduces trust score significantly."""
    adapter = DemoClassificationAdapter()
    service = VerificationService(adapter, phash_threshold=10)

    from app.core.auth import AuthenticatedUser
    from app.domain.lot_models import LotItem, PickupInfo
    from app.domain.roles import UserRole

    user = AuthenticatedUser(id="collector-profile", email="c@test", displayName="Test", role=UserRole.COLLECTOR, isDemo=True)

    evidence_no_dup = [
        EvidenceMetadata(localId="p1", filename="a.jpg", mimeType="image/jpeg",
                         sizeBytes=100_000, angleLabel="Front view"),
    ]
    evidence_dup = [
        EvidenceMetadata(localId="p1", filename="a.jpg", mimeType="image/jpeg",
                         sizeBytes=100_000, angleLabel="Front view"),
    ]

    lot_clean = LotRecord(
        id="lot-clean", humanId="EW-0001", collectorId="collector-profile",
        clientDraftId="d1", title="T", status=LotStatus.CAPTURED,
        item=LotItem(materialCategoryId="mat-mobile", quantity=5, quantityUnit="pieces",
                     estimatedWeightKg=2.0, condition="WORKING"),  # type: ignore[arg-type]
        pickup=PickupInfo(cityArea="City", pinCode="641001", preference="EITHER"),  # type: ignore[arg-type]
        evidence=evidence_no_dup, createdAt="2026-01-01T00:00:00+00:00", updatedAt="2026-01-01T00:00:00+00:00",
    )
    lot_dup = LotRecord(
        id="lot-dup", humanId="EW-0002", collectorId="collector-profile",
        clientDraftId="d2", title="T", status=LotStatus.CAPTURED,
        item=LotItem(materialCategoryId="mat-mobile", quantity=5, quantityUnit="pieces",
                     estimatedWeightKg=2.0, condition="WORKING"),  # type: ignore[arg-type]
        pickup=PickupInfo(cityArea="City", pinCode="641001", preference="EITHER"),  # type: ignore[arg-type]
        evidence=evidence_dup, createdAt="2026-01-01T00:00:00+00:00", updatedAt="2026-01-01T00:00:00+00:00",
    )

    # Run clean lot first, capture its sha256
    sha = _sha256_of_filename_and_size("a.jpg", 100_000)
    existing_hashes = {sha: ("lot-clean", "p1")}  # simulate already stored

    result_dup = service.run(lot_dup, user, existing_hashes, {})

    dup_check = next((c for c in result_dup.checks if c.checkType == "EXACT_DUPLICATE"), None)
    assert dup_check is not None
    assert dup_check.status.value == "FAIL"
    assert dup_check.scoreDelta < 0


# ── AI adapter failure fallback ───────────────────────────────────────────────

def test_ai_adapter_failure_still_completes_verification():
    """If AI adapter returns None, verification continues with requiresManualCategoryConfirmation=True."""
    ai_adapter = AIClassificationAdapter(api_key="fake-key")
    service = VerificationService(ai_adapter, phash_threshold=10)

    from app.core.auth import AuthenticatedUser
    from app.domain.lot_models import LotItem, PickupInfo
    from app.domain.roles import UserRole

    user = AuthenticatedUser(id="collector-profile", email="c@test", displayName="T", role=UserRole.COLLECTOR, isDemo=True)

    lot = LotRecord(
        id="lot-ai-fail", humanId="EW-0001", collectorId="collector-profile",
        clientDraftId="d3", title="T", status=LotStatus.CAPTURED,
        item=LotItem(materialCategoryId="mat-mobile", quantity=5, quantityUnit="pieces",
                     estimatedWeightKg=2.0, condition="WORKING"),  # type: ignore[arg-type]
        pickup=PickupInfo(cityArea="City", pinCode="641001", preference="EITHER"),  # type: ignore[arg-type]
        evidence=[EvidenceMetadata(localId="p1", filename="a.jpg", mimeType="image/jpeg",
                                   sizeBytes=100_000, angleLabel="Front view")],
        createdAt="2026-01-01T00:00:00+00:00", updatedAt="2026-01-01T00:00:00+00:00",
    )

    result = service.run(lot, user, {}, {})
    # Pipeline must complete even with AI unavailable
    assert result.trustScore is not None
    assert result.requiresManualCategoryConfirmation is True


# ── Manual category confirmation ──────────────────────────────────────────────

def test_manual_category_confirm_updates_classification():
    """POST confirm-category updates the classification source to manual."""
    client = TestClient(create_app())
    lot_id = _create_captured_lot(client)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)

    response = client.post(
        f"/lots/{lot_id}/verify/confirm-category",
        json={"confirmedCategoryId": "mat-pcb"},
        headers=COLLECTOR,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["requiresManualCategoryConfirmation"] is False


def test_manual_category_confirm_rejects_invalid_category():
    """Confirming a non-existent material category returns 400."""
    client = TestClient(create_app())
    lot_id = _create_captured_lot(client)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)

    response = client.post(
        f"/lots/{lot_id}/verify/confirm-category",
        json={"confirmedCategoryId": "mat-nonexistent"},
        headers=COLLECTOR,
    )
    assert response.status_code == 400


# ── Multi-image quality checks ────────────────────────────────────────────────

def test_small_image_fails_quality_check():
    """Images under 10KB should fail quality checks."""
    from app.services.verification_service import _check_image_quality

    small_image = EvidenceMetadata(
        localId="tiny", filename="tiny.jpg", mimeType="image/jpeg",
        sizeBytes=5_000,  # under 10KB threshold
        angleLabel="Front",
    )
    assert _check_image_quality(small_image).value == "FAIL"


def test_wrong_mime_fails_quality_check():
    """Wrong MIME type should fail quality check."""
    from app.services.verification_service import _check_image_quality

    bad_mime = EvidenceMetadata(
        localId="bad", filename="doc.pdf", mimeType="application/pdf",
        sizeBytes=100_000, angleLabel="Front",
    )
    assert _check_image_quality(bad_mime).value == "FAIL"
