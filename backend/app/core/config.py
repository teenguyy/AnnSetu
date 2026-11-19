from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    # Supavisor pooler URL in transaction mode, e.g. postgresql+asyncpg://postgres.ref:pw@host:6543/postgres
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    db_pool_size: int = 10
    db_max_overflow: int = 10

    supabase_url: str | None = None
    # Legacy HS256 secret. When unset, tokens are verified against the project's JWKS (asymmetric keys).
    supabase_jwt_secret: str | None = None
    jwt_audience: str = "authenticated"

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    redis_url: str | None = None
    public_site_url: str = "http://localhost:3000"

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    resend_api_key: str | None = None
    email_from: str = "AnnSetu <no-reply@annsetu.local>"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None

    osrm_url: str = "https://router.project-osrm.org"
    sentry_dsn: str | None = None
    ip_hash_salt: str = "change-me"

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
