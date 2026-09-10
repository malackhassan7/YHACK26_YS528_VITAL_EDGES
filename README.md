# Vital Edges

Vital Edges is a 24-hour hackathon platform foundation for formal e-waste collection and recycling workflows. Phase 1 establishes a runnable React/Vite frontend, FastAPI backend, role-aware demo authentication, migrations, seed data, and tests.

## Prerequisites

- Node.js 24+
- npm 12+
- Python 3.11+
- Supabase project for later integrated development

## Environment

Copy `.env.example` to local environment files as needed. Keep secrets out of Git.

Frontend variables use the `VITE_` prefix:

```sh
VITE_API_BASE_URL=http://localhost:8000
VITE_AUTH_MODE=demo
```

Backend variables use `VITAL_EDGES_` where applicable:

```sh
VITAL_EDGES_AUTH_MODE=demo
VITAL_EDGES_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Demo auth is explicitly for local hackathon development and is not production Supabase authentication.

## Demo Accounts

All demo users use password `DemoPass123!`.

| Role | Email |
| --- | --- |
| Collector | collector@demo.local |
| Recycler | recycler@demo.local |
| Admin | admin@demo.local |

## Frontend

```sh
cd frontend
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

The frontend runs at `http://127.0.0.1:5173` by default and calls the backend at `VITE_API_BASE_URL`.

## Backend

Install dependencies in your preferred Python environment:

```sh
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
pytest
python -c "from app.main import create_app; create_app(); print('backend import ok')"
```

The backend exposes `GET /health` at `http://127.0.0.1:8000/health`.

## Database

Version-controlled Supabase SQL lives in `supabase/migrations/`. Deterministic demo seed data lives in `supabase/seed/`.

Apply migrations and seeds through the Supabase SQL editor or CLI during integration. Seed data is synthetic and must not be represented as live recycler, government, payment, or market data.