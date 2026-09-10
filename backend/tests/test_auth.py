from fastapi.testclient import TestClient

from app.main import create_app


def test_auth_me_returns_known_demo_collector():
    client = TestClient(create_app())
    response = client.get("/auth/me", headers={"Authorization": "Bearer demo-token-collector"})

    assert response.status_code == 200
    assert response.json()["email"] == "collector@demo.local"
    assert response.json()["role"] == "COLLECTOR"


def test_auth_me_rejects_missing_token():
    client = TestClient(create_app())
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_role_guard_rejects_wrong_role():
    client = TestClient(create_app())
    response = client.get("/auth/collector-only", headers={"Authorization": "Bearer demo-token-recycler"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"