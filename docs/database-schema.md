# Database Schema

This schema is normalized enough to preserve auditability but intentionally practical for a 24-hour build. All tables use UUID primary keys, `created_at`, and `updated_at` unless explicitly append-only. Soft deletion is preferred for domain records that may affect audits.

## Core Identity

| Table | Purpose | Key columns | FKs | Indexes / uniqueness | Deletion policy |
| --- | --- | --- | --- | --- | --- |
| profiles | App profile mapped to Supabase user. | id PK, auth_user_id, role, display_name, phone, email, is_demo | auth_user_id -> Supabase Auth | unique auth_user_id, index role | Soft delete only. |
| collectors | Collector persona details. | id PK, profile_id, locality, preferred_language, onboarding_complete | profile_id -> profiles | unique profile_id | Soft delete with profile. |
| recyclers | Recycler organization profile. | id PK, profile_id, org_name, authorization_id, authorization_status, service_regions, pickup_available, is_demo | profile_id -> profiles | unique profile_id, index authorization_status | Soft delete; keep historical offers. |
| recycler_material_capabilities | Recycler accepted materials and limits. | id PK, recycler_id, material_category_id, min_kg, max_kg, price_bias_percent | recycler_id -> recyclers, material_category_id -> material_categories | unique recycler_id+material_category_id | Delete allowed only before offers exist. |

## Reference Data

| Table | Purpose | Key columns | FKs | Indexes / uniqueness | Deletion policy |
| --- | --- | --- | --- | --- | --- |
| material_categories | Controlled material taxonomy. | id PK, code, name, hazard_level, handling_notes, is_demo | none | unique code | Seeded; no hard delete after use. |
| material_reference_prices | Demo/reference pricing inputs. | id PK, material_category_id, region_code, price_per_kg, currency, source_label, effective_from, effective_to, is_demo | material_category_id -> material_categories | index material+region, unique active material+region+effective_from | Append new price versions; do not rewrite used prices. |
| safety_guides | Collector safety instructions. | id PK, material_category_id, title, body, icon, severity | material_category_id -> material_categories | index material_category_id | Soft delete. |

## Lots and Evidence

| Table | Purpose | Key columns | FKs | Indexes / uniqueness | Deletion policy |
| --- | --- | --- | --- | --- | --- |
| lots | Central Digital E-Waste Lot. | id PK, collector_id, status, title, description, estimated_weight_kg, verified_weight_kg, condition_grade, trust_score, fair_low, fair_mid, fair_high, currency, region_code, listed_at, closed_at, client_draft_id, is_demo | collector_id -> collectors | index collector_id, status, unique collector_id+client_draft_id | Soft delete only while DRAFT; otherwise retained. |
| lot_items | Material lines inside a lot. | id PK, lot_id, material_category_id, quantity, quantity_unit, estimated_weight_kg, condition_grade | lot_id -> lots, material_category_id -> material_categories | index lot_id, material_category_id | Cascade only if lot is DRAFT; otherwise retained. |
| lot_images | Uploaded collector evidence. | id PK, lot_id, uploader_profile_id, storage_path, capture_source, angle_label, sha256_hash, perceptual_hash, width, height, bytes, mime_type, captured_at, uploaded_at, metadata_json | lot_id -> lots, uploader_profile_id -> profiles | unique sha256_hash where active, index lot_id, perceptual_hash | Never hard delete after CAPTURED; mark rejected/hidden. |
| verification_checks | Append-only verification observations. | id PK, lot_id, check_type, status, score_delta, result_json, reason, provider, is_fallback | lot_id -> lots | index lot_id+check_type | Append-only. |

## Commercial Workflow

| Table | Purpose | Key columns | FKs | Indexes / uniqueness | Deletion policy |
| --- | --- | --- | --- | --- | --- |
| offers | Recycler offers. | id PK, lot_id, recycler_id, price_total, price_per_kg, currency, pickup_window_start, pickup_window_end, message, status, expires_at, is_demo | lot_id -> lots, recycler_id -> recyclers | index lot_id, recycler_id, unique one ACCEPTED per lot | Retain; mark withdrawn/expired/rejected. |
| transactions | Accepted offer commercial record. | id PK, lot_id, offer_id, collector_id, recycler_id, estimated_amount, final_amount, currency, status, accepted_at | lot_id -> lots, offer_id -> offers, collector_id -> collectors, recycler_id -> recyclers | unique lot_id, unique offer_id | Append/update status; no hard delete. |
| payments | Demo payment records. | id PK, transaction_id, amount, currency, status, provider, provider_ref, is_demo, confirmed_at | transaction_id -> transactions | index transaction_id, unique provider_ref | Append-only for completed payments; failed payments retained. |
| handover_records | Custody transfer proof. | id PK, transaction_id, scheduled_at, pickup_address, qr_token_hash, pickup_confirmed_at, received_at, receiver_profile_id, status | transaction_id -> transactions, receiver_profile_id -> profiles | unique transaction_id, index qr_token_hash | Retain for audit. |

## Traceability and Recycling

| Table | Purpose | Key columns | FKs | Indexes / uniqueness | Deletion policy |
| --- | --- | --- | --- | --- | --- |
| trace_events | Append-only historical timeline. | id PK, lot_id, actor_profile_id, event_type, from_status, to_status, message, payload_json, occurred_at, idempotency_key | lot_id -> lots, actor_profile_id -> profiles nullable | index lot_id+occurred_at, unique lot_id+idempotency_key | Append-only; never rewrite historical truth. |
| recycling_reports | Recycler processing report. | id PK, lot_id, transaction_id, recycler_id, method, processed_weight_kg, residual_weight_kg, notes, submitted_at | lot_id -> lots, transaction_id -> transactions, recycler_id -> recyclers | unique lot_id, index recycler_id | Retain; admin correction creates new audit event. |
| recycling_evidence | Evidence files for recycling report. | id PK, recycling_report_id, storage_path, evidence_type, sha256_hash, mime_type, bytes, captured_at, uploaded_at | recycling_report_id -> recycling_reports | index report_id, unique sha256_hash where active | Retain; hide only with audit reason. |

## Operations

| Table | Purpose | Key columns | FKs | Indexes / uniqueness | Deletion policy |
| --- | --- | --- | --- | --- | --- |
| notifications | In-app notification queue. | id PK, profile_id, type, title, body, read_at, payload_json | profile_id -> profiles | index profile_id+created_at | Hard delete allowed after retention window. |
| sync_mutations | Server idempotency record for offline commands. | id PK, profile_id, client_mutation_id, command_type, request_hash, response_json, status | profile_id -> profiles | unique profile_id+client_mutation_id | Retain through demo; production retention policy. |

## Append-Only Data

`trace_events`, completed `payments`, `verification_checks`, recycling evidence rows, and material reference price versions are append-oriented. Corrections must add new records or audit events rather than mutating historical facts.

## MVP vs Production Extension

MVP may store `service_regions` and payload metadata as JSON/text arrays to move fast. Production can normalize addresses, licenses, compliance documents, invoices, and logistics events after the demo workflow is stable.