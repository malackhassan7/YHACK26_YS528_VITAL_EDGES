"""
MatchingService — deterministic recycler compatibility ranking.

Uses seeded demo recycler data. All recycler records are clearly labeled
isDemo=True. None of them represent real government-verified entities.

Scoring (max 100):
  Material capability match:  40 pts (required — excludes if missing)
  Demo authorization status:  20 pts
  Geographic proximity score: 15 pts  (deterministic from pin code distance proxy)
  Pickup availability:        10 pts
  Capacity fit:               10 pts
  Reliability rating:          5 pts

Incompatible recyclers (material not in capability list) are excluded.
"""

from __future__ import annotations

from app.core.errors import ApiError
from app.domain.lot_models import LotRecord, LotStatus, RecyclerMatch

# ─── Seeded demo recycler data ────────────────────────────────────────────────
# Clearly labeled synthetic data — not real government-verified recyclers.
# Per AGENTS.md: "Do not represent seeded recycler information as live production data."

_DEMO_RECYCLERS: list[dict] = [
    {
        "id": "rec-001",
        "name": "GreenCycle Recycling",
        "orgName": "GreenCycle Pvt Ltd",
        "authorizationStatus": "demo_authorized",
        "serviceRegions": ["641001", "641002", "641003", "600001", "600002"],
        "pickupAvailable": True,
        "minKg": 1.0,
        "maxKg": 500.0,
        "reliabilityScore": 0.95,
        "contactInfo": "greencycle@demo.local (demo)",
        "materialCapabilities": [
            "mat-mobile", "mat-laptop", "mat-pcb", "mat-cables",
            "mat-charger", "mat-mixed",
        ],
    },
    {
        "id": "rec-002",
        "name": "EcoSafe Processors",
        "orgName": "EcoSafe Processors LLP",
        "authorizationStatus": "demo_authorized",
        "serviceRegions": ["641001", "641004", "641005", "560001"],
        "pickupAvailable": True,
        "minKg": 5.0,
        "maxKg": 1000.0,
        "reliabilityScore": 0.90,
        "contactInfo": "ecosafe@demo.local (demo)",
        "materialCapabilities": [
            "mat-mobile", "mat-laptop", "mat-pcb", "mat-battery",
            "mat-display", "mat-mixed",
        ],
    },
    {
        "id": "rec-003",
        "name": "HazMat Specialists",
        "orgName": "HazMat Recyclers India",
        "authorizationStatus": "demo_authorized",
        "serviceRegions": ["641001", "641002", "400001", "400002"],
        "pickupAvailable": False,
        "minKg": 10.0,
        "maxKg": 2000.0,
        "reliabilityScore": 0.92,
        "contactInfo": "hazmat@demo.local (demo)",
        "materialCapabilities": [
            "mat-battery", "mat-display", "mat-mixed", "mat-cables",
        ],
    },
    {
        "id": "rec-004",
        "name": "CircuitLoop India",
        "orgName": "CircuitLoop Recycling",
        "authorizationStatus": "demo_pending",
        "serviceRegions": ["641001", "641002", "641003"],
        "pickupAvailable": True,
        "minKg": 2.0,
        "maxKg": 300.0,
        "reliabilityScore": 0.78,
        "contactInfo": "circuitloop@demo.local (demo)",
        "materialCapabilities": [
            "mat-pcb", "mat-laptop", "mat-mobile",
        ],
    },
    {
        "id": "rec-005",
        "name": "AllElec Recyclers",
        "orgName": "AllElec Recyclers Pvt Ltd",
        "authorizationStatus": "demo_authorized",
        "serviceRegions": ["641001", "641002", "641003", "641004", "641005",
                           "600001", "560001", "400001"],
        "pickupAvailable": True,
        "minKg": 0.5,
        "maxKg": 5000.0,
        "reliabilityScore": 0.88,
        "contactInfo": "allelec@demo.local (demo)",
        "materialCapabilities": [
            "mat-mobile", "mat-laptop", "mat-pcb", "mat-cables",
            "mat-battery", "mat-charger", "mat-display", "mat-mixed",
        ],
    },
]


def _pin_proximity_score(lot_pin: str | None, recycler_pins: list[str]) -> int:
    """
    Deterministic proximity score (0–15) based on PIN code matching.
    Full match = 15, first 3 digits match = 8, no match = 0.
    """
    if not lot_pin:
        return 5  # default when location unknown
    if lot_pin in recycler_pins:
        return 15
    lot_prefix = lot_pin[:3]
    if any(p[:3] == lot_prefix for p in recycler_pins):
        return 8
    return 0


class MatchingService:
    """
    Ranks compatible demo recyclers for a verified or listed lot.
    Excludes recyclers that cannot handle the lot's material.
    Returns results sorted by matchScore descending.
    """

    def match(self, lot: LotRecord) -> list[RecyclerMatch]:
        if lot.status not in {LotStatus.VERIFIED, LotStatus.LISTED, LotStatus.OFFERS_RECEIVED, LotStatus.FLAGGED}:
            raise ApiError(409, "INVALID_LOT_STATE",
                           f"Recycler matching requires VERIFIED or LISTED lot (current: {lot.status}).")

        material_id = lot.item.materialCategoryId if lot.item else None
        weight_kg = lot.item.estimatedWeightKg if lot.item else 0.0
        lot_pin = lot.pickup.pinCode if lot.pickup else None

        results: list[RecyclerMatch] = []

        for rec in _DEMO_RECYCLERS:
            # Must support the material — incompatible recyclers are excluded entirely
            if material_id and material_id not in rec["materialCapabilities"]:
                continue

            # Must be within capacity bounds
            if weight_kg < rec["minKg"] or weight_kg > rec["maxKg"]:
                continue

            score = 0
            reasons: list[str] = []

            # Material capability: 40 pts
            score += 40
            material_name = material_id.replace("mat-", "").replace("-", " ").title() if material_id else "all materials"
            reasons.append(f"Accepts {material_name}")

            # Authorization: 20 pts
            if rec["authorizationStatus"] == "demo_authorized":
                score += 20
                reasons.append("Demo-authorized recycler")
            else:
                reasons.append("Authorization pending (demo)")

            # Geographic proximity: 15 pts
            prox = _pin_proximity_score(lot_pin, rec["serviceRegions"])
            score += prox
            if prox == 15:
                reasons.append(f"Serves your area ({lot_pin})")
            elif prox == 8:
                reasons.append("Serves nearby districts")
            else:
                reasons.append("Check pickup availability for your region")

            # Pickup availability: 10 pts
            if rec["pickupAvailable"]:
                score += 10
                reasons.append("Pickup available")
            else:
                reasons.append("Drop-off only (no pickup)")

            # Capacity fit: 10 pts (score proportional to how centered weight is in range)
            cap_range = rec["maxKg"] - rec["minKg"]
            if cap_range > 0:
                mid_cap = (rec["minKg"] + rec["maxKg"]) / 2
                fit = max(0.0, 1.0 - abs(weight_kg - mid_cap) / cap_range)
                cap_score = int(fit * 10)
            else:
                cap_score = 10
            score += cap_score
            reasons.append(f"Capacity: {rec['minKg']:.0f}–{rec['maxKg']:.0f} kg")

            # Reliability: 5 pts
            reliability_pts = int(rec["reliabilityScore"] * 5)
            score += reliability_pts
            reasons.append(f"Demo reliability: {rec['reliabilityScore']:.0%}")

            results.append(RecyclerMatch(
                recyclerId=rec["id"],
                name=rec["name"],
                orgName=rec["orgName"],
                matchScore=min(100, score),
                matchReasons=reasons,
                pickupAvailable=rec["pickupAvailable"],
                serviceRegions=rec["serviceRegions"],
                authorizationStatus=rec["authorizationStatus"],
                contactInfo=rec["contactInfo"],
                isDemo=True,
            ))

        # Sort descending by matchScore, then alphabetically for stability
        results.sort(key=lambda r: (-r.matchScore, r.name))
        return results
