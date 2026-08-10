from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings


DATABASE_URL = "sqlite+pysqlite:///:memory:"
VALID_PRODUCTION_SECRET = "fitcv-production-jwt-secret-with-32-plus-characters"
ENV_EXAMPLE_PATH = Path(__file__).resolve().parents[1] / ".env.example"


def test_settings_rejects_missing_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.delenv("jwt_secret_key", raising=False)

    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url=DATABASE_URL,
            environment="dev",
        )


def test_production_rejects_insecure_refresh_cookie() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url=DATABASE_URL,
            jwt_secret_key=VALID_PRODUCTION_SECRET,
            environment="prod",
            refresh_cookie_secure=False,
        )


@pytest.mark.parametrize(
    "jwt_secret_key",
    [
        "short-non-placeholder-secret",
        "change-me-before-production",
    ],
)
def test_production_rejects_weak_jwt_secret(jwt_secret_key: str) -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url=DATABASE_URL,
            jwt_secret_key=jwt_secret_key,
            environment="prod",
            refresh_cookie_secure=True,
        )


def test_env_example_jwt_placeholder_is_rejected_in_production() -> None:
    jwt_line = next(
        line
        for line in ENV_EXAMPLE_PATH.read_text(encoding="utf-8").splitlines()
        if line.startswith("JWT_SECRET_KEY=")
    )
    example_secret = jwt_line.partition("=")[2]

    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url=DATABASE_URL,
            jwt_secret_key=example_secret,
            environment="prod",
            refresh_cookie_secure=True,
        )


def test_production_accepts_strong_secret_and_secure_cookie() -> None:
    configured = Settings(
        _env_file=None,
        database_url=DATABASE_URL,
        jwt_secret_key=VALID_PRODUCTION_SECRET,
        environment="prod",
        refresh_cookie_secure=True,
    )

    assert configured.environment == "prod"
    assert configured.jwt_secret_key == VALID_PRODUCTION_SECRET
    assert configured.refresh_cookie_secure is True


def test_development_allows_insecure_refresh_cookie() -> None:
    configured = Settings(
        _env_file=None,
        database_url=DATABASE_URL,
        jwt_secret_key="local-development-secret",
        environment="dev",
        refresh_cookie_secure=False,
    )

    assert configured.environment == "dev"
    assert configured.refresh_cookie_secure is False
