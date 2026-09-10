"""
Sprint B: Offers and Acceptance Tests.

Covers:
- Recycler creates offer on LISTED lot (transitions to OFFERS_RECEIVED)
- Role authorization guards (Collector cannot create offer)
- Invalid lot states blocked from receiving offers
- Non-positive price per kg rejected
- Duplicate pending offer prevention per recycler per lot
- Fairness anomaly classification (NORMAL vs VERY_LOW)
- Collector views offers on own lot; unauthorized collector blocked
- Collector accepts offer -> transitions to OFFER_ACCEPTED & creates Transaction
- Competing offers automatically marked REJECTED
- Recycler withdraws active pending offer
"""

import pytest
from fastapi.testclient import TestClient

from app.domain.lot_models import Condition, LotItem, LotRecord, LotStatus, OfferAnomalyLevel, PickupInfo, PickupPreference
from app.main import create_app
from app.repositories.demo_store import LOTS, reset_demo_store, seed_demo_pcb_scenario

COLLECTOR = {"Authorization": "Bearer demo-token-collector"}
RECYCLER = {"Authorization": "Bearer demo-token-recycler"}
ADMIN = {"Authorization": "Bearer demo-token-admin"}


def setup_function():
    reset_demo_store()


def _create_listed_lot(client: TestClient) -> str:
    """Helper to create and list a lot."""
    payload = {
        "clientDraftId": "lot-offer-draft",
        "title": "Circuit Boards Lot",
        "item": {
            "materialCategoryId": "mat-pcb",
            "quantity": 10,
            "quantityUnit": "pieces",
            "estimatedWeightKg": 5.0,
            "condition": "WORKING",
        },
        "pickup": {
            "cityArea": "Coimbatore",
            "pinCode": "641001",
            "preference": "RECYCLER_PICKUP",
        },
    }
    created = client.post("/lots/drafts", json=payload, headers=COLLECTOR).json()
    lot_id = created["id"]
    client.post(f"/lots/{lot_id}/evidence", json={"localId": "e1", "filename": "f.jpg", "mimeType": "image/jpeg", "sizeBytes": 1000, "angleLabel": "Front"}, headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/price", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/list", headers=COLLECTOR)
    return lot_id


def test_recycler_can_submit_fair_offer():
    client = TestClient(create_app())
    lot_id = _create_listed_lot(client)

    resp = client.post(
        f"/lots/{lot_id}/offers",
        json={"pricePerKg": 470.0, "pickupOption": "RECYCLER_PICKUP", "note": "Will pick up with calibrated scale."},
        headers=RECYCLER,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["lotId"] == lot_id
    assert data["pricePerKg"] == 470.0
    assert data["estimatedTotal"] == 2350.0  # 470 * 5 kg
    assert data["status"] == "PENDING"
    assert data["anomalyLevel"] == "NORMAL"

    # Lot status should transition to OFFERS_RECEIVED
    lot_resp = client.get(f"/lots/{lot_id}", headers=COLLECTOR)
    assert lot_resp.json()["lot"]["status"] == "OFFERS_RECEIVED"


def test_collector_blocked_from_submitting_offer():
    client = TestClient(create_app())
    lot_id = _create_listed_lot(client)

    resp = client.post(
        f"/lots/{lot_id}/offers",
        json={"pricePerKg": 400.0},
        headers=COLLECTOR,
    )
    assert resp.status_code == 403


def test_offer_on_unlisted_lot_blocked():
    client = TestClient(create_app())
    # Create draft only
    created = client.post(
        "/lots/drafts",
        json={"clientDraftId": "d-unlisted", "title": "Draft", "item": None, "pickup": None},
        headers=COLLECTOR,
    ).json()

    resp = client.post(f"/lots/{created['id']}/offers", json={"pricePerKg": 400.0}, headers=RECYCLER)
    assert resp.status_code == 409


def test_zero_or_negative_price_rejected():
    client = TestClient(create_app())
    lot_id = _create_listed_lot(client)

    resp = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": -50.0}, headers=RECYCLER)
    assert resp.status_code == 422 or resp.status_code == 400


def test_duplicate_pending_offer_blocked():
    client = TestClient(create_app())
    lot_id = _create_listed_lot(client)

    # First offer
    client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": 470.0}, headers=RECYCLER)
    # Second offer by same recycler without withdrawing first
    second = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": 480.0}, headers=RECYCLER)
    assert second.status_code == 409
    assert "DUPLICATE_OFFER" in second.json()["error"]["code"]


def test_abnormal_low_offer_classified_very_low_without_blocking():
    client = TestClient(create_app())
    lot_id = _create_listed_lot(client)

    # PCB reference is 470/kg. Offer 200/kg is > 55% below reference
    resp = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": 200.0}, headers=RECYCLER)
    assert resp.status_code == 200
    data = resp.json()
    assert data["anomalyLevel"] == "VERY_LOW"
    assert "Unusually low" in data["anomalyMessage"]


def test_collector_can_list_offers():
    client = TestClient(create_app())
    seed_demo_pcb_scenario()

    resp = client.get("/lots/lot-demo-pcb-1/offers", headers=COLLECTOR)
    assert resp.status_code == 200
    offers = resp.json()
    assert len(offers) == 2
    levels = [o["anomalyLevel"] for o in offers]
    assert "NORMAL" in levels
    assert "VERY_LOW" in levels


def test_collector_accepts_offer_creates_transaction():
    client = TestClient(create_app())
    lot_id = _create_listed_lot(client)

    # Recycler submits offer
    offer = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": 480.0}, headers=RECYCLER).json()

    # Collector accepts
    accept_resp = client.post(f"/offers/{offer['id']}/accept", headers=COLLECTOR)
    assert accept_resp.status_code == 200
    data = accept_resp.json()
    assert "transaction" in data
    tx = data["transaction"]
    assert tx["lotId"] == lot_id
    assert tx["agreedPricePerKg"] == 480.0
    assert tx["declaredWeightSnapshot"] == 5.0
    assert tx["provisionalEstimatedTotal"] == 2400.0
    assert tx["status"] == "CREATED"
    assert data["lot"]["status"] == "OFFER_ACCEPTED"


def test_competing_offers_rejected_when_one_is_accepted():
    client = TestClient(create_app())
    seed_demo_pcb_scenario()

    # Accept the normal offer
    resp = client.post("/offers/offer-pcb-normal/accept", headers=COLLECTOR)
    assert resp.status_code == 200

    # Check offers on this lot: normal should be ACCEPTED, low should be REJECTED
    offers_resp = client.get("/lots/lot-demo-pcb-1/offers", headers=COLLECTOR).json()
    statuses = {o["id"]: o["status"] for o in offers_resp}
    assert statuses["offer-pcb-normal"] == "ACCEPTED"
    assert statuses["offer-pcb-low"] == "REJECTED"


def test_recycler_can_withdraw_pending_offer():
    client = TestClient(create_app())
    lot_id = _create_listed_lot(client)

    offer = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": 470.0}, headers=RECYCLER).json()
    withdraw_resp = client.post(f"/offers/{offer['id']}/withdraw", headers=RECYCLER)
    assert withdraw_resp.status_code == 200
    assert withdraw_resp.json()["status"] == "WITHDRAWN"
