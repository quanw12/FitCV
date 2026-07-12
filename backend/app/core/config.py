from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    jwt_secret_key: str = "change-me-before-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    reset_token_expire_minutes: int = 30
    google_client_id: str | None = None
    resend_api_key: str | None = None
    resend_from_email: str | None = None
    improvement_provider: str = "fixture"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


settings = Settings()
