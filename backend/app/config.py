from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = "https://wwnkyukqiibbzqqbfsxp.supabase.co"
    # publishable key: public by design (the same one the website uses)
    supabase_anon_key: str = "sb_publishable_WUzn-_25u3USE5u30VyxpA_AZ8-wfkt"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    gemini_fallback_model: str = "gemini-3.1-flash-lite"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    allowed_origins: str = "https://annsetu-inky.vercel.app,http://localhost:8080,http://localhost:8000"
    max_document_bytes: int = 5 * 1024 * 1024

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
