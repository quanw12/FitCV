from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_account
from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.account import AccountRole
from app.services import email_workflow_service


NOW = datetime(2026, 8, 10, 12, 0, 0, tzinfo=timezone.utc).replace(tzinfo=None)
THREAD_ID = 11
APPLICATION_ID = 22


@pytest.fixture
def email_client():
    previous_overrides = app.dependency_overrides.copy()
    account = SimpleNamespace(account_id=3, company_id=7, role=AccountRole.hr)
    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[get_current_account] = lambda: account
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)


def _thread_row(*, candidate_email: str | None):
    thread = SimpleNamespace(
        thread_id=THREAD_ID,
        application_id=APPLICATION_ID,
        reply_token="00000000-0000-0000-0000-000000000011",
        subject="Application update",
        last_message_at=NOW,
        last_inbound_at=None,
    )
    application = SimpleNamespace(current_stage="Screening")
    candidate = SimpleNamespace(
        full_name="Candidate Without Email",
        email=candidate_email,
    )
    job = SimpleNamespace(title="Backend Engineer")
    return thread, application, candidate, job


def _draft_row(*, recipient_email: str):
    draft = SimpleNamespace(
        email_id=41,
        application_id=APPLICATION_ID,
        thread_id=THREAD_ID,
        campaign_id=None,
        template_key="follow_up",
        message_kind="Initial",
        stage_at_generation="Screening",
        recipient_email=recipient_email,
        subject="Application update",
        body="Thank you for your application.",
        status="Draft",
        delivery_status=None,
        retryable=False,
        retry_count=0,
        last_attempt_at=None,
        ai_generated=False,
        in_reply_to=None,
        approved_at=None,
        sent_at=None,
        provider_message_id=None,
        error_message=None,
        created_at=NOW,
        updated_at=None,
    )
    application = SimpleNamespace(current_stage="Screening")
    candidate = SimpleNamespace(full_name="Draft Candidate")
    job = SimpleNamespace(title="Backend Engineer")
    thread = _thread_row(candidate_email=recipient_email)[0]
    return draft, application, candidate, job, thread


def test_threads_return_missing_candidate_email_without_failing_list(
    email_client: TestClient,
) -> None:
    row = _thread_row(candidate_email=None)

    with (
        patch.object(settings, "resend_inbound_domain", "inbound.example.com"),
        patch.object(
            email_workflow_service.email_workflow,
            "thread_contexts",
            return_value=[row],
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "outbound_messages_for_threads",
            return_value={THREAD_ID: []},
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "inbound_messages_for_threads",
            return_value={THREAD_ID: []},
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "unread_counts",
            return_value={THREAD_ID: 0},
        ),
    ):
        response = email_client.get("/api/hr/emails/threads")

    assert response.status_code == 200, response.text
    payload = response.json()[0]
    assert payload["candidate_email"] == ""
    assert payload["recipient_email_valid"] is False
    assert payload["reply_to_email"].endswith("@inbound.example.com")


@pytest.mark.parametrize(
    ("recipient_email", "expected_valid"),
    [
        ("not-an-email", False),
        ("candidate@example.com", True),
    ],
)
def test_drafts_serialize_recipient_email_with_explicit_validity(
    email_client: TestClient,
    recipient_email: str,
    expected_valid: bool,
) -> None:
    row = _draft_row(recipient_email=recipient_email)

    with (
        patch.object(settings, "resend_inbound_domain", "inbound.example.com"),
        patch.object(
            email_workflow_service.email_workflow,
            "rows",
            return_value=[row],
        ),
    ):
        response = email_client.get("/api/hr/emails/drafts")

    assert response.status_code == 200, response.text
    payload = response.json()[0]
    assert payload["recipient_email"] == recipient_email
    assert payload["recipient_email_valid"] is expected_valid
    assert payload["reply_to_email"].endswith("@inbound.example.com")
