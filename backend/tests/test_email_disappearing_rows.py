from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.services import email_workflow_service


ACCOUNT = SimpleNamespace(account_id=3, company_id=7)
EMAIL_ID = 41
NOW = datetime(2026, 8, 10, 12, 0, 0, tzinfo=timezone.utc).replace(tzinfo=None)


def _assert_not_found(raised: pytest.ExceptionInfo[HTTPException]) -> None:
    assert raised.value.status_code == 404
    assert raised.value.detail == "Email draft not found."


def test_update_returns_404_when_row_disappears_after_successful_cas() -> None:
    draft = SimpleNamespace(status="Draft")

    with (
        patch.object(
            email_workflow_service.email_workflow,
            "get_owned",
            return_value=draft,
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "compare_and_set_status",
            return_value=True,
        ) as transition,
        patch.object(
            email_workflow_service.email_workflow,
            "row",
            return_value=None,
        ),
    ):
        with pytest.raises(HTTPException) as raised:
            email_workflow_service.update_draft(
                object(),
                ACCOUNT,
                EMAIL_ID,
                subject="Reviewed subject",
                body="Reviewed body",
            )

    transition.assert_called_once()
    _assert_not_found(raised)


def test_approve_returns_404_when_row_disappears_after_successful_cas() -> None:
    draft = SimpleNamespace(status="Draft")

    with (
        patch.object(email_workflow_service, "_now", return_value=NOW),
        patch.object(
            email_workflow_service.email_workflow,
            "get_owned",
            return_value=draft,
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "compare_and_set_status",
            return_value=True,
        ) as transition,
        patch.object(
            email_workflow_service.email_workflow,
            "row",
            return_value=None,
        ),
    ):
        with pytest.raises(HTTPException) as raised:
            email_workflow_service.approve(object(), ACCOUNT, EMAIL_ID)

    transition.assert_called_once()
    _assert_not_found(raised)


def test_reopen_returns_404_when_row_disappears_after_successful_cas() -> None:
    draft = SimpleNamespace(status="Failed")

    with (
        patch.object(
            email_workflow_service.email_workflow,
            "get_owned",
            return_value=draft,
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "compare_and_set_status",
            return_value=True,
        ) as transition,
        patch.object(
            email_workflow_service.email_workflow,
            "row",
            return_value=None,
        ),
    ):
        with pytest.raises(HTTPException) as raised:
            email_workflow_service.reopen_failed_draft(object(), ACCOUNT, EMAIL_ID)

    transition.assert_called_once()
    _assert_not_found(raised)


def test_send_returns_404_when_row_disappears_after_successful_save() -> None:
    draft = SimpleNamespace(
        email_id=EMAIL_ID,
        status="Approved",
        stage_at_generation="Interview",
        message_kind="Initial",
        approved_at=NOW,
        idempotency_key=None,
        retry_count=0,
        recipient_email="candidate@example.com",
        subject="Interview update",
        body="Thank you for your application.",
        in_reply_to=None,
        references_json=None,
    )
    application = SimpleNamespace(current_stage="Interview", status="Active")
    initial_row = (draft, application, SimpleNamespace(), SimpleNamespace(), None)

    with (
        patch.object(email_workflow_service, "_now", return_value=NOW),
        patch.object(
            email_workflow_service.email_workflow,
            "row",
            side_effect=[initial_row, None],
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "employer_name",
            return_value="FitCV Test Company",
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "claim_send",
            return_value=True,
        ),
        patch.object(
            email_workflow_service,
            "send_candidate_email",
            return_value="provider-message-123",
        ) as sender,
        patch.object(email_workflow_service.email_workflow, "save") as save,
    ):
        with pytest.raises(HTTPException) as raised:
            email_workflow_service.send(object(), ACCOUNT, EMAIL_ID)

    sender.assert_called_once()
    save.assert_called_once()
    saved_draft = save.call_args.args[1]
    saved_values = save.call_args.args[2]
    assert saved_draft is draft
    assert saved_values == {
        "status": "Sent",
        "delivery_status": "Sent",
        "provider_message_id": "provider-message-123",
        "sent_at": NOW,
        "retryable": False,
        "error_message": None,
    }
    _assert_not_found(raised)
