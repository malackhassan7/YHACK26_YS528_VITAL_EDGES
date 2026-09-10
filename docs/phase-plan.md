# Phase Plan

Do not start a phase until the previous phase build passes. Visual polish waits until the golden path works.

## Phase 1: Project Foundation and Domain Skeleton

Objective: Create the approved React/Vite and FastAPI structure with strict TypeScript, basic auth shell, migrations, seed data, and domain service skeletons.

Expected files/modules: `frontend/`, `backend/`, `.env.example`, `supabase/migrations/`, `src/services/*`, backend domain services, seed scripts.

Acceptance criteria: App boots; backend healthcheck works; auth session mapping works; migrations create core tables; deterministic seed data loads.

Tests required: backend healthcheck, schema smoke test, auth profile mapping, seed determinism.

Manual QA: login with three demo personas and reach role dashboard shells.

Definition of done: lint, typecheck, tests, and production build pass.

Prerequisites: Phase 0 docs complete.

Blocking risks: Supabase setup delays, auth configuration, environment variable mismatch.

## Phase 2: Lot Drafts, Offline Capture, and Sync

Objective: Implement collector DRAFT creation/editing offline with IndexedDB and idempotent sync.

Expected files/modules: collector draft pages, Dexie stores, sync queue, `/sync/mutations`, lot draft APIs, LotTransitionService DRAFT/CAPTURED transitions.

Acceptance criteria: Collector can create/edit drafts offline, see queue, reconnect, sync, and capture evidence without duplicate server records.

Tests required: IndexedDB queue unit tests, idempotent sync tests, DRAFT -> CAPTURED transition tests.

Manual QA: airplane-mode draft creation and reconnect sync.

Definition of done: golden-path start works on mobile viewport.

Prerequisites: Phase 1.

Blocking risks: file upload while offline, local/server ID reconciliation.

## Phase 3: Verification, Pricing, Listing, and Matching

Objective: Implement deterministic verification score, demo pricing, safety guidance, listing, and recycler matching.

Expected files/modules: VerificationService, PricingService, MatchingService, verification/pricing pages, matching API, material seed data.

Acceptance criteria: Captured lot receives confidence, fair range, safety guidance, and compatible recycler list; AI fallback path works.

Tests required: score formula, duplicate detection, pricing examples, matching ranking, VERIFIED -> LISTED.

Manual QA: high confidence lot lists; low confidence lot blocks or flags correctly.

Definition of done: PROOF, PRICE, and MATCH are demonstrable.

Prerequisites: Phase 2.

Blocking risks: image hash implementation, pHash dependency constraints, unclear category mapping.

## Phase 4: Offers, Transaction, Handover, and Payment

Objective: Complete recycler offer, collector acceptance, transaction creation, QR handover, receipt, weight verification, and simulated payment.

Expected files/modules: OfferService, TransactionService, HandoverService, PaymentService, recycler marketplace pages, offer pages, transaction APIs.

Acceptance criteria: Offer acceptance creates one transaction; QR pickup cannot be replayed; verified weight recalculates final demo amount; payment is labeled demo.

Tests required: offer conflict, accepted-offer locking, handover token, weight variance, payment transition.

Manual QA: execute offer through PAYMENT_CONFIRMED on mobile and desktop.

Definition of done: HANDOVER and PAYOUT are demonstrable.

Prerequisites: Phase 3.

Blocking risks: QR token UX, concurrent offer acceptance, state conflicts.

## Phase 5: Recycling Evidence, Closure, and Admin Audit

Objective: Implement processing, recycling evidence upload, CLOSED state, and admin audit views.

Expected files/modules: RecyclingService, TraceabilityService views, admin audit/anomaly pages, recycling report APIs.

Acceptance criteria: Recycler uploads evidence, lot closes, timeline shows all events, admin can inspect lot and transaction audit.

Tests required: PROCESSING -> RECYCLING_EVIDENCE_ADDED -> CLOSED, immutable CLOSED state, trace event append behavior.

Manual QA: run complete demo script from login through CLOSED.

Definition of done: full golden path passes and traceability is visible.

Prerequisites: Phase 4.

Blocking risks: evidence upload validation, incomplete trace event coverage.

## Phase 6: Accessibility, Reliability, and Demo Polish

Objective: Improve accessibility, error states, loading states, responsive behavior, and judge demo reliability without adding scope.

Expected files/modules: UI state refinements, accessibility labels, demo script fixtures, smoke tests.

Acceptance criteria: No dead CTAs; all async operations show loading/success/failure; collector mobile flow is readable and touch-friendly.

Tests required: golden-path E2E, route inventory smoke test, accessibility checks where tooling supports them.

Manual QA: 4-6 minute timed demo, offline fallback, AI-unavailable fallback.

Definition of done: production build passes and demo script is repeatable.

Prerequisites: Phase 5.

Blocking risks: time pressure, styling regressions, browser permission issues.