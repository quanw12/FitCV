import json
import html
import re
import time
from collections.abc import Mapping
from urllib import error, request

from app.core.config import settings


class EmailDeliveryError(RuntimeError):
    """Provider failure with an explicit retry classification.

    Resend's idempotency key makes a retry safe, but only transient failures
    should be retried without asking HR to review the message again.
    """

    def __init__(
        self,
        message: str,
        *,
        retryable: bool = True,
        provider_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.provider_status = provider_status


class EmailWebhookVerificationError(RuntimeError):
    pass


MESSAGE_ID_PATTERN = re.compile(r"^<[^<>\r\n]{1,498}>$")


def _safe_message_id(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    return candidate if MESSAGE_ID_PATTERN.fullmatch(candidate) else None


def _safe_references(values: list[str] | None) -> list[str]:
    if not values:
        return []
    references = [_safe_message_id(value) for value in values]
    return list(dict.fromkeys(value for value in references if value))[-20:]


def _resend_request(
    *,
    path: str,
    method: str,
    payload: dict | None = None,
    idempotency_key: str | None = None,
) -> dict:
    if not settings.resend_api_key:
        raise EmailDeliveryError(
            "Email delivery is not configured. Set RESEND_API_KEY."
        )

    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    attempts = max(1, settings.resend_max_retries + 1)

    for attempt in range(attempts):
        resend_request = request.Request(
            f"https://api.resend.com{path}",
            data=data,
            method=method,
            headers=headers,
        )
        try:
            with request.urlopen(
                resend_request, timeout=settings.resend_timeout_seconds
            ) as response:
                raw = response.read().decode("utf-8")
                parsed = json.loads(raw) if raw else {}
                if not isinstance(parsed, dict):
                    raise EmailDeliveryError(
                        "Email provider returned an invalid response.",
                        retryable=False,
                    )
                return parsed
        except error.HTTPError as exc:
            retryable = exc.code in {408, 409, 425, 429} or exc.code >= 500
            if retryable and attempt + 1 < attempts:
                time.sleep(0.25 * (2**attempt))
                continue
            provider_detail = _resend_http_error_detail(exc)
            if provider_detail:
                raise EmailDeliveryError(
                    f"Email provider rejected the request with status {exc.code}: "
                    f"{provider_detail}",
                    retryable=retryable,
                    provider_status=exc.code,
                ) from exc
            raise EmailDeliveryError(
                f"Email provider rejected the request with status {exc.code}.",
                retryable=retryable,
                provider_status=exc.code,
            ) from exc
        except (error.URLError, TimeoutError) as exc:
            if attempt + 1 < attempts:
                time.sleep(0.25 * (2**attempt))
                continue
            raise EmailDeliveryError(
                "Email provider is unavailable. Retry after checking the connection.",
                retryable=True,
            ) from exc
        except (ValueError, TypeError) as exc:
            raise EmailDeliveryError(
                "Email provider returned an invalid response.",
                retryable=False,
            ) from exc

    raise EmailDeliveryError("Email provider is unavailable.", retryable=True)


def _resend_http_error_detail(exc: error.HTTPError) -> str | None:
    """Extract a safe provider message without exposing response headers/secrets."""
    try:
        raw = exc.read().decode("utf-8", errors="replace")
    except Exception:
        return None
    if not raw.strip():
        return None
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError):
        payload = None
    if isinstance(payload, dict):
        for key in ("message", "detail", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()[:600]
    return raw.strip()[:600]


def send_candidate_email(
    *,
    to_email: str,
    subject: str,
    body: str,
    reply_to: str | None = None,
    in_reply_to: str | None = None,
    references: list[str] | None = None,
    idempotency_key: str | None = None,
) -> str:
    if not settings.resend_api_key or not settings.resend_from_email:
        raise EmailDeliveryError(
            "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
            retryable=False,
        )
    escaped_body = html.escape(body).replace("\n", "<br>")
    payload = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": subject,
        "html": f"<div>{escaped_body}</div>",
        "text": body,
    }
    if reply_to:
        payload["reply_to"] = [reply_to]
    message_headers: dict[str, str] = {}
    safe_in_reply_to = _safe_message_id(in_reply_to)
    safe_references = _safe_references(references)
    if safe_in_reply_to:
        message_headers["In-Reply-To"] = safe_in_reply_to
    if safe_references:
        message_headers["References"] = " ".join(safe_references)
    if message_headers:
        payload["headers"] = message_headers

    response_payload = _resend_request(
        path="/emails",
        method="POST",
        payload=payload,
        idempotency_key=idempotency_key,
    )
    message_id = response_payload.get("id")
    if not isinstance(message_id, str) or not message_id:
        raise EmailDeliveryError(
            "Email provider did not return a message ID.", retryable=False
        )
    return message_id


def retrieve_received_email(provider_email_id: str) -> dict:
    return _resend_request(
        path=f"/emails/receiving/{provider_email_id}",
        method="GET",
    )


def verify_resend_webhook(
    payload: bytes,
    headers: Mapping[str, str],
) -> dict:
    if not settings.resend_webhook_secret:
        raise EmailWebhookVerificationError(
            "RESEND_WEBHOOK_SECRET is required."
        )
    try:
        from svix.webhooks import Webhook

        verified = Webhook(settings.resend_webhook_secret).verify(
            payload,
            {
                "svix-id": headers.get("svix-id", ""),
                "svix-timestamp": headers.get("svix-timestamp", ""),
                "svix-signature": headers.get("svix-signature", ""),
            },
        )
    except Exception as exc:
        raise EmailWebhookVerificationError(
            "Invalid email webhook signature."
        ) from exc
    if not isinstance(verified, dict):
        raise EmailWebhookVerificationError("Invalid email webhook payload.")
    return verified


def send_password_reset_code(*, to_email: str, code: str) -> None:
    if not settings.resend_api_key or not settings.resend_from_email:
        print(f"PASSWORD_RESET_CODE for {to_email}: {code}")
        return

    payload = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": "Your FitCV password reset code",
        "html": (
            "<p>You requested a password reset for your FitCV account.</p>"
            f"<p>Your verification code is <strong>{code}</strong>.</p>"
            "<p>This code will expire soon. If you did not request this, you can ignore this email.</p>"
        ),
    }
    data = json.dumps(payload).encode("utf-8")
    resend_request = request.Request(
        "https://api.resend.com/emails",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(resend_request, timeout=10) as response:
            response.read()
    except error.URLError as exc:
        print(f"PASSWORD_RESET_EMAIL_FAILED for {to_email}: {exc}")
