import logging
import secrets
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services import auth_service, email_service


RESET_EMAIL = "student@example.com"
RESET_CODE = "123456"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _disable_resend(monkeypatch: pytest.MonkeyPatch, *, environment: str) -> None:
    monkeypatch.setattr(settings, "environment", environment)
    monkeypatch.setattr(settings, "resend_api_key", None)
    monkeypatch.setattr(settings, "resend_from_email", None)


def test_development_logs_password_reset_code(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    _disable_resend(monkeypatch, environment="dev")
    caplog.set_level(logging.WARNING, logger="app.services.email_service")

    with patch("builtins.print"):
        email_service.send_password_reset_code(
            to_email=RESET_EMAIL,
            code=RESET_CODE,
        )

    messages = [record.getMessage() for record in caplog.records]
    assert messages == [f"PASSWORD_RESET_CODE for {RESET_EMAIL}: {RESET_CODE}"]


def test_development_password_reset_fallback_does_not_print(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_resend(monkeypatch, environment="dev")

    with patch("builtins.print") as print_mock:
        email_service.send_password_reset_code(
            to_email=RESET_EMAIL,
            code=RESET_CODE,
        )

    print_mock.assert_not_called()


@pytest.mark.parametrize(
    ("resend_api_key", "resend_from_email"),
    [
        (None, None),
        (None, "FitCV <noreply@example.com>"),
        ("re_test", None),
    ],
)
def test_production_missing_resend_fails_without_exposing_reset_code(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    resend_api_key: str | None,
    resend_from_email: str | None,
) -> None:
    monkeypatch.setattr(settings, "environment", "prod")
    monkeypatch.setattr(settings, "resend_api_key", resend_api_key)
    monkeypatch.setattr(settings, "resend_from_email", resend_from_email)
    caplog.set_level(logging.WARNING, logger="app.services.email_service")

    with patch("builtins.print") as print_mock:
        with pytest.raises(RuntimeError) as raised:
            email_service.send_password_reset_code(
                to_email=RESET_EMAIL,
                code=RESET_CODE,
            )

    assert RESET_CODE not in str(raised.value)
    assert raised.value.retryable is False
    assert caplog.records == []
    print_mock.assert_not_called()


def test_production_checks_email_configuration_before_account_lookup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _disable_resend(monkeypatch, environment="prod")

    with patch("app.services.auth_service.get_account_by_email") as account_lookup:
        with pytest.raises(email_service.EmailDeliveryError):
            auth_service.start_password_reset(object(), email=RESET_EMAIL)

    account_lookup.assert_not_called()


def test_password_reset_provider_failure_logs_no_reset_details(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(settings, "environment", "prod")
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "resend_from_email", "FitCV <noreply@example.com>")
    caplog.set_level(logging.WARNING, logger="app.services.email_service")

    with (
        patch(
            "app.services.email_service._resend_request",
            side_effect=email_service.EmailDeliveryError("Provider unavailable."),
        ),
        patch("builtins.print") as print_mock,
    ):
        email_service.send_password_reset_code(
            to_email=RESET_EMAIL,
            code=RESET_CODE,
        )

    assert [record.getMessage() for record in caplog.records] == [
        "Password reset email delivery failed."
    ]
    assert RESET_EMAIL not in caplog.text
    assert RESET_CODE not in caplog.text
    print_mock.assert_not_called()


def _reset_account(*, reset_token_hash: str) -> SimpleNamespace:
    return SimpleNamespace(
        reset_token_hash=reset_token_hash,
        reset_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )


def test_valid_reset_code_uses_constant_time_hash_comparison() -> None:
    expected_hash = auth_service._hash_reset_code(RESET_EMAIL, RESET_CODE)
    account = _reset_account(reset_token_hash=expected_hash)

    with (
        patch("app.services.auth_service.get_account_by_email", return_value=account),
        patch(
            "app.services.auth_service.compare_digest",
            wraps=secrets.compare_digest,
            create=True,
        ) as compare_digest,
    ):
        selected = auth_service._get_valid_reset_account(
            object(),
            email=RESET_EMAIL,
            code=RESET_CODE,
        )

    assert selected is account
    compare_digest.assert_called_once_with(account.reset_token_hash, expected_hash)


def test_invalid_reset_code_still_uses_constant_time_hash_comparison() -> None:
    expected_hash = auth_service._hash_reset_code(RESET_EMAIL, RESET_CODE)
    account = _reset_account(reset_token_hash="0" * len(expected_hash))

    with (
        patch("app.services.auth_service.get_account_by_email", return_value=account),
        patch(
            "app.services.auth_service.compare_digest",
            wraps=secrets.compare_digest,
            create=True,
        ) as compare_digest,
    ):
        with pytest.raises(HTTPException) as rejected:
            auth_service._get_valid_reset_account(
                object(),
                email=RESET_EMAIL,
                code=RESET_CODE,
            )

    assert rejected.value.status_code == 400
    compare_digest.assert_called_once_with(account.reset_token_hash, expected_hash)


@pytest.mark.parametrize(
    "account",
    [
        None,
        SimpleNamespace(
            reset_token_hash=None,
            reset_token_expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        ),
        SimpleNamespace(
            reset_token_hash=auth_service._hash_reset_code(RESET_EMAIL, RESET_CODE),
            reset_token_expires_at=None,
        ),
    ],
)
def test_incomplete_reset_state_returns_generic_validation_error(account) -> None:
    with patch("app.services.auth_service.get_account_by_email", return_value=account):
        with pytest.raises(HTTPException) as rejected:
            auth_service._get_valid_reset_account(
                object(),
                email=RESET_EMAIL,
                code=RESET_CODE,
            )

    assert rejected.value.status_code == 400
    assert rejected.value.detail == "Verification code is invalid or expired."


@pytest.mark.parametrize(
    "path",
    [
        "backend/debug.log",
        "tmp/fitcv-security-test.log",
    ],
)
def test_repository_ignores_log_files(path: str) -> None:
    checked = subprocess.run(
        ["git", "check-ignore", "--quiet", "--no-index", path],
        cwd=REPOSITORY_ROOT,
        check=False,
    )

    assert checked.returncode == 0, f"Expected Git to ignore {path}"
