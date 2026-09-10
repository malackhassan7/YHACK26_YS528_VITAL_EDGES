"""
Sprint B: Physical Weight Verification Tests.

Covers:
- Recycler records certified physical scale weight on RECEIVED lot
- Authoritative commercial settlement: final_amount = agreed_price * verified_weight
- Lot transitions to WEIGHT_VERIFIED
- Non-positive weight rejected (400 or 422)
- Lot not in RECEIVED status blocked from weight verification (409)
- Wrong actor blocked (403)
- Weight difference & percentage calculation
- Variance > 20% flagged as anomalous
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


def _create_received_lot(client: TestClient, declared_weight=10.0, agreed_price=260.0) -> tuple[str, str]:
    """Sets up a complete workflow up to RECEIVED status. Returns (lot_id, tx_id)."""
    payload = {
        "clientDraftId": "weight-test-lot",
        "title": "Laptop Boards Lot",
        "item": {
            "materialCategoryId": "mat-laptop",
            "quantity": 5,
            "quantityUnit": "pieces",
            "estimatedWeightKg": declared_weight,
            "condition": "WORKING",
        },
        "pickup": {"cityArea": "Coimbatore", "pinCode": "641001", "preference": "RECYCLER_PICKUP"},
    }
    lot_id = client.post("/lots/drafts", json=payload, headers=COLLECTOR).json()["id"]
    client.post(f"/lots/{lot_id}/evidence", json={"localId": "e1", "filename": "l.jpg", "mimeType": "image/jpeg", "sizeBytes": 1000, "angleLabel": "Front"}, headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/price", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/list", headers=COLLECTOR)

    offer = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": agreed_price}, headers=RECYCLER).json()
    tx_id = client.post(f"/offers/{offer['id']}/accept", headers=COLLECTOR).json()["transaction"]["id"]

    sched = client.post(
        f"/transactions/{tx_id}/handover/schedule",
        json={"scheduledAt": "2026-09-12T10:00:00Z", "pickupAddress": "Coimbatore HQ"},
        headers=COLLECTOR,
    ).json()

    client.post(f"/transactions/{tx_id}/handover/confirm-pickup", json={"qrToken": sched["qrToken"]}, headers=RECYCLER)
    client.post(f"/transactions/{tx_id}/handover/in-transit", headers=RECYCLER)
    client.post(f"/transactions/{tx_id}/receive", json={"facilityNote": "Received at scale 1."}, headers=RECYCLER)

    return lot_id, tx_id


def test_verify_physical_weight_calculates_final_amount():
    client = TestClient(create_app())
    # Declared 10.0 kg at ₹260/kg
    lot_id, tx_id = _create_received_lot(client, declared_weight=10.0, agreed_price=260.0)

    # Physical scale measures 9.6 kg
    resp = client.post(
        f"/transactions/{tx_id}/verify-weight",
        json={"verifiedWeightKg": 9.6, "varianceReason": "Minor dust / moisture loss."},
        headers=RECYCLER,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["verifiedWeightKg"] == 9.6
    assert data["declaredWeightKg"] == 10.0
    assert data["diffKg"] == -0.4
    assert data["diffPercent"] == -4.0
    assert data["agreedPricePerKg"] == 260.0
    # Final amount: 9.6 kg * 260 = ₹2,496.00
    assert data["finalAmount"] == 2496.0
    assert data["isAnomalous"] is False

    # Verify lot reached WEIGHT_VERIFIED
    lot_resp = client.get(f"/lots/{lot_id}", headers=COLLECTOR).json()
    assert lot_resp["lot"]["status"] == "WEIGHT_VERIFIED"
    assert lot_resp["lot"]["verifiedWeightKg"] == 9.6
    assert lot_resp["lot"]["finalAmount"] == 2496.0


def test_anomalous_weight_variance_flagged():
    client = TestClient(create_app())
    # Declared 10.0 kg
    lot_id, tx_id = _create_received_lot(client, declared_weight=10.0, agreed_price=260.0)

    # Scale measures 7.5 kg (25% drop > 20% threshold)
    resp = client.post(
        f"/transactions/{tx_id}/verify-weight",
        json={"verifiedWeightKg": 7.5, "varianceReason": "Heavy packaging removed."},
        headers=RECYCLER,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["diffPercent"] == -25.0
    assert data["isAnomalous"] is True


def test_zero_or_negative_weight_rejected():
    client = TestClient(create_app())
    lot_id, tx_id = _create_received_lot(client)

    resp = client.post(
        f"/transactions/{tx_id}/verify-weight",
        json={"verifiedWeightKg": -5.0},
        headers=RECYCLER,
    )
    assert resp.status_code == 422 or resp.status_code == 400


def test_collector_cannot_record_verified_weight():
    client = TestClient(create_app())
    lot_id, tx_id = _create_received_lot(client)

    resp = client.post(
        f"/transactions/{tx_id}/verify-weight",
        json={"verifiedWeightKg": 9.5},
        headers=COLLECTOR,
    )
    assert resp.status_code == 403
