from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import get_db
from app.main import app


@pytest.fixture
def auth_client():
    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = lambda: None
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)


def test_production_rejects_auth_write_without_origin(
    auth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: non-browser clients cannot bypass the production CSRF guard."""
    monkeypatch.setattr(settings, "environment", "prod")

    response = auth_client.post("/api/auth/logout")

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "Request origin is not allowed."


def test_production_allows_auth_write_from_allowed_origin(
    auth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "environment", "prod")

    with (
        patch(
            "app.api.routes.auth.auth_rate_limit.consume",
            return_value="forgot-password-rate-key",
        ),
        patch(
            "app.api.routes.auth.auth_service.start_password_reset",
            return_value="If the email exists, a verification code will be sent.",
        ),
    ):
        response = auth_client.post(
            "/api/auth/forgot-password",
            json={"email": "student@example.com"},
            headers={"Origin": settings.cors_origins[0]},
        )

    assert response.status_code == 200, response.text


def test_development_allows_auth_write_without_origin(
    auth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "environment", "dev")

    response = auth_client.post("/api/auth/logout")

    assert response.status_code == 204, response.text


@pytest.mark.parametrize("origin", ["https://attacker.invalid", "null", " "])
@pytest.mark.parametrize("environment", ["dev", "prod"])
def test_present_disallowed_origin_is_always_rejected(
    auth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    environment: str,
    origin: str,
) -> None:
    monkeypatch.setattr(settings, "environment", environment)

    response = auth_client.post(
        "/api/auth/logout",
        headers={"Origin": origin},
    )

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "Request origin is not allowed."
