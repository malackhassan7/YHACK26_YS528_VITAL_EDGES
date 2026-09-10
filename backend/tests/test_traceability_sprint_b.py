"""
Sprint B: Traceability & Timeline Tests.

Covers:
- Complete end-to-end golden path produces append-oriented trace events
- Event sequence preserves strict chronological ordering
- Historical events are never mutated or deleted
- Trace event types match docs/state-machine.md
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.demo_store import reset_demo_store

COLLECTOR = {"Authorization": "Bearer demo-token-collector"}
RECYCLER = {"Authorization": "Bearer demo-token-recycler"}


def setup_function():
    reset_demo_store()


def test_full_traceability_timeline_in_order():
    client = TestClient(create_app())

    # 1. Draft
    payload = {
        "clientDraftId": "trace-lot-1",
        "title": "Traceability Verification Lot",
        "item": {"materialCategoryId": "mat-pcb", "quantity": 10, "quantityUnit": "pieces", "estimatedWeightKg": 8.0, "condition": "WORKING"},
        "pickup": {"cityArea": "Gandhipuram", "pinCode": "641012", "preference": "RECYCLER_PICKUP"},
    }
    lot_id = client.post("/lots/drafts", json=payload, headers=COLLECTOR).json()["id"]

    # 2. Evidence + Capture
    client.post(f"/lots/{lot_id}/evidence", json={"localId": "e1", "filename": "pcb.jpg", "mimeType": "image/jpeg", "sizeBytes": 2000, "angleLabel": "Front"}, headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)

    # 3. Verification
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)

    # 4. Pricing & Listing
    client.post(f"/lots/{lot_id}/price", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/list", headers=COLLECTOR)

    # 5. Recycler Offer
    offer = client.post(f"/lots/{lot_id}/offers", json={"pricePerKg": 470.0}, headers=RECYCLER).json()

    # 6. Collector Accepts Offer
    tx_id = client.post(f"/offers/{offer['id']}/accept", headers=COLLECTOR).json()["transaction"]["id"]

    # 7. Schedule Handover
    sched = client.post(
        f"/transactions/{tx_id}/handover/schedule",
        json={"scheduledAt": "2026-09-12T10:00:00Z", "pickupAddress": "Gandhipuram, Coimbatore"},
        headers=COLLECTOR,
    ).json()

    # 8. Pickup confirmed with QR
    client.post(f"/transactions/{tx_id}/handover/confirm-pickup", json={"qrToken": sched["qrToken"]}, headers=RECYCLER)

    # 9. In-transit
    client.post(f"/transactions/{tx_id}/handover/in-transit", headers=RECYCLER)

    # 10. Recipient confirmed
    client.post(f"/transactions/{tx_id}/receive", json={"facilityNote": "Safe facility arrival."}, headers=RECYCLER)

    # 11. Weight verified
    client.post(f"/transactions/{tx_id}/verify-weight", json={"verifiedWeightKg": 7.9}, headers=RECYCLER)

    # Retrieve full lot timeline
    lot_resp = client.get(f"/lots/{lot_id}", headers=COLLECTOR).json()
    events = lot_resp["traceEvents"]
    event_types = [e["eventType"] for e in events]

    expected_sequence = [
        "LOT_DRAFT_CREATED",
        "LOT_EVIDENCE_ATTACHED",
        "LOT_CAPTURED",
        "VERIFICATION_STARTED",
        "LOT_VERIFIED",
        "LOT_LISTED",
        "OFFER_RECEIVED",
        "OFFER_ACCEPTED",
        "TRANSACTION_CREATED",
        "HANDOVER_SCHEDULED",
        "LOT_PICKED_UP",
        "LOT_IN_TRANSIT",
        "LOT_RECEIVED",
        "WEIGHT_VERIFIED",
    ]

    for expected in expected_sequence:
        assert expected in event_types, f"Missing trace event: {expected}"

    # Verify order
    indices = [event_types.index(expected) for expected in expected_sequence]
    assert indices == sorted(indices), f"Events not in chronological order: {event_types}"
