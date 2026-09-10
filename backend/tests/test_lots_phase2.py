from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.demo_store import LOTS, TRACE_EVENTS, reset_demo_store

COLLECTOR = {"Authorization": "Bearer demo-token-collector"}
RECYCLER = {"Authorization": "Bearer demo-token-recycler"}


def payload(client_id="local-1"):
    return {
        "clientDraftId": client_id,
        "title": "Mixed phone lot",
        "item": {
            "materialCategoryId": "mat-mobile",
            "quantity": 12,
            "quantityUnit": "pieces",
            "estimatedWeightKg": 8.5,
            "condition": "WORKING",
        },
        "pickup": {"cityArea": "Coimbatore", "pinCode": "641001", "preference": "RECYCLER_PICKUP"},
    }


def evidence():
    return {"localId": "photo-1", "filename": "phone.jpg", "mimeType": "image/jpeg", "sizeBytes": 1200, "angleLabel": "Front view"}


def setup_function():
    reset_demo_store()


def test_collector_can_create_own_draft():
    client = TestClient(create_app())
    response = client.post("/lots/drafts", json=payload(), headers=COLLECTOR)
    assert response.status_code == 200
    assert response.json()["status"] == "DRAFT"
    assert response.json()["collectorId"] == "collector-profile"


def test_wrong_role_cannot_create_collector_draft():
    client = TestClient(create_app())
    response = client.post("/lots/drafts", json=payload(), headers=RECYCLER)
    assert response.status_code == 403


def test_collector_cannot_access_another_collector_lot():
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json=payload(), headers=COLLECTOR).json()
    response = client.get(f"/lots/{created['id']}", headers={"Authorization": "Bearer demo-token-admin"})
    assert response.status_code == 403


def test_incomplete_lot_cannot_transition_to_captured():
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json={"clientDraftId": "local-bad", "title": "Incomplete"}, headers=COLLECTOR).json()
    response = client.post(f"/lots/{created['id']}/capture", headers=COLLECTOR)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INCOMPLETE_LOT"


def test_valid_lot_transitions_draft_to_captured_and_traces():
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json=payload(), headers=COLLECTOR).json()
    client.post(f"/lots/{created['id']}/evidence", json=evidence(), headers=COLLECTOR)
    response = client.post(f"/lots/{created['id']}/capture", headers=COLLECTOR)
    assert response.status_code == 200
    assert response.json()["status"] == "CAPTURED"
    assert any(event.eventType == "LOT_CAPTURED" for event in TRACE_EVENTS)


def test_invalid_direct_transition_is_rejected():
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json=payload(), headers=COLLECTOR).json()
    client.post(f"/lots/{created['id']}/evidence", json=evidence(), headers=COLLECTOR)
    client.post(f"/lots/{created['id']}/capture", headers=COLLECTOR)
    response = client.put(f"/lots/{created['id']}/draft", json=payload(), headers=COLLECTOR)
    assert response.status_code == 409


def test_duplicate_idempotency_request_does_not_create_duplicate_lot():
    client = TestClient(create_app())
    request = {"mutations": [{"mutationId": "m-1", "idempotencyKey": "idem-create-1", "operation": "CREATE_DRAFT", "payload": payload("local-idem")}]}
    first = client.post("/sync/mutations", json=request, headers=COLLECTOR)
    second = client.post("/sync/mutations", json=request, headers=COLLECTOR)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert len(LOTS) == 1


def test_invalid_evidence_upload_is_rejected():
    client = TestClient(create_app())
    created = client.post("/lots/drafts", json=payload(), headers=COLLECTOR).json()
    bad = evidence() | {"mimeType": "application/pdf"}
    response = client.post(f"/lots/{created['id']}/evidence", json=bad, headers=COLLECTOR)
    assert response.status_code == 415