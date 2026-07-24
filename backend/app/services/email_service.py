import json
import html
from urllib import error, request

from app.core.config import settings


class EmailDeliveryError(RuntimeError):
    pass


def send_candidate_email(
    *, to_email: str, subject: str, body: str
) -> str:
    if not settings.resend_api_key or not settings.resend_from_email:
        raise EmailDeliveryError(
            "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
        )
    escaped_body = html.escape(body).replace("\n", "<br>")
    payload = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": subject,
        "html": f"<div>{escaped_body}</div>",
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
        with request.urlopen(resend_request, timeout=15) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise EmailDeliveryError(
            f"Email provider rejected the request with status {exc.code}."
        ) from exc
    except (error.URLError, TimeoutError) as exc:
        raise EmailDeliveryError(
            "Email provider is unavailable. Retry after checking the connection."
        ) from exc
    except (ValueError, TypeError) as exc:
        raise EmailDeliveryError(
            "Email provider returned an invalid response."
        ) from exc
    message_id = response_payload.get("id")
    if not isinstance(message_id, str) or not message_id:
        raise EmailDeliveryError("Email provider did not return a message ID.")
    return message_id


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
