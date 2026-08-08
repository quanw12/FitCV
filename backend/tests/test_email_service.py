import base64
from datetime import datetime, timezone
from io import BytesIO
import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

from svix.webhooks import Webhook

from app.core.config import settings
from app.services.email_service import (
    EmailDeliveryError,
    send_candidate_email,
    verify_resend_webhook,
)


class EmailServiceTests(unittest.TestCase):
    def test_verifies_resend_webhook_from_raw_body(self) -> None:
        secret = "whsec_" + base64.b64encode(
            b"fitcv-resend-webhook-test-secret"
        ).decode("ascii")
        payload = json.dumps(
            {
                "type": "email.delivered",
                "data": {"email_id": "email-123"},
            },
            separators=(",", ":"),
        )
        message_id = "msg_fitcv_webhook_test"
        timestamp = datetime.now(timezone.utc)
        signature = Webhook(secret).sign(message_id, timestamp, payload)

        with patch.object(settings, "resend_webhook_secret", secret):
            verified = verify_resend_webhook(
                payload.encode("utf-8"),
                {
                    "svix-id": message_id,
                    "svix-timestamp": str(int(timestamp.timestamp())),
                    "svix-signature": signature,
                },
            )

        self.assertEqual(verified["type"], "email.delivered")
        self.assertEqual(verified["data"]["email_id"], "email-123")

    def test_sends_thread_headers_and_idempotency_key(self) -> None:
        with (
            patch.object(settings, "resend_api_key", "re_test"),
            patch.object(
                settings,
                "resend_from_email",
                "FitCV <recruiting@example.com>",
            ),
            patch(
                "app.services.email_service._resend_request",
                return_value={"id": "resend-email-123"},
            ) as resend_request,
        ):
            message_id = send_candidate_email(
                to_email="candidate@example.com",
                subject="Re: Interview",
                body="Thanks for your reply.",
                reply_to="reply+thread@example.com",
                in_reply_to="<candidate-message@example.com>",
                references=["<first@example.com>", "<candidate-message@example.com>"],
                idempotency_key="candidate-email/9",
            )

        self.assertEqual(message_id, "resend-email-123")
        call = resend_request.call_args.kwargs
        self.assertEqual(call["idempotency_key"], "candidate-email/9")
        self.assertEqual(
            call["payload"]["headers"]["In-Reply-To"],
            "<candidate-message@example.com>",
        )
        self.assertIn(
            "<candidate-message@example.com>",
            call["payload"]["headers"]["References"],
        )
        self.assertEqual(
            call["payload"]["reply_to"],
            ["reply+thread@example.com"],
        )

    def test_drops_unsafe_thread_headers(self) -> None:
        with (
            patch.object(settings, "resend_api_key", "re_test"),
            patch.object(
                settings,
                "resend_from_email",
                "FitCV <recruiting@example.com>",
            ),
            patch(
                "app.services.email_service._resend_request",
                return_value={"id": "resend-email-456"},
            ) as resend_request,
        ):
            send_candidate_email(
                to_email="candidate@example.com",
                subject="Re: Interview",
                body="Thanks for your reply.",
                in_reply_to="<message@example.com>\r\nBcc: attacker@example.com",
                references=[
                    "<first@example.com>",
                    "unsafe\r\nX-Injected: true",
                ],
            )

        headers = resend_request.call_args.kwargs["payload"]["headers"]
        self.assertNotIn("In-Reply-To", headers)
        self.assertEqual(headers["References"], "<first@example.com>")

    def test_surfaces_provider_error_message(self) -> None:
        provider_error = HTTPError(
            "https://api.resend.com/emails",
            403,
            "Forbidden",
            {},
            BytesIO(
                b'{"statusCode":403,"message":"Testing emails can only be sent to the account email."}'
            ),
        )
        with (
            patch.object(settings, "resend_api_key", "re_test"),
            patch.object(
                settings,
                "resend_from_email",
                "FitCV <onboarding@resend.dev>",
            ),
            patch.object(settings, "resend_max_retries", 0),
            patch(
                "app.services.email_service.request.urlopen",
                side_effect=provider_error,
            ),
        ):
            with self.assertRaisesRegex(
                EmailDeliveryError,
                "Testing emails can only be sent to the account email",
            ) as raised:
                send_candidate_email(
                    to_email="candidate@example.com",
                    subject="Test",
                    body="Test",
                )
        self.assertFalse(raised.exception.retryable)
        self.assertEqual(raised.exception.provider_status, 403)

    def test_includes_user_agent_required_by_resend(self) -> None:
        with (
            patch.object(settings, "resend_api_key", "re_test"),
            patch.object(
                settings,
                "resend_from_email",
                "FitCV <onboarding@resend.dev>",
            ),
            patch.object(settings, "resend_max_retries", 0),
            patch(
                "app.services.email_service.request.urlopen",
                side_effect=HTTPError(
                    "https://api.resend.com/emails",
                    403,
                    "Forbidden",
                    {},
                    BytesIO(b'{"message":"blocked"}'),
                ),
            ) as urlopen,
        ):
            with self.assertRaises(EmailDeliveryError):
                send_candidate_email(
                    to_email="candidate@example.com",
                    subject="Test",
                    body="Test",
                )

        resend_request = urlopen.call_args.args[0]
        self.assertEqual(resend_request.get_header("User-agent"), "FitCV/0.1 (+https://fitcv.app)")


if __name__ == "__main__":
    unittest.main()
