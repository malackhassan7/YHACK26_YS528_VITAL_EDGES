from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    auth_mode: str = "demo"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/vital_edges"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_audience: str = "authenticated"
    # Sprint A: Verification Engine
    ai_classification_enabled: bool = False
    ai_api_key: str = ""
    # Perceptual hash Hamming distance threshold (≤ this = duplicate, per docs/verification-engine.md)
    perceptual_hash_threshold: int = 10
    # Trust score required for automatic VERIFIED transition (medium confidence)
    min_trust_score_for_verified: int = 50

    model_config = SettingsConfigDict(
        env_prefix="VITAL_EDGES_",
        env_file=".env",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()