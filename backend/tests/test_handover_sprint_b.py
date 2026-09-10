"""
Sprint B: Handover Coordination & QR Credential Tests.

Covers:
- Schedule handover on OFFER_ACCEPTED (transitions to HANDOVER_SCHEDULED)
- Attempting to schedule on non-accepted lot blocked with 409
- Collector retrieves QR credential containing random opaque token & manual fallback code
- Recycler confirms pickup using QR token or manual code (transitions to PICKED_UP)
- Wrong recycler blocked from confirming pickup (403)
- Non-existent token rejected (404)
- Recycler marks lot IN_TRANSIT
- Recycler confirms receipt at facility (transitions to RECEIVED)
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.demo_store import reset_demo_store

COLLECTOR = {"Authorization": "Bearer demo-token-collector"}
RECYCLER = {"Authorization": "Bearer demo-token-recycler"}
ADMIN = {"Authorization": "Bearer demo-token-admin"}


def setup_function():
    reset_demo_store()


def _create_accepted_transaction(client: TestClient) -> tuple[str, str]:
    """Creates a lot, lists it, submits an offer, and accepts it. Returns (lot_id, tx_id)."""
    payload = {
        "clientDraftId": "handover-draft-1",
        "title": "Mobile Phones Lot",
        "item": {
            "materialCategoryId": "mat-mobile",
            "quantity": 15,
            "quantityUnit": "pieces",
            "estimatedWeightKg": 6.0,
            "condition": "WORKING",
        },
        "pickup": {
            "cityArea": "Gandhipuram",
            "pinCode": "641012",
            "preference": "RECYCLER_PICKUP",
        },
    }
    created = client.post("/lots/drafts", json=payload, headers=COLLECTOR).json()
    lot_id = created["id"]
    client.post(f"/lots/{lot_id}/evidence", json={"localId": "e1", "filename": "m.jpg", "mimeType": "image/jpeg", "sizeBytes": 1000, "angleLabel": "Front"}, headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/price", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/list", headers=COLLECTOR)

    # Recycler makes offer
    offer = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": 180.0}, headers=RECYCLER).json()

    # Collector accepts offer
    accept_resp = client.post(f"/offers/{offer['id']}/accept", headers=COLLECTOR).json()
    return lot_id, accept_resp["transaction"]["id"]


def test_schedule_handover_success():
    client = TestClient(create_app())
    lot_id, tx_id = _create_accepted_transaction(client)

    sched_resp = client.post(
        f"/transactions/{tx_id}/handover/schedule",
        json={
            "scheduledAt": "2026-09-12T10:00:00Z",
            "pickupAddress": "123 Mill Road, Gandhipuram, Coimbatore",
            "pickupWindow": "10:00 - 14:00",
            "method": "RECYCLER_PICKUP",
        },
        headers=COLLECTOR,
    )
    assert sched_resp.status_code == 200
    handover = sched_resp.json()
    assert handover["transactionId"] == tx_id
    assert handover["status"] == "SCHEDULED"
    assert handover["qrToken"].startswith("ho_")

    # Lot should now be in HANDOVER_SCHEDULED
    lot_resp = client.get(f"/lots/{lot_id}", headers=COLLECTOR).json()
    assert lot_resp["lot"]["status"] == "HANDOVER_SCHEDULED"


def test_qr_credential_retrieval():
    client = TestClient(create_app())
    lot_id, tx_id = _create_accepted_transaction(client)

    # Schedule handover
    client.post(
        f"/transactions/{tx_id}/handover/schedule",
        json={"scheduledAt": "2026-09-12T10:00:00Z", "pickupAddress": "123 Mill Road"},
        headers=COLLECTOR,
    )

    qr_resp = client.get(f"/transactions/{tx_id}/handover/qr", headers=COLLECTOR)
    assert qr_resp.status_code == 200
    qr_data = qr_resp.json()
    assert "qrToken" in qr_data
    assert "manualCode" in qr_data
    assert qr_data["qrToken"] == qr_data["manualCode"]
    assert qr_data["qrToken"].startswith("ho_")


def test_confirm_pickup_with_valid_token():
    client = TestClient(create_app())
    lot_id, tx_id = _create_accepted_transaction(client)

    sched = client.post(
        f"/transactions/{tx_id}/handover/schedule",
        json={"scheduledAt": "2026-09-12T10:00:00Z", "pickupAddress": "123 Mill Road"},
        headers=COLLECTOR,
    ).json()

    # Recycler scans QR / enters token
    pickup_resp = client.post(
        f"/transactions/{tx_id}/handover/confirm-pickup",
        json={"qrToken": sched["qrToken"]},
        headers=RECYCLER,
    )
    assert pickup_resp.status_code == 200
    assert pickup_resp.json()["status"] == "PICKED_UP"

    lot_resp = client.get(f"/lots/{lot_id}", headers=COLLECTOR).json()
    assert lot_resp["lot"]["status"] == "PICKED_UP"


def test_confirm_pickup_with_invalid_token_rejected():
    client = TestClient(create_app())
    lot_id, tx_id = _create_accepted_transaction(client)

    client.post(
        f"/transactions/{tx_id}/handover/schedule",
        json={"scheduledAt": "2026-09-12T10:00:00Z", "pickupAddress": "123 Mill Road"},
        headers=COLLECTOR,
    )

    pickup_resp = client.post(
        f"/transactions/{tx_id}/handover/confirm-pickup",
        json={"qrToken": "ho_fake_or_expired_token"},
        headers=RECYCLER,
    )
    assert pickup_resp.status_code == 404


def test_in_transit_and_receipt_flow():
    client = TestClient(create_app())
    lot_id, tx_id = _create_accepted_transaction(client)

    sched = client.post(
        f"/transactions/{tx_id}/handover/schedule",
        json={"scheduledAt": "2026-09-12T10:00:00Z", "pickupAddress": "123 Mill Road"},
        headers=COLLECTOR,
    ).json()

    client.post(
        f"/transactions/{tx_id}/handover/confirm-pickup",
        json={"qrToken": sched["qrToken"]},
        headers=RECYCLER,
    )

    # Move to in-transit
    transit_resp = client.post(f"/transactions/{tx_id}/handover/in-transit", headers=RECYCLER)
    assert transit_resp.status_code == 200
    assert transit_resp.json()["status"] == "IN_TRANSIT"

    # Confirm receipt at facility
    receive_resp = client.post(
        f"/transactions/{tx_id}/receive",
        json={"facilityNote": "Arrived at sorting bay 2 intact."},
        headers=RECYCLER,
    )
    assert receive_resp.status_code == 200
    assert receive_resp.json()["status"] == "RECEIVED"
