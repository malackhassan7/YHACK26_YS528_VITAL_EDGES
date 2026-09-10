"""
PricingService — deterministic fair-value calculation.

Formula (docs/pricing-engine.md):
  base = reference_price_per_kg * estimated_weight_kg
  adjusted_mid = base * condition_factor * quantity_factor * region_factor
  fair_low = adjusted_mid * 0.85
  fair_high = adjusted_mid * 1.15

Condition mapping from frontend Condition enum → pricing grade:
  WORKING → good (1.00)
  PARTIALLY_WORKING → mixed (0.85)
  NOT_WORKING → poor (0.70)
  DAMAGED → poor (0.70)
  SCRAP → poor (0.70)
  UNKNOWN → mixed (0.85)

All prices are demo/reference. Never labeled as live market data.
"""

from __future__ import annotations

from app.core.errors import ApiError
from app.domain.lot_models import (
    LotRecord,
    LotStatus,
    OfferAnomalyLevel,
    OfferAnomalyResult,
    PriceAdjustment,
    PricingResult,
)

# Demo reference prices per kg (INR), per docs/pricing-engine.md
_REFERENCE_PRICES: dict[str, dict] = {
    "mat-mobile":  {"code": "MOBILE_PHONES",       "name": "Mobile Phones",         "price": 180.0},
    "mat-laptop":  {"code": "LAPTOPS_COMPUTERS",   "name": "Laptops / Computers",   "price": 260.0},
    "mat-pcb":     {"code": "CIRCUIT_BOARDS",       "name": "Circuit Boards / PCB",  "price": 470.0},
    "mat-cables":  {"code": "CABLES_WIRES",         "name": "Cables / Wires",        "price": 120.0},
    "mat-battery": {"code": "BATTERIES",            "name": "Batteries",             "price": 60.0},
    "mat-charger": {"code": "CHARGERS_ADAPTERS",    "name": "Chargers / Adapters",   "price": 100.0},
    "mat-display": {"code": "DISPLAYS_MONITORS",    "name": "Displays / Monitors",   "price": 140.0},
    "mat-mixed":   {"code": "MIXED_ELECTRONICS",    "name": "Mixed Electronics",     "price": 80.0},
}

# Condition grade factors — mapping from frontend Condition enum values
_CONDITION_FACTORS: dict[str, tuple[float, str]] = {
    "WORKING":           (1.00, "good — no adjustment"),
    "PARTIALLY_WORKING": (0.85, "mixed — -15%"),
    "NOT_WORKING":       (0.70, "poor — -30%"),
    "DAMAGED":           (0.70, "poor — -30%"),
    "SCRAP":             (0.70, "poor — -30%"),
    "UNKNOWN":           (0.85, "unknown condition — treated as mixed (-15%)"),
}

# Quantity bands per docs/pricing-engine.md
def _quantity_factor(weight_kg: float) -> tuple[float, str]:
    if weight_kg < 5:
        return (0.90, f"small quantity (<5 kg) — -10%")
    elif weight_kg <= 25:
        return (1.00, f"standard quantity (5–25 kg) — no adjustment")
    else:
        return (1.05, f"bulk quantity (>25 kg) — +5%")


def _region_factor(region_code: str | None) -> tuple[float, str]:
    # MVP: region factor is 1.0 for all regions per docs/pricing-engine.md
    return (1.00, "default region — no adjustment")


class PricingService:
    """
    Authoritative pricing service. All calculations are deterministic.
    Same inputs always produce the same outputs.
    """

    def calculate(
        self,
        lot: LotRecord,
    ) -> PricingResult:
        """Calculate fair-value range for a VERIFIED or FLAGGED lot."""
        if lot.status not in {LotStatus.VERIFIED, LotStatus.LISTED, LotStatus.FLAGGED}:
            raise ApiError(409, "INVALID_LOT_STATE",
                           f"Pricing requires VERIFIED lot (current: {lot.status}).")
        if not lot.item:
            raise ApiError(400, "INCOMPLETE_LOT", "No item details for pricing.")

        material_id = lot.item.materialCategoryId
        ref = _REFERENCE_PRICES.get(material_id)
        if ref is None:
            raise ApiError(400, "INVALID_MATERIAL",
                           f"No reference price for material: {material_id}")

        ref_price = ref["price"]
        weight = lot.item.estimatedWeightKg
        condition = lot.item.condition.value if hasattr(lot.item.condition, "value") else str(lot.item.condition)

        cond_factor, cond_label = _CONDITION_FACTORS.get(condition, (0.85, "unknown — treated as mixed"))
        qty_factor, qty_label = _quantity_factor(weight)
        region_factor, region_label = _region_factor(getattr(lot.pickup, "pinCode", None))

        base = ref_price * weight
        mid = base * cond_factor * qty_factor * region_factor
        low = mid * 0.85
        high = mid * 1.15

        mid_per_kg = mid / weight if weight else mid
        low_per_kg = low / weight if weight else low
        high_per_kg = high / weight if weight else high

        adjustments: list[PriceAdjustment] = []

        if cond_factor != 1.0:
            pct = f"{(cond_factor - 1.0) * 100:+.0f}%"
            adjustments.append(PriceAdjustment(
                label="Condition adjustment", factor=cond_factor,
                percentDisplay=pct, reason=cond_label))

        if qty_factor != 1.0:
            pct = f"{(qty_factor - 1.0) * 100:+.0f}%"
            adjustments.append(PriceAdjustment(
                label="Quantity adjustment", factor=qty_factor,
                percentDisplay=pct, reason=qty_label))

        if region_factor != 1.0:
            pct = f"{(region_factor - 1.0) * 100:+.0f}%"
            adjustments.append(PriceAdjustment(
                label="Regional adjustment", factor=region_factor,
                percentDisplay=pct, reason=region_label))

        return PricingResult(
            lotId=lot.id,
            materialCode=ref["code"],
            materialName=ref["name"],
            referencePrice=ref_price,
            estimatedWeightKg=weight,
            conditionGrade=condition,
            pricePerKgLow=round(low_per_kg, 2),
            pricePerKgMid=round(mid_per_kg, 2),
            pricePerKgHigh=round(high_per_kg, 2),
            lotValueLow=round(low, 2),
            lotValueMid=round(mid, 2),
            lotValueHigh=round(high, 2),
            currency="INR",
            adjustments=adjustments,
        )

    def get_reference_prices(self) -> list[dict]:
        """Return all seeded demo reference prices."""
        return [
            {"materialId": mid, **data, "currency": "INR", "isDemo": True}
            for mid, data in _REFERENCE_PRICES.items()
        ]


# ─── Offer Anomaly Detection ──────────────────────────────────────────────────
# Per docs/pricing-engine.md anomaly thresholds.
# Unit-tested now; used by Sprint B offer validation.

def calculate_offer_anomaly(fair_mid: float, offer_amount: float) -> OfferAnomalyResult:
    """
    Classify a recycler offer relative to the fair-value midpoint.

    Thresholds per docs/pricing-engine.md:
    - Below fair_low by >25%  → VERY_LOW
    - Within -25% to fair_low → LOW
    - fair_low to fair_high   → NORMAL
    - Above fair_high by <40% → HIGH
    - Above fair_high by >40% → VERY_HIGH
    """
    if fair_mid <= 0:
        raise ValueError("fair_mid must be positive")

    deviation = (offer_amount - fair_mid) / fair_mid  # negative = below mid
    pct = round(deviation * 100, 1)

    fair_low = fair_mid * 0.85
    fair_high = fair_mid * 1.15

    if offer_amount < fair_low * 0.75:  # more than 25% below fair_low
        level = OfferAnomalyLevel.VERY_LOW
        msg = f"Unusually low compared with the demo/reference fair-value range ({pct:+.1f}% vs mid)."
    elif offer_amount < fair_low:
        level = OfferAnomalyLevel.LOW
        msg = f"Below the demo/reference fair-value range ({pct:+.1f}% vs mid)."
    elif offer_amount <= fair_high:
        level = OfferAnomalyLevel.NORMAL
        msg = f"Within the expected demo/reference fair-value range ({pct:+.1f}% vs mid)."
    elif offer_amount <= fair_high * 1.40:
        level = OfferAnomalyLevel.HIGH
        msg = f"Above the expected demo/reference fair-value range ({pct:+.1f}% vs mid)."
    else:
        level = OfferAnomalyLevel.VERY_HIGH
        msg = f"Unusually high compared with the demo/reference fair-value range ({pct:+.1f}% vs mid)."

    return OfferAnomalyResult(
        fairMid=fair_mid,
        offerAmount=offer_amount,
        deviationPercent=pct,
        anomalyLevel=level,
        message=msg,
    )
