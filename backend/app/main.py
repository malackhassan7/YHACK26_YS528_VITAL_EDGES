from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.lots import router as lots_router
from app.api.marketplace import router as marketplace_router
from app.api.materials import router as materials_router
from app.api.matching import router as matching_router
from app.api.offers import router as offers_router
from app.api.pricing import router as pricing_router
from app.api.sync import router as sync_router
from app.api.transactions import router as transactions_router
from app.api.verification import router as verification_router
from app.core.config import get_settings
from app.core.errors import api_error_handler


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Vital Edges API", version="0.3.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )
    app.add_exception_handler(HTTPException, api_error_handler)
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(materials_router)
    app.include_router(lots_router)
    app.include_router(sync_router)
    # Sprint A
    app.include_router(verification_router)
    app.include_router(pricing_router)
    app.include_router(matching_router)
    # Sprint B
    app.include_router(marketplace_router)
    app.include_router(offers_router)
    app.include_router(transactions_router)
    return app


app = create_app()