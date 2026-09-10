# API Contract

All endpoints require Supabase JWT authentication unless marked public. The backend maps JWT subject to `profiles`. Errors use `{ "error": { "code": string, "message": string, "details"?: object } }`. Mutating commands accept `Idempotency-Key` where replay is possible.

## AUTH

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | /auth/me | Any | none | profile, role, persona record | 401 | any | none |
| POST | /auth/onboarding/collector | Collector | locality, language, phone | collector profile | 400, 409 | any | none |
| POST | /auth/onboarding/recycler | Recycler | org_name, authorization_id, regions | recycler pending profile | 400, 409 | any | none |

## COLLECTOR

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | /collector/dashboard | Collector | none | active lots, offers, sync hints | 401, 403 | any | none |
| GET | /collector/transactions | Collector | filters | transactions | 401, 403 | any | none |
| GET | /collector/safety-guides | Collector | material_category_id optional | guides | 401 | any | none |

## LOTS

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /lots/drafts | Collector | client_draft_id, title, items, estimated_weight_kg, region_code | lot | 400, 409 | none | DRAFT |
| PUT | /lots/{id}/draft | Collector | editable draft fields | lot | 400, 403, 409 | DRAFT | DRAFT |
| POST | /lots/{id}/evidence | Collector | multipart image, angle_label, capture_source, captured_at | lot_image | 400, 403, 413, 415 | DRAFT, CAPTURED | unchanged |
| POST | /lots/{id}/capture | Collector | item confirmation, image ids | lot | 400, 403, 409 | DRAFT | CAPTURED |
| POST | /lots/{id}/list | Collector | accept_price_range boolean | lot, matches | 400, 403, 409 | VERIFIED | LISTED |
| POST | /lots/{id}/cancel | Collector/Admin | reason | lot | 400, 403, 409 | cancellable states | CANCELLED |
| GET | /lots/{id} | Owner/Recycler/Admin | none | lot detail | 403, 404 | any visible | none |
| GET | /lots/{id}/timeline | Owner/Recycler/Admin | none | trace_events | 403, 404 | any visible | none |

## VERIFICATION

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /lots/{id}/verify | System/Admin | none | verification result | 400, 403, 409 | CAPTURED | VERIFYING then VERIFIED/REJECTED/FLAGGED |
| GET | /lots/{id}/verification | Owner/Recycler/Admin | none | checks, score, explanation | 403, 404 | VERIFYING+ | none |
| POST | /admin/lots/{id}/verification-review | Admin | decision, reason | lot | 400, 403, 409 | FLAGGED, REJECTED | VERIFIED/REJECTED/CANCELLED |

## PRICING

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /lots/{id}/price | Collector/System | none | low, mid, high, explanation | 400, 403, 409 | VERIFIED | none |
| GET | /reference-prices | Any | material, region optional | demo reference prices | 401 | any | none |
| GET | /lots/{id}/price-explanation | Owner/Recycler/Admin | none | formula inputs and adjustments | 403, 404 | VERIFIED+ | none |

## MATCHING

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | /lots/{id}/matches | Collector | none | compatible recyclers | 403, 404, 409 | VERIFIED, LISTED, OFFERS_RECEIVED | none |
| GET | /marketplace/lots | Recycler | filters | listed lots | 403 | LISTED+ | none |
| GET | /marketplace/lots/{id} | Recycler | none | lot inspection data | 403, 404 | LISTED+ | none |

## OFFERS

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /lots/{id}/offers | Recycler | price_total, pickup_window, message | offer | 400, 403, 409 | LISTED, OFFERS_RECEIVED | OFFERS_RECEIVED |
| GET | /lots/{id}/offers | Collector | none | offers | 403, 404 | OFFERS_RECEIVED | none |
| POST | /offers/{id}/accept | Collector | none | transaction, lot | 400, 403, 409 | OFFERS_RECEIVED | OFFER_ACCEPTED |
| POST | /offers/{id}/withdraw | Recycler | reason | offer | 400, 403, 409 | before accepted | none |

## HANDOVER

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /transactions/{id}/handover/schedule | Collector/Recycler | scheduled_at, pickup_address | handover, qr display data | 400, 403, 409 | OFFER_ACCEPTED | HANDOVER_SCHEDULED |
| GET | /transactions/{id}/handover/qr | Collector | none | QR payload | 403, 404 | HANDOVER_SCHEDULED | none |
| POST | /transactions/{id}/handover/confirm-pickup | Recycler | qr_token, location optional | handover, lot | 400, 403, 409 | HANDOVER_SCHEDULED | PICKED_UP |
| POST | /transactions/{id}/handover/in-transit | Recycler/System | none | lot | 403, 409 | PICKED_UP | IN_TRANSIT |
| POST | /transactions/{id}/receive | Recycler | received_at, facility_note | lot | 400, 403, 409 | IN_TRANSIT | RECEIVED |

## TRANSACTIONS

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | /transactions/{id} | Party/Admin | none | transaction detail | 403, 404 | any | none |
| POST | /transactions/{id}/verify-weight | Recycler | verified_weight_kg, variance_reason optional | transaction, lot, final_amount | 400, 403, 409 | RECEIVED | WEIGHT_VERIFIED or FLAGGED |
| POST | /transactions/{id}/dispute | Party/Admin | reason, evidence optional | lot | 400, 403, 409 | active commercial states | DISPUTED |

## PAYMENTS

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /transactions/{id}/payments/simulate | Recycler/System | confirm_demo_payment true | payment, lot | 400, 403, 409 | WEIGHT_VERIFIED | PAYMENT_CONFIRMED |
| GET | /transactions/{id}/payments | Party/Admin | none | payments | 403, 404 | any | none |

## RECYCLING

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /transactions/{id}/processing/start | Recycler | method | lot | 400, 403, 409 | PAYMENT_CONFIRMED | PROCESSING |
| POST | /transactions/{id}/recycling-report | Recycler | method, processed_weight_kg, notes | report | 400, 403, 409 | PROCESSING | unchanged |
| POST | /recycling-reports/{id}/evidence | Recycler | multipart file, evidence_type | evidence, lot | 400, 403, 413, 415 | PROCESSING | RECYCLING_EVIDENCE_ADDED |
| POST | /lots/{id}/close | System/Admin | none | lot | 400, 403, 409 | RECYCLING_EVIDENCE_ADDED | CLOSED |

## ADMIN

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | /admin/dashboard | Admin | filters | metrics, queues | 403 | any | none |
| GET | /admin/recyclers/pending | Admin | none | recyclers | 403 | any | none |
| POST | /admin/recyclers/{id}/authorize | Admin | decision, reason | recycler | 400, 403 | any | none |
| GET | /admin/anomalies | Admin | filters | flagged lots/checks | 403 | FLAGGED/DISPUTED | none |
| GET | /admin/lots/{id}/audit | Admin | none | lot, timeline, checks | 403, 404 | any | none |
| POST | /admin/lots/{id}/resolve-dispute | Admin | decision, reason, target_state | lot | 400, 403, 409 | DISPUTED | allowed resolution state |

## SYNC

| Method | Path | Actor | Request | Response | Errors | Required state | Resulting state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /sync/mutations | Collector | ordered commands with client_mutation_id | per-command ack/failure | 400, 401, 409, 422 | command-specific | command-specific |
| GET | /sync/bootstrap | Collector | since optional | current user lots, server clock | 401 | any | none |

Sync commands wrap the same domain commands above. They do not bypass authorization, validation, or LotTransitionService. Conflict responses include server state, failed command id, and user-facing recovery hint.