# Pricing Engine

Pricing is deterministic, explainable, and based on demo/reference data. No displayed value may be labeled as live Indian market pricing unless a real market data integration is later approved and implemented.

## Inputs

- Material category reference price per kg.
- Estimated collector weight before handover.
- Final recycler verified weight after receipt.
- Condition grade: `excellent`, `good`, `mixed`, `poor`, `hazardous`.
- Quantity band.
- Optional region factor from seeded demo data.
- Recycler offer amount.

## Formula

For estimate:

`base = reference_price_per_kg * estimated_weight_kg`

`adjusted_mid = base * condition_factor * quantity_factor * region_factor`

`fair_low = adjusted_mid * 0.85`

`fair_high = adjusted_mid * 1.15`

For final amount after receipt:

`final_amount = accepted_price_per_kg * verified_weight_kg`

Final physical recycler weight is the authoritative commercial weight.

## Factors

| Factor | Demo values |
| --- | --- |
| condition excellent | 1.10 |
| condition good | 1.00 |
| condition mixed | 0.85 |
| condition poor | 0.70 |
| condition hazardous | 0.60 plus safety warning |
| quantity < 5 kg | 0.90 |
| quantity 5-25 kg | 1.00 |
| quantity > 25 kg | 1.05 |
| region default | 1.00 |

## Seed Reference Prices

Example demo/reference prices, clearly labeled in UI:

| Material | Demo reference price |
| --- | --- |
| Mobile phones mixed | INR 180/kg |
| Laptop/desktop boards | INR 260/kg |
| Cables and chargers | INR 120/kg |
| Mixed small appliances | INR 80/kg |
| Batteries hazardous | INR 60/kg |

## Numerical Examples

Example A: 8 kg of mixed mobile phones in good condition.

- Base: 180 * 8 = INR 1,440
- Condition factor: 1.00
- Quantity factor: 1.00
- Region factor: 1.00
- Mid: INR 1,440
- Low/high: INR 1,224 - INR 1,656

Example B: 30 kg of laptop boards in mixed condition.

- Base: 260 * 30 = INR 7,800
- Condition factor: 0.85
- Quantity factor: 1.05
- Mid: INR 6,961.50
- Low/high: INR 5,917 - INR 8,006

## Recycler Offer Comparison

Recycler offers show:

- Offered total and per-kg equivalent.
- Difference from fair mid as percent.
- Whether the offer is below low, within range, or above high.
- Pickup window and recycler compatibility reasons.

Anomaly thresholds:

- Offer below fair_low by more than 25%: warn collector.
- Offer above fair_high by more than 40%: flag for admin/recycler review.
- Verified weight differs from estimated weight by more than 20%: require variance reason and consider FLAGGED/DISPUTED.

## MVP vs Production Extension

MVP uses seeded demo reference prices with visible labels and deterministic formulas. Production could add time-based price feeds, recycler-specific contracts, logistics cost models, tax handling, and compliance fees. Do not add those until the core workflow is complete.