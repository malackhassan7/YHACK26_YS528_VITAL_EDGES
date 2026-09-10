# Digital Lot State Machine

All lifecycle changes must go through LotTransitionService. API routes issue domain commands; no route, UI component, seed helper, or test may assign `lots.status` directly except controlled fixture setup documented in tests. `CLOSED` is immutable except administrative audit metadata that does not change commercial or lifecycle facts.

## Actors

- Collector: owns the lot before handover and accepts recycler offers.
- Recycler: authorized buyer that receives, weighs, processes, and uploads recycling evidence.
- Admin: reviews anomalies, disputes, cancellations, and recycler authorization.
- System: backend service action such as verification, pricing, matching, sync, or timeout.

## Transition Matrix

| From | Allowed To |
| --- | --- |
| DRAFT | CAPTURED, CANCELLED |
| CAPTURED | VERIFYING, FLAGGED, CANCELLED |
| VERIFYING | VERIFIED, REJECTED, FLAGGED |
| VERIFIED | LISTED, REJECTED, FLAGGED |
| LISTED | OFFERS_RECEIVED, CANCELLED, FLAGGED |
| OFFERS_RECEIVED | OFFER_ACCEPTED, CANCELLED, DISPUTED, FLAGGED |
| OFFER_ACCEPTED | HANDOVER_SCHEDULED, CANCELLED, DISPUTED |
| HANDOVER_SCHEDULED | PICKED_UP, CANCELLED, DISPUTED |
| PICKED_UP | IN_TRANSIT, DISPUTED |
| IN_TRANSIT | RECEIVED, DISPUTED |
| RECEIVED | WEIGHT_VERIFIED, DISPUTED, FLAGGED |
| WEIGHT_VERIFIED | PAYMENT_CONFIRMED, DISPUTED |
| PAYMENT_CONFIRMED | PROCESSING, DISPUTED |
| PROCESSING | RECYCLING_EVIDENCE_ADDED, DISPUTED |
| RECYCLING_EVIDENCE_ADDED | CLOSED, DISPUTED |
| CLOSED | none |
| FLAGGED | VERIFYING, VERIFIED, LISTED, REJECTED, CANCELLED, DISPUTED |
| REJECTED | DRAFT, CANCELLED |
| CANCELLED | none |
| DISPUTED | HANDOVER_SCHEDULED, RECEIVED, WEIGHT_VERIFIED, PAYMENT_CONFIRMED, CANCELLED, CLOSED |

## State Definitions

| State | Meaning | Actor | Incoming | Outgoing | Preconditions | Side effects | Trace event | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DRAFT | Collector-created lot not yet submitted; may be local-only offline. | Collector | REJECTED | CAPTURED, CANCELLED | Collector owns draft; required minimal fields available before capture. | Save editable draft; queue sync if offline. | LOT_DRAFT_CREATED or LOT_DRAFT_UPDATED | Validation errors remain editable; sync errors stay queued. |
| CAPTURED | Evidence has been attached and submitted for verification. | Collector | DRAFT | VERIFYING, FLAGGED, CANCELLED | At least one image; category/quantity draft present; upload accepted. | Store image rows and hashes; request verification. | LOT_CAPTURED | Upload/hash failure returns explicit error and keeps DRAFT. |
| VERIFYING | Backend is calculating confidence. | System | CAPTURED, FLAGGED | VERIFIED, REJECTED, FLAGGED | Images accessible; verification job idempotency key valid. | Create verification_checks; compute score. | VERIFICATION_STARTED | Job failure marks check failed and leaves retry command. |
| VERIFIED | Confidence is sufficient or manual/admin review approved. | System/Admin | VERIFYING, FLAGGED | LISTED, REJECTED, FLAGGED | Trust score meets threshold or admin override recorded. | Store trust score and explanation. | LOT_VERIFIED | Low confidence moves to REJECTED or FLAGGED with reason. |
| LISTED | Lot is visible to compatible recyclers. | Collector/System | VERIFIED, FLAGGED | OFFERS_RECEIVED, CANCELLED, FLAGGED | Fair price range calculated; owner confirms listing. | Publish marketplace record; compute matches. | LOT_LISTED | Pricing/matching failure blocks listing with reason. |
| OFFERS_RECEIVED | One or more active recycler offers exist. | Recycler/System | LISTED | OFFER_ACCEPTED, CANCELLED, DISPUTED, FLAGGED | Recycler authorized and capable; offer within allowed rules. | Notify collector; expire stale offers later. | OFFER_RECEIVED | Invalid offer rejected; lot stays LISTED/OFFERS_RECEIVED. |
| OFFER_ACCEPTED | Collector accepted exactly one active offer. | Collector | OFFERS_RECEIVED | HANDOVER_SCHEDULED, CANCELLED, DISPUTED | Offer active; collector owns lot; no accepted offer exists. | Lock competing offers; create transaction. | OFFER_ACCEPTED | Conflict returns 409; no partial transaction. |
| HANDOVER_SCHEDULED | Pickup/handover details and QR token exist. | Collector/Recycler | OFFER_ACCEPTED, DISPUTED | PICKED_UP, CANCELLED, DISPUTED | Transaction exists; schedule window and place confirmed. | Create handover_record and QR challenge. | HANDOVER_SCHEDULED | Invalid schedule leaves OFFER_ACCEPTED. |
| PICKED_UP | Collector QR handover has been confirmed. | Recycler/Collector | HANDOVER_SCHEDULED | IN_TRANSIT, DISPUTED | QR token valid; actor authorized; handover not expired. | Mark pickup time; transfer custody to recycler in transit. | LOT_PICKED_UP | Bad QR or replay returns 403/409. |
| IN_TRANSIT | Lot is moving to recycler facility. | Recycler/System | PICKED_UP | RECEIVED, DISPUTED | Pickup confirmed. | Optional ETA notification. | LOT_IN_TRANSIT | Missing custody record blocks transition. |
| RECEIVED | Recycler facility has received the lot. | Recycler | IN_TRANSIT, DISPUTED | WEIGHT_VERIFIED, DISPUTED, FLAGGED | Recycler owns accepted transaction; receipt location recorded. | Create receipt record. | LOT_RECEIVED | Unauthorized receipt rejected. |
| WEIGHT_VERIFIED | Final physical commercial weight is recorded. | Recycler | RECEIVED, DISPUTED | PAYMENT_CONFIRMED, DISPUTED | Positive measured weight; variance reason if outside threshold. | Recalculate final amount; flag anomalies. | WEIGHT_VERIFIED | Invalid or anomalous weight may move FLAGGED/DISPUTED. |
| PAYMENT_CONFIRMED | Demo payment has been recorded. | System/Recycler | WEIGHT_VERIFIED, DISPUTED | PROCESSING, DISPUTED | Final amount exists; payment marked demo/test. | Create payment row and notification. | DEMO_PAYMENT_CONFIRMED | Payment simulation failure leaves WEIGHT_VERIFIED. |
| PROCESSING | Recycler has started formal processing. | Recycler | PAYMENT_CONFIRMED | RECYCLING_EVIDENCE_ADDED, DISPUTED | Payment confirmed; recycler authorized. | Start processing record. | PROCESSING_STARTED | Unauthorized processing rejected. |
| RECYCLING_EVIDENCE_ADDED | Recycler uploaded recycling evidence. | Recycler | PROCESSING | CLOSED, DISPUTED | Evidence file accepted; report details complete. | Store report/evidence rows. | RECYCLING_EVIDENCE_ADDED | Upload validation failure keeps PROCESSING. |
| CLOSED | Golden path complete with visible timeline. | System/Admin | RECYCLING_EVIDENCE_ADDED, DISPUTED | none | Required trace events, payment, verified weight, and evidence exist. | Mark closed_at; freeze lifecycle. | LOT_CLOSED | Missing artifact blocks close with explicit error. |
| FLAGGED | System/admin found anomaly requiring review. | System/Admin | CAPTURED, VERIFYING, VERIFIED, LISTED, OFFERS_RECEIVED, RECEIVED | VERIFYING, VERIFIED, LISTED, REJECTED, CANCELLED, DISPUTED | Reason code and reviewer path required. | Notify admin; pause risky actions. | LOT_FLAGGED | Missing reason rejected. |
| REJECTED | Verification or policy failure prevents listing. | System/Admin | VERIFYING, VERIFIED, FLAGGED | DRAFT, CANCELLED | Rejection reason recorded. | Notify collector with plain-language reason. | LOT_REJECTED | Can only reopen as DRAFT for correction. |
| CANCELLED | Lot workflow intentionally ended before completion. | Collector/Admin/System | DRAFT, CAPTURED, LISTED, OFFERS_RECEIVED, OFFER_ACCEPTED, HANDOVER_SCHEDULED, FLAGGED, REJECTED, DISPUTED | none | No completed pickup unless admin dispute resolution cancels. | Release offers; notify affected actors. | LOT_CANCELLED | Post-pickup cancellation normally requires DISPUTED. |
| DISPUTED | Commercial, custody, or evidence disagreement exists. | Collector/Recycler/Admin | OFFERS_RECEIVED, OFFER_ACCEPTED, HANDOVER_SCHEDULED, PICKED_UP, IN_TRANSIT, RECEIVED, WEIGHT_VERIFIED, PAYMENT_CONFIRMED, PROCESSING, RECYCLING_EVIDENCE_ADDED, FLAGGED | HANDOVER_SCHEDULED, RECEIVED, WEIGHT_VERIFIED, PAYMENT_CONFIRMED, CANCELLED, CLOSED | Dispute reason and initiator required. | Freeze affected actions; notify admin. | LOT_DISPUTED | Resolution requires admin action and audit note. |

## Command Rules

- Use explicit commands such as `submit_capture`, `start_verification`, `list_lot`, `accept_offer`, `schedule_handover`, `confirm_pickup`, `receive_lot`, `verify_weight`, `confirm_demo_payment`, `start_processing`, `add_recycling_evidence`, and `close_lot`.
- Every transition appends one trace_events row in the same transaction.
- Idempotent commands must return the existing result when replayed with the same idempotency key.
- Permission, state, and precondition failures return explicit errors and do not partially mutate state.