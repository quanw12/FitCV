import json
from urllib import error, request

from app.core.config import settings


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
