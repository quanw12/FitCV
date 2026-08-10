from pathlib import Path
from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
INSECURE_JWT_SECRET = "change-me-before-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["dev", "prod"] = "dev"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    session_idle_timeout_minutes: int = 60
    refresh_cookie_name: str = "fitcv_refresh"
    refresh_cookie_secure: bool = False
    reset_token_expire_minutes: int = 30
    google_client_id: str | None = None
    resend_api_key: str | None = None
    resend_from_email: str | None = None
    resend_webhook_secret: str | None = None
    resend_inbound_domain: str | None = None
    resend_timeout_seconds: float = 15.0
    resend_max_retries: int = 2
    avatar_storage: str = "local"
    backend_public_url: str | None = None
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.6-flash"
    gemini_thinking_level: Literal["minimal", "low", "medium", "high"] = "high"
    gemini_timeout_seconds: float = 90.0
    gemini_max_retries: int = 2
    ocr_provider: str = "gemini"
    ocr_model: str = ""
    ocr_timeout_seconds: float = 120.0
    ocr_max_output_tokens: int = 20_000
    improvement_task_stale_minutes: int = 10
    ai_worker_enabled: bool = True
    ai_worker_poll_seconds: float = 1.0
    ai_worker_lease_seconds: int = 1800
    ai_worker_heartbeat_seconds: int = 30
    ai_task_max_attempts: int = 3
    improvement_max_cv_chars: int = 120_000
    improvement_max_jd_chars: int = 60_000
    analyzer_provider: str = "deterministic"
    upload_dir: Path = BACKEND_ROOT / "uploads"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://fit-cv.vercel.app",
    ]

    @property
    def inbound_replies_enabled(self) -> bool:
        domain = (self.resend_inbound_domain or "").strip().lstrip("@")
        return bool(domain and "." in domain)

    @model_validator(mode="after")
    def validate_production_security(self) -> Self:
        if self.environment != "prod":
            return self

        if not self.refresh_cookie_secure:
            raise ValueError(
                "REFRESH_COOKIE_SECURE must be true when ENVIRONMENT=prod."
            )

        jwt_secret = self.jwt_secret_key.strip()
        if len(jwt_secret) < 32 or jwt_secret == INSECURE_JWT_SECRET:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters and must not use "
                "the default placeholder when ENVIRONMENT=prod."
            )

        return self


settings = Settings()
