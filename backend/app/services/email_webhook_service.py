from datetime import datetime, timezone
from email.utils import parseaddr
from html.parser import HTMLParser
import re
from collections.abc import Mapping

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories import email_workflow
from app.schemas.email_workflow import EmailWebhookResponse
from app.services.email_service import (
    EmailDeliveryError,
    EmailWebhookVerificationError,
    retrieve_received_email,
    verify_resend_webhook,
)

DELIVERY_STATUS_BY_EVENT = {
    "email.sent": "Sent",
    "email.delivered": "Delivered",
    "email.delivery_delayed": "Delayed",
    "email.bounced": "Bounced",
    "email.complained": "Complained",
    "email.opened": "Opened",
    "email.clicked": "Clicked",
    "email.suppressed": "Suppressed",
    "email.failed": "Failed",
}
REPLY_TOKEN_PATTERN = re.compile(r"^reply\+([0-9a-f-]{36})$", re.IGNORECASE)
MAX_WEBHOOK_PAYLOAD_BYTES = 1_000_000


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return " ".join(" ".join(self.parts).split())


def _parse_timestamp(value: object) -> datetime:
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        except ValueError:
            pass
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _bare_email(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return parseaddr(value)[1].strip().lower()


def _reply_token(recipients: object) -> tuple[str, str] | None:
    domain = (settings.resend_inbound_domain or "").strip().lower()
    if domain.startswith("@"):
        domain = domain[1:]
    if not domain:
        return None
    values = recipients if isinstance(recipients, list) else []
    for value in values:
        address = _bare_email(value)
        if "@" not in address:
            continue
        local_part, address_domain = address.rsplit("@", 1)
        if address_domain != domain:
            continue
        match = REPLY_TOKEN_PATTERN.fullmatch(local_part)
        if match:
            return match.group(1).lower(), address
    return None


def _body_text(content: dict) -> str:
    plain_text = content.get("text")
    if isinstance(plain_text, str) and plain_text.strip():
        value = plain_text
    else:
        parser = _TextExtractor()
        html = content.get("html")
        parser.feed(html if isinstance(html, str) else "")
        value = parser.text()
    cleaned = value.replace("\x00", "").strip()
    return cleaned[:30_000]


def _header(headers: object, key: str) -> str | None:
    if not isinstance(headers, dict):
        return None
    normalized = {
        str(header_key).lower(): str(value)
        for header_key, value in headers.items()
        if value is not None
    }
    value = normalized.get(key.lower())
    return value[:4000] if value else None


def _safe_attachments(value: object) -> list[dict] | None:
    if not isinstance(value, list):
        return None
    attachments = []
    for item in value[:20]:
        if not isinstance(item, dict):
            continue
        attachments.append(
            {
                key: item.get(key)
                for key in (
                    "id",
                    "filename",
                    "content_type",
                    "content_disposition",
                    "size",
                )
                if item.get(key) is not None
            }
        )
    return attachments or None


def _safe_event_data(data: dict) -> dict:
    safe: dict = {}
    for key in ("bounce", "click", "created_at"):
        value = data.get(key)
        if isinstance(value, (dict, str, int, float, bool)):
            safe[key] = value
    return safe


def _ignored_response(
    db: Session,
    *,
    provider_event_id: str,
    provider_email_id: str | None,
    event_type: str,
    occurred_at: datetime,
    detail: str,
) -> EmailWebhookResponse:
    email_workflow.record_event(
        db,
        provider_event_id=provider_event_id,
        provider_email_id=provider_email_id,
        event_type=event_type,
        occurred_at=occurred_at,
        event_data_json={"ignored": True, "reason": detail[:200]},
        candidate_email=None,
    )
    return EmailWebhookResponse(ignored=True, detail=detail)


def _process_inbound(
    db: Session,
    *,
    data: dict,
    provider_event_id: str,
    occurred_at: datetime,
) -> EmailWebhookResponse:
    provider_email_id = data.get("email_id")
    if not isinstance(provider_email_id, str) or not provider_email_id:
        raise EmailWebhookVerificationError(
            "Inbound email webhook is missing email_id."
        )
    if len(provider_email_id) > 200:
        raise EmailWebhookVerificationError("Inbound email webhook email_id is too long.")
    if email_workflow.inbound_by_provider_email(db, provider_email_id):
        return EmailWebhookResponse(duplicate=True)

    token_result = _reply_token(data.get("to"))
    if token_result is None:
        return _ignored_response(
            db,
            provider_event_id=provider_event_id,
            provider_email_id=provider_email_id,
            event_type="email.received",
            occurred_at=occurred_at,
            detail="Inbound email was not addressed to a FitCV thread.",
        )
    reply_token, recipient_email = token_result
    thread = email_workflow.thread_by_reply_token(db, reply_token)
    if thread is None:
        return _ignored_response(
            db,
            provider_event_id=provider_event_id,
            provider_email_id=provider_email_id,
            event_type="email.received",
            occurred_at=occurred_at,
            detail="Inbound email thread was not found.",
        )
    context = email_workflow.thread_context(
        db, thread.thread_id, thread.company_id
    )
    if context is None:
        return _ignored_response(
            db,
            provider_event_id=provider_event_id,
            provider_email_id=provider_email_id,
            event_type="email.received",
            occurred_at=occurred_at,
            detail="Inbound email application was not found.",
        )
    candidate = context[2]
    sender_email = _bare_email(data.get("from"))
    if not candidate.email or sender_email != candidate.email.strip().lower():
        return _ignored_response(
            db,
            provider_event_id=provider_event_id,
            provider_email_id=provider_email_id,
            event_type="email.received",
            occurred_at=occurred_at,
            detail="Inbound sender does not match the application candidate.",
        )

    content = retrieve_received_email(provider_email_id)
    content_sender = _bare_email(content.get("from"))
    if content_sender and content_sender != sender_email:
        raise EmailWebhookVerificationError(
            "Inbound email sender metadata does not match retrieved content."
        )
    body_text = _body_text(content)
    if not body_text:
        body_text = "(No plain-text email content was provided.)"
    content_headers = content.get("headers")
    inbound = email_workflow.create_inbound(
        db,
        thread=thread,
        provider_email_id=provider_email_id,
        provider_message_id=(
            str(content.get("message_id"))[:500]
            if content.get("message_id")
            else (
                str(data.get("message_id"))[:500]
                if data.get("message_id")
                else None
            )
        ),
        sender_email=sender_email,
        recipient_email=recipient_email,
        subject=str(content.get("subject") or data.get("subject") or "(No subject)")[
            :300
        ],
        body_text=body_text,
        in_reply_to=_header(content_headers, "in-reply-to"),
        references_text=_header(content_headers, "references"),
        attachments_json=_safe_attachments(content.get("attachments")),
        received_at=_parse_timestamp(
            content.get("created_at") or data.get("created_at")
        ),
    )
    email_workflow.record_event(
        db,
        provider_event_id=provider_event_id,
        provider_email_id=provider_email_id,
        event_type="email.received",
        occurred_at=occurred_at,
        event_data_json={"inbound_id": inbound.inbound_id},
        candidate_email=None,
    )
    return EmailWebhookResponse()


def process_resend_webhook(
    db: Session,
    *,
    payload: bytes,
    headers: Mapping[str, str],
) -> EmailWebhookResponse:
    if len(payload) > MAX_WEBHOOK_PAYLOAD_BYTES:
        raise EmailWebhookVerificationError("Email webhook payload is too large.")
    event = verify_resend_webhook(payload, headers)
    provider_event_id = headers.get("svix-id", "").strip()
    if not provider_event_id:
        raise EmailWebhookVerificationError(
            "Email webhook is missing svix-id."
        )
    if len(provider_event_id) > 200:
        raise EmailWebhookVerificationError("Email webhook svix-id is too long.")
    if email_workflow.event_by_provider_id(db, provider_event_id):
        return EmailWebhookResponse(duplicate=True)

    event_type = event.get("type")
    data = event.get("data")
    if not isinstance(event_type, str) or not isinstance(data, dict):
        raise EmailWebhookVerificationError("Invalid email webhook payload.")
    if not event_type or len(event_type) > 50:
        raise EmailWebhookVerificationError("Invalid email webhook event type.")
    occurred_at = _parse_timestamp(event.get("created_at"))

    try:
        if event_type == "email.received":
            return _process_inbound(
                db,
                data=data,
                provider_event_id=provider_event_id,
                occurred_at=occurred_at,
            )

        provider_email_id = data.get("email_id")
        if not isinstance(provider_email_id, str) or not provider_email_id:
            return _ignored_response(
                db,
                provider_event_id=provider_event_id,
                provider_email_id=None,
                event_type=event_type,
                occurred_at=occurred_at,
                detail="Webhook event is not associated with an email.",
            )
        if len(provider_email_id) > 200:
            raise EmailWebhookVerificationError(
                "Webhook event email_id is too long."
            )
        candidate_email = email_workflow.candidate_email_by_provider_id(
            db, provider_email_id
        )
        if candidate_email is None:
            return _ignored_response(
                db,
                provider_event_id=provider_event_id,
                provider_email_id=provider_email_id,
                event_type=event_type,
                occurred_at=occurred_at,
                detail="Webhook event is not associated with a candidate email.",
            )
        email_workflow.record_event(
            db,
            provider_event_id=provider_event_id,
            provider_email_id=provider_email_id,
            event_type=event_type,
            occurred_at=occurred_at,
            event_data_json=_safe_event_data(data),
            candidate_email=candidate_email,
            delivery_status=DELIVERY_STATUS_BY_EVENT.get(event_type),
        )
        return EmailWebhookResponse()
    except IntegrityError:
        db.rollback()
        if email_workflow.event_by_provider_id(db, provider_event_id):
            return EmailWebhookResponse(duplicate=True)
        provider_email_id = data.get("email_id") if isinstance(data, dict) else None
        if (
            event_type == "email.received"
            and isinstance(provider_email_id, str)
            and email_workflow.inbound_by_provider_email(db, provider_email_id)
        ):
            return EmailWebhookResponse(duplicate=True)
        raise


__all__ = [
    "EmailDeliveryError",
    "EmailWebhookVerificationError",
    "process_resend_webhook",
]
