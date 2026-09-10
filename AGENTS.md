# Repository Guidelines

## Project Mission

Build a formal e-waste collection and recycling platform for a 24-hour hackathon. The system should help collectors create verified digital e-waste lots, match them with recyclers, coordinate handover, simulate payout, and preserve traceability through recycling evidence.

## Priority Order

1. End-to-end working demo
2. Correct domain workflow
3. Reliability
4. Accessibility
5. Visual polish
6. Optional sophistication

Never sacrifice a working existing workflow for an optional feature.

## Repository Structure

`Problem Statement/` contains source brief material and presentation assets. Do not mix generated code, notes, or build outputs into that folder.

As implementation is added, prefer `src/` for application code, `tests/` or colocated test files for automated tests, `assets/` for static assets, and `docs/` for architecture decisions. Keep the repository root limited to project configuration, entry-point docs, and workspace files.

Authoritative planning documents should live in `docs/`, including `architecture.md`, `state-machine.md`, `database-schema.md`, `api-contract.md`, `page-inventory.md`, `verification-engine.md`, `pricing-engine.md`, and `demo-script.md` when those areas are defined.

## Before Making Changes

Before implementing any task:

1. Read this `AGENTS.md`.
2. Inspect relevant existing code before editing.
3. Read applicable files under `docs/`.
4. Check existing dependencies before adding another library.
5. Run or inspect tests relevant to the area being changed.
6. Preserve existing working workflows unless the task explicitly requires changing them.
7. Do not reinitialize, replace, or restructure the project merely because another architecture would also work.

## Approved Technology Stack

The approved implementation stack is intentionally small and stable.

Frontend:
- React
- TypeScript with strict mode
- Vite
- React Router
- Tailwind CSS
- shadcn/ui where useful
- TanStack Query for server state
- React Hook Form + Zod for forms and validation
- Dexie / IndexedDB for offline drafts and sync queue
- react-i18next for localization
- Recharts for dashboard charts

Backend:
- Python
- FastAPI
- Pydantic
- SQLAlchemy
- pytest

Data and infrastructure:
- Supabase PostgreSQL
- Supabase Storage
- Supabase Auth
- version-controlled SQL migrations

Verification:
- SHA-256 for exact duplicate detection
- perceptual hashing for visually similar duplicate detection
- OpenCV/ImageHash where appropriate
- AI image classification behind a replaceable adapter

Deployment:
- Vercel for frontend
- Render or Railway for backend
- Supabase for database/auth/storage

Do not substitute frameworks, databases, authentication systems,
or major infrastructure components without explicit approval.

Prefer existing dependencies over introducing alternatives.

External AI services must be optional. The core golden path must remain
demonstrable with deterministic fallback behavior if an AI service is
unavailable.

## Development Commands

Actual Phase 1 commands:

```sh
cd frontend
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

```sh
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
pytest
python -c "from app.main import create_app; create_app(); print('backend import ok')"
```

Commands must run from the shown directories unless noted otherwise. Prefer project scripts over long one-off commands. Commit lockfiles when package dependencies are introduced.
## Architectural Invariants

The central domain entity is the Digital E-Waste Lot.

The primary product journey is:

`PROOF -> PRICE -> MATCH -> HANDOVER -> PAYOUT -> PROOF OF RECYCLING`

Do not bypass the lot domain model for convenience. All lot lifecycle changes must go through the centralized lot transition service. UI components must never directly mutate lifecycle status.

Pricing calculations must live in the pricing domain service. Recycler compatibility calculations must live in the matching service. Verification and trust-score calculations must live in the verification service.

Traceability events must be append-oriented. Do not rewrite historical events to represent a later state. Final physical recycler weight is the authoritative commercial weight. Uploaded-image verification produces confidence, not proof of authenticity.

External AI services are optional dependencies. Failure of an AI service must not prevent the core demo workflow. Do not represent seeded recycler, pricing, payment, authorization, government, or market information as live production data. Demo and synthetic information must be identifiable as demo data.

## Lot Lifecycle

Standard states:

`DRAFT`, `CAPTURED`, `VERIFYING`, `VERIFIED`, `LISTED`, `OFFERS_RECEIVED`, `OFFER_ACCEPTED`, `HANDOVER_SCHEDULED`, `PICKED_UP`, `IN_TRANSIT`, `RECEIVED`, `WEIGHT_VERIFIED`, `PAYMENT_CONFIRMED`, `PROCESSING`, `RECYCLING_EVIDENCE_ADDED`, `CLOSED`

Exceptional states:

`FLAGGED`, `REJECTED`, `CANCELLED`, `DISPUTED`

The authoritative allowed transition graph belongs in `docs/state-machine.md`. Production code and tests must conform to that document. Do not introduce a new lifecycle state or transition without first updating the state-machine documentation.

## Golden Path

The release-critical workflow is:

Collector login -> create lot -> capture/add evidence -> obtain verification confidence -> classify material -> calculate fair-value range -> list lot -> show compatible recyclers -> recycler reviews lot -> recycler submits offer -> collector accepts offer -> transaction is created -> handover is scheduled -> QR handover is confirmed -> recycler receives lot -> recycler records verified weight -> final amount is calculated -> demo payment is confirmed -> recycler records processing -> recycling evidence is uploaded -> lot becomes `CLOSED` -> complete traceability timeline is visible.

Any defect preventing this workflow is P0. A feature not required for this workflow cannot take priority over a P0 defect.

## Persona / UX Rules

Collector users may have low digital literacy, use mobile devices, and experience unreliable connectivity. Collector screens need large touch targets, simple language, strong icons, minimum typing, explicit progress, and no dense tables.

Recycler users work on desktop and mobile and need material quality, quantity, evidence, price, and pickup information. Admin users need authorization, anomaly review, and auditability. Recycler and admin screens may use richer dashboards when the golden path remains intact.

## Offline Requirements

Collector draft creation must work offline. Use IndexedDB and a visible sync queue. Offline states must be obvious, and failed sync operations must offer clear retry behavior.

## Verification Rules

Never claim image authenticity is guaranteed. Verification combines live capture, e-waste classification, SHA-256 duplicate detection, perceptual duplicate detection, multi-angle evidence, plausibility, and final physical weight verification. Call the result a confidence or trust score.

## Pricing Rules

Fair-value calculations must be deterministic and explainable. Never label arbitrary generated numbers as live market prices.

## Payments / Demo Data Rules

Use test or simulated payments for hackathon operation. Clearly label them as demo transactions. Use deterministic seed data and never present seeded market, government, recycler, authorization, or payment information as production data.

## Coding Conventions

No TODO placeholders in user-facing workflows. No fake navigation buttons. Every visible primary CTA must work. No dead routes. Never silently swallow errors. Every asynchronous operation must have loading, success, and failure states.

Keep components reasonably small. Put domain logic in services, not UI components. Use descriptive names and consistent formatting. Use lowercase, hyphenated names for general folders and assets unless preserving official source filenames. Use `PascalCase` for UI components and `camelCase` for TypeScript variables and functions.

## Testing Requirements

Add tests with the first production code. Tests should cover lifecycle transitions, pricing determinism, verification scoring, offline draft behavior, sync queue behavior, and the golden path.

Name tests after the unit or workflow under test, such as `lot-transition.test.ts`, `pricing.service.test.ts`, or `CollectorGoldenPath.spec.ts`. Run or update relevant tests whenever behavior changes.

## Security / Configuration

Do not commit credentials, API keys, private datasets, or local environment files. Maintain `.env.example` with safe placeholder values for every required environment variable. Database migrations must be version controlled.

## Scope Protection

The following are out of scope unless explicitly requested after the golden-path workflow is complete:

- blockchain
- cryptocurrency
- carbon-credit marketplace
- native Android rewrite
- microservices
- Kafka or message brokers
- Kubernetes
- social features
- chatbot
- advanced auction systems
- predictive ML pricing
- production payment settlement
- complex EPR accounting
- speculative AI features

Do not implement optional sophistication while any core workflow is broken.

## Phase Completion Gate

After each phase:

1. Run lint.
2. Run typecheck.
3. Run tests.
4. Run production build.
5. Report changed files.
6. Report unresolved failures.
7. Do not begin the next phase unless the build passes.

## Commit / PR Guidance

This directory does not currently expose Git history, so no existing commit convention can be inferred. Use concise, imperative commit messages such as `Add lot transition service` or `Fix offline draft sync`.

Pull requests should include a short summary, testing notes, linked issues or tasks, and screenshots or recordings for UI changes. Keep PRs focused so reviewers can evaluate behavior and risk quickly.

## Source of Truth

When specifications conflict, use this authority order:

1. AGENTS.md — permanent project and engineering constraints
2. docs/state-machine.md — lot lifecycle and valid transitions
3. docs/database-schema.md — persisted domain model
4. docs/api-contract.md — frontend/backend interface
5. feature-specific architecture documents
6. implementation code
7. comments and temporary notes

Do not silently resolve contradictions.

If implementation requires changing an authoritative document,
update the document deliberately before or together with the code.

Tests must validate the documented behavior rather than redefine
product behavior accidentally.