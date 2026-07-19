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
    avatar_storage: str = "local"
    backend_public_url: str | None = None
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.1-flash-lite"
    gemini_timeout_seconds: float = 30.0
    gemini_max_retries: int = 2
    ocr_provider: str = "gemini"
    ocr_model: str = ""
    ocr_timeout_seconds: float = 60.0
    ocr_max_output_tokens: int = 20_000
    improvement_task_stale_minutes: int = 10
    improvement_max_cv_chars: int = 120_000
    improvement_max_jd_chars: int = 60_000
    analyzer_provider: str = "deterministic"
    upload_dir: Path = BACKEND_ROOT / "uploads"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://fit-cv.vercel.app",
    ]


settings = Settings()
