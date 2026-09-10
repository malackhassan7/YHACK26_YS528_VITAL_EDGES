"""
Sprint A: Pricing Engine Tests

Tests per spec:
- Deterministic same-input result
- Condition adjustment (excellent / poor)
- Quantity adjustment (< 5 kg, > 25 kg)
- fair_low < fair_mid < fair_high ordering always
- Lot total calculation
- Anomaly classification: NORMAL, LOW, VERY_LOW, HIGH, VERY_HIGH
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.demo_store import reset_demo_store
from app.services.pricing_service import PricingService, calculate_offer_anomaly
from app.domain.lot_models import LotRecord, LotStatus, LotItem, PickupInfo, OfferAnomalyLevel

COLLECTOR = {"Authorization": "Bearer demo-token-collector"}


def _make_verified_lot(material="mat-mobile", weight=8.0, condition="WORKING", qty=10):
    """Create a LotRecord in VERIFIED state for unit testing."""
    return LotRecord(
        id="lot-price-test",
        humanId="EW-0001",
        collectorId="collector-profile",
        clientDraftId="d1",
        title="Test",
        status=LotStatus.VERIFIED,
        item=LotItem(
            materialCategoryId=material,
            quantity=qty,
            quantityUnit="pieces",
            estimatedWeightKg=weight,
            condition=condition,  # type: ignore[arg-type]
        ),
        pickup=PickupInfo(cityArea="Coimbatore", pinCode="641001", preference="RECYCLER_PICKUP"),  # type: ignore[arg-type]
        evidence=[],
        createdAt="2026-01-01T00:00:00+00:00",
        updatedAt="2026-01-01T00:00:00+00:00",
    )


def setup_function():
    reset_demo_store()


# ── Determinism ───────────────────────────────────────────────────────────────

def test_pricing_is_deterministic():
    """Same inputs always produce identical output (no randomness)."""
    service = PricingService()
    lot = _make_verified_lot("mat-mobile", 8.0, "WORKING")

    r1 = service.calculate(lot)
    r2 = service.calculate(lot)

    assert r1.lotValueMid == r2.lotValueMid
    assert r1.pricePerKgMid == r2.pricePerKgMid
    assert r1.lotValueLow == r2.lotValueLow
    assert r1.lotValueHigh == r2.lotValueHigh


# ── Ordering ──────────────────────────────────────────────────────────────────

def test_fair_low_less_than_mid_less_than_high():
    """fair_low < fair_mid < fair_high must always hold."""
    service = PricingService()
    for material in ["mat-mobile", "mat-pcb", "mat-battery", "mat-cables"]:
        for condition in ["WORKING", "PARTIALLY_WORKING", "NOT_WORKING", "SCRAP"]:
            lot = _make_verified_lot(material, 10.0, condition)
            r = service.calculate(lot)
            assert r.lotValueLow < r.lotValueMid, f"{material}/{condition}: low not < mid"
            assert r.lotValueMid < r.lotValueHigh, f"{material}/{condition}: mid not < high"


# ── Condition adjustments ─────────────────────────────────────────────────────

def test_working_condition_no_adjustment():
    """WORKING condition → condition factor 1.0 → mid = base."""
    service = PricingService()
    lot = _make_verified_lot("mat-mobile", 8.0, "WORKING")
    r = service.calculate(lot)
    # base = 180 * 8 = 1440, qty factor = 1.0 (5-25 kg), so mid = 1440
    assert abs(r.lotValueMid - 1440.0) < 0.01


def test_scrap_condition_reduces_price():
    """SCRAP condition → factor 0.70 → mid substantially less than WORKING."""
    service = PricingService()
    working = service.calculate(_make_verified_lot("mat-mobile", 8.0, "WORKING"))
    scrap   = service.calculate(_make_verified_lot("mat-mobile", 8.0, "SCRAP"))
    assert scrap.lotValueMid < working.lotValueMid
    # Factor 0.70: scrap.mid ≈ working.mid * 0.70
    assert abs(scrap.lotValueMid - working.lotValueMid * 0.70) < 0.1


def test_partially_working_condition_reduces_price():
    """PARTIALLY_WORKING → factor 0.85."""
    service = PricingService()
    working  = service.calculate(_make_verified_lot("mat-mobile", 8.0, "WORKING"))
    partial  = service.calculate(_make_verified_lot("mat-mobile", 8.0, "PARTIALLY_WORKING"))
    assert abs(partial.lotValueMid - working.lotValueMid * 0.85) < 0.1


# ── Quantity adjustments ──────────────────────────────────────────────────────

def test_small_quantity_reduces_price():
    """< 5 kg → factor 0.90."""
    service = PricingService()
    small   = service.calculate(_make_verified_lot("mat-mobile", 3.0, "WORKING", qty=5))
    standard = service.calculate(_make_verified_lot("mat-mobile", 10.0, "WORKING", qty=10))
    # Normalize per kg to compare just the quantity factor effect
    assert small.pricePerKgMid < standard.pricePerKgMid


def test_bulk_quantity_increases_price():
    """≥ 25 kg → factor 1.05."""
    service = PricingService()
    bulk    = service.calculate(_make_verified_lot("mat-mobile", 30.0, "WORKING", qty=80))
    standard = service.calculate(_make_verified_lot("mat-mobile", 10.0, "WORKING", qty=25))
    assert bulk.pricePerKgMid > standard.pricePerKgMid


# ── Lot total calculation ────────────────────────────────────────────────────

def test_lot_value_equals_price_per_kg_times_weight():
    """lotValueMid ≈ pricePerKgMid × estimatedWeightKg."""
    service = PricingService()
    lot = _make_verified_lot("mat-pcb", 12.0, "WORKING")
    r = service.calculate(lot)
    assert abs(r.lotValueMid - r.pricePerKgMid * 12.0) < 0.1


def test_pricing_requires_verified_state():
    """Pricing must fail for non-VERIFIED lots."""
    service = PricingService()
    lot = _make_verified_lot("mat-mobile", 8.0)
    lot.status = LotStatus.CAPTURED
    with pytest.raises(Exception) as exc:
        service.calculate(lot)
    assert "INVALID_LOT_STATE" in str(exc.value) or "409" in str(exc.value)


# ── API integration ───────────────────────────────────────────────────────────

def test_price_api_returns_breakdown():
    """POST /lots/{id}/price returns full breakdown including adjustments."""
    client = TestClient(create_app())

    # Create, capture, verify, then price
    payload = {
        "clientDraftId": "price-api-1",
        "title": "Mobile Lot",
        "item": {"materialCategoryId": "mat-mobile", "quantity": 10,
                 "quantityUnit": "pieces", "estimatedWeightKg": 8.0, "condition": "WORKING"},
        "pickup": {"cityArea": "Coimbatore", "pinCode": "641001", "preference": "RECYCLER_PICKUP"},
    }
    created = client.post("/lots/drafts", json=payload, headers=COLLECTOR).json()
    lot_id = created["id"]
    client.post(f"/lots/{lot_id}/evidence",
                json={"localId": "p1", "filename": "f.jpg", "mimeType": "image/jpeg",
                      "sizeBytes": 120000, "angleLabel": "Front view"}, headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/capture", headers=COLLECTOR)
    client.post(f"/lots/{lot_id}/verify", headers=COLLECTOR)

    resp = client.post(f"/lots/{lot_id}/price", headers=COLLECTOR)
    assert resp.status_code == 200
    data = resp.json()
    assert "lotValueLow" in data
    assert "lotValueMid" in data
    assert "lotValueHigh" in data
    assert data["lotValueLow"] < data["lotValueMid"] < data["lotValueHigh"]
    assert data["isDemo"] is True
    assert "disclaimer" in data


# ── Offer anomaly detection ───────────────────────────────────────────────────

def test_anomaly_normal_within_range():
    result = calculate_offer_anomaly(fair_mid=1000.0, offer_amount=1000.0)
    assert result.anomalyLevel == OfferAnomalyLevel.NORMAL


def test_anomaly_low_below_fair_low():
    """Offer below fair_low (mid*0.85=850) but above VERY_LOW threshold (850*0.75=637.5) → LOW."""
    # 820 < 850 (fair_low) and 820 > 637.5 (very_low threshold)
    result = calculate_offer_anomaly(fair_mid=1000.0, offer_amount=820.0)
    assert result.anomalyLevel == OfferAnomalyLevel.LOW


def test_anomaly_very_low_extreme():
    """Offer more than 25% below fair_low → VERY_LOW."""
    result = calculate_offer_anomaly(fair_mid=1000.0, offer_amount=600.0)
    assert result.anomalyLevel == OfferAnomalyLevel.VERY_LOW


def test_anomaly_high_above_fair_high():
    """Offer above fair_high (mid * 1.15 = 1150) but below 40% → HIGH."""
    result = calculate_offer_anomaly(fair_mid=1000.0, offer_amount=1300.0)
    assert result.anomalyLevel == OfferAnomalyLevel.HIGH


def test_anomaly_very_high_extreme():
    """Offer more than 40% above fair_high → VERY_HIGH."""
    result = calculate_offer_anomaly(fair_mid=1000.0, offer_amount=1700.0)
    assert result.anomalyLevel == OfferAnomalyLevel.VERY_HIGH


def test_anomaly_boundary_within_range_high_end():
    """Offer exactly at fair_high → NORMAL."""
    result = calculate_offer_anomaly(fair_mid=1000.0, offer_amount=1150.0)
    assert result.anomalyLevel == OfferAnomalyLevel.NORMAL


def test_anomaly_deviation_percent_accuracy():
    """Deviation percent should reflect actual difference."""
    result = calculate_offer_anomaly(fair_mid=1000.0, offer_amount=900.0)
    assert result.deviationPercent == -10.0
