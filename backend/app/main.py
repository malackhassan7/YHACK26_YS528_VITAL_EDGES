from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.errors import api_error_handler


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Vital Edges API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )
    app.add_exception_handler(HTTPException, api_error_handler)
    app.include_router(health_router)
    app.include_router(auth_router)
    return app


app = create_app()