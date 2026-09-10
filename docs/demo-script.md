# Demo Script

## Demo Accounts

| Persona | Email | Password | Purpose |
| --- | --- | --- | --- |
| Collector | collector.demo@vitaledges.test | DemoPass123! | Creates and closes one lot. |
| Recycler | recycler.demo@vitaledges.test | DemoPass123! | Reviews, offers, receives, and processes lot. |
| Admin | admin.demo@vitaledges.test | DemoPass123! | Shows auditability and anomaly queue. |

All accounts and data are demo/synthetic.

## Seeded Lot

Collector story: Meena, an informal collector, has gathered 8 kg of mixed mobile phones and chargers from a neighborhood repair lane. She wants a fair, traceable handoff to an authorized recycler.

Expected values:

- Material: Mobile phones mixed
- Estimated weight: 8 kg
- Condition: good
- Demo reference price: INR 180/kg
- Fair range: INR 1,224 - INR 1,656, mid INR 1,440
- Recycler offer: INR 1,520 total
- Verified recycler weight: 7.6 kg
- Final demo payment: INR 1,444 if accepted price is INR 190/kg
- Confidence: HIGH, 82/100 with three angles and no duplicates

## 4-6 Minute Flow

1. Collector login as Meena. Screen: `/login` then `/collector`.
2. Create lot. Screen: `/collector/lots/new`; enter mobile phones, good condition, 8 kg.
3. Add evidence. Screen: `/collector/lots/:id/evidence`; upload/capture front, back, and scale/context images.
4. Classification and verification. Screen: `/collector/lots/:id/classification`; show confidence score and explain it is not proof of authenticity.
5. Price. Screen: `/collector/lots/:id/price`; show demo reference formula and fair range.
6. List lot. Screen: `/collector/lots/:id/review`; status becomes LISTED.
7. Matches. Screen: `/collector/lots/:id/matches`; show recycler compatibility reasons.
8. Recycler login. Screen: `/recycler/marketplace`; inspect listed lot and evidence.
9. Submit offer. Screen: `/recycler/lots/:id/offer`; offer INR 1,520 with pickup window.
10. Collector accepts. Screen: `/collector/lots/:id/offers`; transaction is created.
11. Schedule handover and show QR. Screen: `/collector/transactions/:id/handover`.
12. Recycler confirms pickup with QR. Screen: `/recycler/transactions/:id/handover`; status moves PICKED_UP then IN_TRANSIT.
13. Recycler receives and verifies weight. Screens: handover/receipt and `/recycler/transactions/:id/weight`; enter 7.6 kg.
14. Simulate payment. Screen: `/recycler/transactions/:id/payment`; clearly label as demo payment.
15. Start processing and upload recycling evidence. Screens: processing and recycling evidence.
16. Close lot. Screen: traceability timeline; lot becomes CLOSED and all events are visible.
17. Admin audit. Screen: `/admin/lots/:id/audit`; show immutable timeline, checks, payment, and evidence.

## Fallbacks

If AI is unavailable, show fallback verification: image quality, SHA-256, pHash, manual category confirmation, multi-angle evidence, and plausibility. Confidence may still be HIGH or MEDIUM if deterministic checks pass.

If internet/external APIs are unavailable, use seeded demo data, local uploads, simulated payment, and deterministic matching. Supabase/backend must still be reachable for the live demo; otherwise use local dev environment seeded state.

## Likely Judge Objections

1. "Can an uploaded image prove authenticity?" Answer: No. The product deliberately says confidence/trust score, combines duplicate detection and multi-angle evidence, and makes recycler physical weight authoritative.
2. "Are these real market prices?" Answer: No. They are visible demo reference prices with deterministic formulas; the app avoids claiming live market data.
3. "What prevents informal collectors from being excluded?" Answer: Mobile-first collector UX, minimum typing, offline draft creation, safety guidance, and visible progress reduce friction while still routing material to authorized recyclers.