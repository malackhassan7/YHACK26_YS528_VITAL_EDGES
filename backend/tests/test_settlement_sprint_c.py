"""
Sprint C Tests — Payment Confirmation, Processing, Recycling Evidence,
Lot Closure, Collector Earnings, and Traceability.
"""

import pytest
from fastapi.testclient import TestClient

from app.domain.lot_models import (
    LotItem,
    LotRecord,
    LotStatus,
    MaterialCategory,
    MaterialRecoveryItem,
    OfferRecord,
    PickupInfo,
    PickupPreference,
    TransactionRecord,
    TransactionStatus,
)
from app.domain.roles import UserRole
from app.main import create_app
from app.repositories.demo_store import (
    LOTS,
    PAYMENTS,
    PROCESSING_RECORDS,
    RECYCLING_EVIDENCE_RECORDS,
    TRACE_EVENTS,
    TRANSACTIONS,
    reset_demo_store,
    save_lot,
    save_transaction,
)

COLLECTOR_TOKEN = "demo-token-collector"
RECYCLER_TOKEN = "demo-token-recycler"
ADMIN_TOKEN = "demo-token-admin"


@pytest.fixture(autouse=True)
def clean_store():
    reset_demo_store()
    yield
    reset_demo_store()


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def seed_weight_verified_scenario(lot_id="lot-test-1", tx_id="tx-test-1"):
    """Helper to seed a lot and transaction ready at WEIGHT_VERIFIED state."""
    lot = LotRecord(
        id=lot_id,
        humanId="EW-2026-0001",
        collectorId="collector-profile",
        clientDraftId="draft-1",
        title="PCB Boards Lot",
        status=LotStatus.WEIGHT_VERIFIED,
        item=LotItem(
            materialCategoryId="mat-pcb",
            condition="SCRAP",
            quantity=12,
            quantityUnit="kg",
            estimatedWeightKg=12.0,
        ),
        pickup=PickupInfo(
            cityArea="Bangalore",
            pinCode="560001",
            preference=PickupPreference.RECYCLER_PICKUP,
        ),
        evidence=[],
        verifiedWeightKg=11.4,
        finalAmount=5472.0,
        createdAt="2026-09-10T10:00:00Z",
        updatedAt="2026-09-10T10:00:00Z",
    )
    save_lot(lot)

    tx = TransactionRecord(
        id=tx_id,
        lotId=lot_id,
        collectorId="collector-profile",
        recyclerId="recycler-profile",
        recyclerName="GreenLoop Recycler",
        offerId="offer-1",
        agreedPricePerKg=480.0,
        declaredWeightSnapshot=12.0,
        provisionalEstimatedTotal=5760.0,
        verifiedWeightKg=11.4,
        finalAmount=5472.0,
        currency="INR",
        status=TransactionStatus.WEIGHT_VERIFIED,
        acceptedAt="2026-09-10T11:00:00Z",
        isDemo=True,
        createdAt="2026-09-10T11:00:00Z",
        updatedAt="2026-09-10T11:00:00Z",
    )
    save_transaction(tx)
    return lot, tx


class TestSprintCSettlementAndLifecycle:
    def test_confirm_demo_payment_success(self, client):
        seed_weight_verified_scenario()

        headers = {"Authorization": f"Bearer {RECYCLER_TOKEN}"}
        resp = client.post("/transactions/tx-test-1/payment/confirm", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        assert "payment" in data
        assert data["payment"]["amount"] == 5472.0
        assert data["payment"]["status"] == "CONFIRMED"
        assert data["lot"]["status"] == "PAYMENT_CONFIRMED"
        assert data["transaction"]["status"] == "PAYMENT_CONFIRMED"

        # Check trace event was written
        events = [e for e in TRACE_EVENTS if e.lotId == "lot-test-1"]
        assert any(e.eventType == "DEMO_PAYMENT_CONFIRMED" for e in events)

    def test_unauthorized_collector_cannot_confirm_payment(self, client):
        seed_weight_verified_scenario()

        # Collector token should be rejected (403)
        headers = {"Authorization": f"Bearer {COLLECTOR_TOKEN}"}
        resp = client.post("/transactions/tx-test-1/payment/confirm", headers=headers)
        assert resp.status_code == 403

    def test_payment_idempotency(self, client):
        seed_weight_verified_scenario()

        headers = {"Authorization": f"Bearer {RECYCLER_TOKEN}"}
        resp1 = client.post("/transactions/tx-test-1/payment/confirm", headers=headers)
        assert resp1.status_code == 200
        pay_id = resp1.json()["payment"]["id"]

        # Second call returns same payment without error
        resp2 = client.post("/transactions/tx-test-1/payment/confirm", headers=headers)
        assert resp2.status_code == 200
        assert resp2.json()["payment"]["id"] == pay_id

    def test_payment_rejected_before_weight_verified(self, client):
        lot, tx = seed_weight_verified_scenario()
        lot.status = LotStatus.RECEIVED
        tx.status = TransactionStatus.RECEIVED
        save_lot(lot)
        save_transaction(tx)

        headers = {"Authorization": f"Bearer {RECYCLER_TOKEN}"}
        resp = client.post("/transactions/tx-test-1/payment/confirm", headers=headers)
        assert resp.status_code == 409

    def test_start_processing_lifecycle(self, client):
        seed_weight_verified_scenario()
        headers = {"Authorization": f"Bearer {RECYCLER_TOKEN}"}

        # First confirm payment
        client.post("/transactions/tx-test-1/payment/confirm", headers=headers)

        # Start processing
        proc_payload = {
            "facilityName": "GreenLoop Bengaluru Eco-Refinery Unit 1",
            "method": "Hydrometallurgical Separation & Component Dismantling",
            "notes": "Safe automated extraction of precious metals and circuit shredding.",
        }
        resp = client.post("/transactions/tx-test-1/processing/start", json=proc_payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["lot"]["status"] == "PROCESSING"
        assert data["processing"]["facilityName"] == "GreenLoop Bengaluru Eco-Refinery Unit 1"

        events = [e for e in TRACE_EVENTS if e.lotId == "lot-test-1"]
        assert any(e.eventType == "PROCESSING_STARTED" for e in events)

    def test_add_recycling_evidence_and_close_lot(self, client):
        seed_weight_verified_scenario()
        headers = {"Authorization": f"Bearer {RECYCLER_TOKEN}"}

        # Step 1: Payment
        client.post("/transactions/tx-test-1/payment/confirm", headers=headers)

        # Step 2: Processing
        client.post("/transactions/tx-test-1/processing/start", json={
            "facilityName": "GreenLoop Unit 1",
            "method": "Chemical Extraction",
        }, headers=headers)

        # Step 3: Add Recycling Evidence
        evidence_payload = {
            "facilityName": "GreenLoop Unit 1",
            "recoveryBreakdown": [
                {"materialName": "High-Grade Copper", "percentage": 42.0, "recoveredWeightKg": 4.79},
                {"materialName": "Gold / Silver Trace Contacts", "percentage": 4.5, "recoveredWeightKg": 0.51},
                {"materialName": "Engineering Thermoplastics", "percentage": 45.0, "recoveredWeightKg": 5.13},
            ],
            "residualPercentage": 8.5,
            "certificateNumber": "CERT-2026-EW-88941",
            "documentUrl": "https://demo-storage.vitaledges.local/certs/CERT-2026-EW-88941.pdf",
            "notes": "Verified 91.5% material circularity achieved with zero landfill contamination.",
        }
        resp = client.post("/transactions/tx-test-1/recycling-evidence", json=evidence_payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["lot"]["status"] == "RECYCLING_EVIDENCE_ADDED"
        assert data["evidence"]["certificateNumber"] == "CERT-2026-EW-88941"

        # Step 4: Close Lot
        resp_close = client.post("/transactions/tx-test-1/close", headers=headers)
        assert resp_close.status_code == 200
        data_close = resp_close.json()
        assert data_close["lot"]["status"] == "CLOSED"
        assert data_close["transaction"]["status"] == "CLOSED"

        # Verify full lifecycle trace events exist
        events = [e.eventType for e in TRACE_EVENTS if e.lotId == "lot-test-1"]
        assert "DEMO_PAYMENT_CONFIRMED" in events
        assert "PROCESSING_STARTED" in events
        assert "RECYCLING_EVIDENCE_ADDED" in events
        assert "LOT_CLOSED" in events

    def test_collector_earnings_summary(self, client):
        seed_weight_verified_scenario()
        rec_headers = {"Authorization": f"Bearer {RECYCLER_TOKEN}"}
        col_headers = {"Authorization": f"Bearer {COLLECTOR_TOKEN}"}

        # Check before payment (pending)
        resp_pending = client.get("/collector/earnings", headers=col_headers)
        assert resp_pending.status_code == 200
        data_pending = resp_pending.json()
        assert data_pending["completedPayoutsCount"] == 0
        assert data_pending["pendingPayoutsCount"] == 1
        assert data_pending["pendingAmount"] == 5472.0

        # Confirm payment
        client.post("/transactions/tx-test-1/payment/confirm", headers=rec_headers)

        # Check after payment (completed)
        resp_paid = client.get("/collector/earnings", headers=col_headers)
        assert resp_paid.status_code == 200
        data_paid = resp_paid.json()
        assert data_paid["completedPayoutsCount"] == 1
        assert data_paid["totalEarnings"] == 5472.0
        assert data_paid["pendingPayoutsCount"] == 0
        assert len(data_paid["transactions"]) == 1
