# Page Inventory

Every primary CTA must work. Every page must have loading, empty, and failure states where applicable. Collector pages are mobile-first; recycler and admin pages must work on desktop and mobile.

## Collector Pages

| Page | Route | Purpose | Main data | Primary CTA | Secondary CTA | States | Layout expectations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication | /login | Sign in demo users. | Supabase session, demo account shortcuts | Sign in | Choose demo persona | Loading auth, invalid login, offline warning | Large buttons; clear demo labels. |
| Onboarding | /collector/onboarding | Capture simple collector setup. | profile, collector | Continue | Change language | Loading profile, missing fields, save failure | Minimal typing; large touch targets. |
| Dashboard | /collector | Show current lots and next actions. | active lots, offers, sync queue | Create lot | View transactions | Loading cards, no lots, API failure, offline | Card list, not table. |
| Create Lot Wizard | /collector/lots/new | Create/edit draft lot. | local/server draft, material categories | Save draft | Back dashboard | Offline save success, validation errors, sync pending | Stepper with explicit progress. |
| Evidence Capture | /collector/lots/:id/evidence | Add live/gallery images. | lot, local images, upload status | Add evidence | Retake/remove | Camera unavailable, upload failed, offline queued | Big camera/upload controls. |
| Classification Confirmation | /collector/lots/:id/classification | Confirm material category. | verification hints, categories | Confirm category | Edit evidence | Loading classification, low confidence, AI unavailable | Simple names and icons. |
| Quantity / Weight | /collector/lots/:id/quantity | Enter estimated quantity and condition. | lot_items, safety guide | Continue | Save draft | Invalid weight, offline saved | Numeric controls; no dense forms. |
| Fair-Value Explanation | /collector/lots/:id/price | Show deterministic range. | fair low/mid/high, explanation | Continue to list | Edit details | Pricing loading, missing price, failure | Plain formula explanation. |
| Safety Guidance | /collector/lots/:id/safety | Show handling warnings. | material safety guide | I understand | Back | No guide, loading, failure | Strong icons, short text. |
| Review / List | /collector/lots/:id/review | Final listing confirmation. | lot, images, score, price | List lot | Edit lot | Missing evidence, state conflict, failure | Summary cards. |
| Recycler Matches | /collector/lots/:id/matches | Show compatible recyclers. | ranked recycler matches | View offers | Refresh matches | No matches, loading, failure | Simple list with reason chips. |
| Offers | /collector/lots/:id/offers | Compare recycler offers. | offers, price range | Accept offer | Message/cancel lot | No offers, expired offers, conflict | Offers as cards; explain demo prices. |
| Lot Details | /collector/lots/:id | Inspect lot status and actions. | lot, timeline, transaction | Continue next step | View timeline | Not found, unauthorized, stale state | Status progress prominent. |
| QR Handover | /collector/transactions/:id/handover | Show QR for pickup. | handover record, QR token | Show QR | Reschedule/contact recycler | Expired QR, no schedule, failure | Bright QR, pickup details. |
| Transactions | /collector/transactions | List accepted/completed transactions. | transactions | Open transaction | Dashboard | No transactions, loading, failure | Card list. |
| Traceability | /collector/lots/:id/timeline | Show proof trail. | trace_events | View certificate summary | Back | Empty timeline impossible, loading, failure | Vertical timeline. |
| Offline / Sync Status | /collector/sync | Explain pending local work. | IndexedDB queue, server sync status | Retry sync | View draft | All synced, sync failed, offline | Visible queue with clear retry. |

## Recycler Pages

| Page | Route | Purpose | Main data | Primary CTA | Secondary CTA | States | Layout expectations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | /recycler | Show marketplace and accepted work. | stats, accepted lots, pending actions | Browse marketplace | View accepted lots | Loading, no actions, failure | Responsive dashboard. |
| Marketplace | /recycler/marketplace | Find listed lots. | listed lots, filters | Inspect lot | Filter/sort | No lots, loading, failure | Desktop table or mobile cards. |
| Lot Inspection | /recycler/lots/:id | Review lot quality and price. | lot, score, price, images, items | Make offer | Back marketplace | Not compatible, unavailable, failure | Evidence and explanation visible. |
| Evidence Inspection | /recycler/lots/:id/evidence | Inspect images/checks. | images, verification checks | Make offer | Flag anomaly | Image loading, missing image, failure | Zoomable gallery. |
| Offer Form | /recycler/lots/:id/offer | Submit explicit offer. | price range, pickup windows | Submit offer | Cancel | Validation errors, expired lot, failure | Numeric price inputs; demo labels. |
| Accepted Lots | /recycler/accepted | Manage accepted/pickup lots. | transactions | Open handover | Marketplace | No accepted lots, loading, failure | Action-focused list. |
| Handover / Receipt | /recycler/transactions/:id/handover | Scan QR and confirm pickup/receipt. | handover, transaction | Confirm pickup/receipt | Report issue | Bad QR, expired QR, offline warning | Camera/QR input prominent. |
| Weight Verification | /recycler/transactions/:id/weight | Enter physical weight. | transaction, lot, expected weight | Verify weight | Dispute | High variance warning, validation failure | Clear final-weight authority note. |
| Payment Confirmation | /recycler/transactions/:id/payment | Simulate payment. | final amount, demo payment status | Confirm demo payment | View transaction | Payment failure, already paid | Clearly marked demo transaction. |
| Processing | /recycler/transactions/:id/processing | Record recycling processing start. | transaction, method options | Start processing | Back | Missing payment, failure | Simple operational form. |
| Recycling Evidence | /recycler/transactions/:id/recycling | Upload recycling proof. | report, evidence files | Upload evidence | Save report | Upload failure, missing report | Evidence gallery and report form. |

## Admin Pages

| Page | Route | Purpose | Main data | Primary CTA | Secondary CTA | States | Layout expectations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | /admin | Show queues and anomalies. | pending recyclers, flagged lots, disputes | Review anomalies | Review recyclers | Empty queues, loading, failure | Dense but readable dashboard. |
| Recycler Verification | /admin/recyclers | Authorize recycler accounts. | recycler profiles, documents/ids | Approve/reject | Open details | No pending, loading, failure | Table desktop, cards mobile. |
| Anomaly Review | /admin/anomalies | Resolve flags and disputes. | flagged lots, checks, reasons | Resolve | Open audit | No anomalies, loading, failure | Prioritized queue. |
| Lot Audit | /admin/lots/:id/audit | Inspect lifecycle and evidence. | lot, timeline, checks, images | Add audit note / resolve | Back | Not found, unauthorized, failure | Trace timeline first. |
| Transaction Audit | /admin/transactions/:id/audit | Inspect commercial trail. | transaction, offer, payment, handover | Resolve dispute | View lot audit | No dispute, loading, failure | Commercial facts and trace events. |

## Navigation Rules

- Role-based dashboards are the only landing destinations after login.
- Each terminal state page links to traceability and dashboard.
- State-specific CTAs must be hidden or disabled with explanation when preconditions fail.
- Recycler/admin desktop density is acceptable; collector density is not.