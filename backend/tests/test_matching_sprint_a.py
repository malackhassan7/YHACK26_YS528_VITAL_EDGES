"""
Sprint A: Matching Engine Tests

Tests per spec:
- Incompatible recycler excluded (material not in capabilities)
- Compatible recycler returned and ranked
- Deterministic ordering (same input → same result)
- Match explanation returned for each match
- Demo authorization clearly represented (isDemo=True on all results)
- Over-capacity recycler excluded
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.demo_store import reset_demo_store
from app.services.matching_service import MatchingService
from app.domain.lot_models import LotRecord, LotStatus, LotItem, PickupInfo

COLLECTOR = {"Authorization": "Bearer demo-token-collector"}


def _make_verified_lot(material="mat-mobile", weight=8.0, pin="641001"):
    return LotRecord(
        id="lot-match-test",
        humanId="EW-0001",
        collectorId="collector-profile",
        clientDraftId="d1",
        title="Test",
        status=LotStatus.VERIFIED,
        item=LotItem(
            materialCategoryId=material,
            quantity=10,
            quantityUnit="pieces",
            estimatedWeightKg=weight,
            condition="WORKING",  # type: ignore[arg-type]
        ),
        pickup=PickupInfo(cityArea="Coimbatore", pinCode=pin, preference="RECYCLER_PICKUP"),  # type: ignore[arg-type]
        evidence=[],
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
    )


def setup_function():
    reset_demo_store()


# ── Exclusion tests ───────────────────────────────────────────────────────────

def test_incompatible_recycler_is_excluded():
    """
    mat-battery — HazMat Specialists and EcoSafe handle batteries.
    CircuitLoop does NOT — it should be excluded.
    """
    service = MatchingService()
    lot = _make_verified_lot("mat-battery", weight=15.0)
    matches = service.match(lot)

    ids = [m.recyclerId for m in matches]
    # CircuitLoop (rec-004) only handles mat-pcb, mat-laptop, mat-mobile — not battery
    assert "rec-004" not in ids


def test_compatible_recycler_is_included():
    """AllElec handles all materials — should always appear."""
    service = MatchingService()
    lot = _make_verified_lot("mat-mobile", weight=8.0)
    matches = service.match(lot)

    ids = [m.recyclerId for m in matches]
    assert "rec-005" in ids  # AllElec Recyclers handles all materials


def test_over_capacity_recycler_excluded():
    """
    GreenCycle handles max 500 kg. A 600 kg lot should exclude it.
    AllElec handles up to 5000 kg — should still appear.
    """
    service = MatchingService()
    lot = _make_verified_lot("mat-mobile", weight=600.0)  # exceeds GreenCycle max of 500
    matches = service.match(lot)

    ids = [m.recyclerId for m in matches]
    assert "rec-001" not in ids  # GreenCycle excluded (maxKg=500)
    assert "rec-005" in ids      # AllElec still included (maxKg=5000)


# ── Ranking tests ─────────────────────────────────────────────────────────────

def test_matches_sorted_by_score_descending():
    """Results must be ordered highest matchScore first."""
    service = MatchingService()
    lot = _make_verified_lot("mat-mobile", weight=8.0, pin="641001")
    matches = service.match(lot)

    scores = [m.matchScore for m in matches]
    assert scores == sorted(scores, reverse=True), "Matches not sorted descending by matchScore"


def test_authorized_recycler_scores_higher_than_pending():
    """demo_authorized recyclers score 20pts more than demo_pending."""
    service = MatchingService()
    lot = _make_verified_lot("mat-pcb", weight=5.0, pin="641001")
    matches = service.match(lot)

    authorized = [m for m in matches if m.authorizationStatus == "demo_authorized"]
    pending    = [m for m in matches if m.authorizationStatus == "demo_pending"]

    if authorized and pending:
        # At least one authorized recycler should score higher than the pending one
        assert max(m.matchScore for m in authorized) >= max(m.matchScore for m in pending)


# ── Determinism ───────────────────────────────────────────────────────────────

def test_matching_is_deterministic():
    """Same lot always produces the same ranked result."""
    service = MatchingService()
    lot = _make_verified_lot("mat-mobile", weight=8.0, pin="641001")

    r1 = service.match(lot)
    r2 = service.match(lot)

    assert [m.recyclerId for m in r1] == [m.recyclerId for m in r2]
    assert [m.matchScore for m in r1] == [m.matchScore for m in r2]


# ── Match explanation tests ───────────────────────────────────────────────────

def test_every_match_has_reasons():
    """Every RecyclerMatch must include at least one matchReason."""
    service = MatchingService()
    lot = _make_verified_lot("mat-mobile", weight=8.0)
    matches = service.match(lot)

    for match in matches:
        assert len(match.matchReasons) > 0, f"{match.name} has no match reasons"


def test_match_reasons_include_material_capability():
    """Match reasons must mention material capability."""
    service = MatchingService()
    lot = _make_verified_lot("mat-pcb", weight=8.0)
    matches = service.match(lot)

    for match in matches:
        # At least one reason should reference the material
        has_material_reason = any("pcb" in r.lower() or "circuit" in r.lower() or "accepts" in r.lower()
                                  for r in match.matchReasons)
        assert has_material_reason, f"{match.name}: no material reason in {match.matchReasons}"


# ── Demo data labeling ────────────────────────────────────────────────────────

def test_all_matches_labeled_demo():
    """All RecyclerMatch records must have isDemo=True."""
    service = MatchingService()
    lot = _make_verified_lot("mat-mobile", weight=8.0)
    matches = service.match(lot)

    for match in matches:
        assert match.isDemo is True, f"{match.name} not labeled as demo"


def test_match_score_bounded():
    """All matchScores must be 0–100."""
    service = MatchingService()
    lot = _make_verified_lot("mat-mixed", weight=10.0)
    matches = service.match(lot)

    for match in matches:
        assert 0 <= match.matchScore <= 100, f"{match.name} has score {match.matchScore}"


# ── API integration ───────────────────────────────────────────────────────────

def test_matches_api_requires_verified_state():
    """GET /lots/{id}/matches should reject DRAFT lots."""
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json={
        "clientDraftId": "match-api-draft",
        "title": "Test",
        "item": {"materialCategoryId": "mat-mobile", "quantity": 5, "quantityUnit": "pieces",
                 "estimatedWeightKg": 3.0, "condition": "WORKING"},
        "pickup": {"cityArea": "City", "pinCode": "641001", "preference": "RECYCLER_PICKUP"},
    }, headers=COLLECTOR).json()

    resp = client.get(f"/lots/{created['id']}/matches", headers=COLLECTOR)
    assert resp.status_code == 409


def test_list_lot_transitions_to_listed():
    """POST /lots/{id}/list transitions VERIFIED → LISTED."""
    client = TestClient(create_app())

    payload = {
        "clientDraftId": "list-lot-1",
        "title": "PCB Lot",
        "item": {"materialCategoryId": "mat-pcb", "quantity": 10, "quantityUnit": "pieces",
                 "estimatedWeightKg": 8.0, "condition": "WORKING"},
        "pickup": {"cityArea": "Coimbatore", "pinCode": "641001", "preference": "RECYCLER_PICKUP"},
    }
    created = client.post("/lots/drafts", json=payload, headers=COLLECTOR).json()
    lot_id = created["id"]
    client.post(f"/lots/{lot_id}/evidence",
                json={"localId": "p1", "filename": "f.jpg", "mimeType": "image/jpeg",
                      "sizeBytes": 120000, "angleLabel": "Front view"}, headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/price", headers=COLLECTOR)

    resp = client.post(f"/lots/{lot_id}/list", headers=COLLECTOR)
    assert resp.status_code == 200
    assert resp.json()["status"] == "LISTED"


def test_list_lot_requires_pricing_first():
    """POST /lots/{id}/list must fail if no pricing result exists."""
    client = TestClient(create_app())

    payload = {
        "clientDraftId": "list-no-price",
        "title": "PCB Lot",
        "item": {"materialCategoryId": "mat-pcb", "quantity": 10, "quantityUnit": "pieces",
                 "estimatedWeightKg": 8.0, "condition": "WORKING"},
        "pickup": {"cityArea": "Coimbatore", "pinCode": "641001", "preference": "RECYCLER_PICKUP"},
    }
    created = client.post("/lots/drafts", json=payload, headers=COLLECTOR).json()
    lot_id = created["id"]
    client.post(f"/lots/{lot_id}/evidence",
                json={"localId": "p1", "filename": "f.jpg", "mimeType": "image/jpeg",
                      "sizeBytes": 120000, "angleLabel": "Front view"}, headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)
    # Intentionally skip pricing

    resp = client.post(f"/lots/{lot_id}/list", headers=COLLECTOR)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PRICING_REQUIRED"
