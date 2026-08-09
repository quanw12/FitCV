import ast
import inspect
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, insert, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models.email_workflow import (
    CandidateEmail,
    CandidateEmailCampaign,
    CandidateEmailEvent,
    CandidateEmailInbound,
    CandidateEmailThread,
)
from app.repositories import email_workflow
from app.services import email_webhook_service, email_workflow_service


FROZEN_NOW = datetime(2026, 8, 10, 12, 0, 0, tzinfo=timezone.utc).replace(
    tzinfo=None
)


@pytest.fixture
def timestamp_db():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def _failed_retry_row(
    *,
    last_attempt_at: datetime,
    updated_at: datetime,
):
    draft = SimpleNamespace(
        email_id=41,
        application_id=91,
        thread_id=None,
        message_kind="Initial",
        stage_at_generation="Rejected",
        status="Failed",
        approved_at=FROZEN_NOW - timedelta(days=2),
        retryable=True,
        idempotency_key="candidate-email/41",
        retry_count=1,
        last_attempt_at=last_attempt_at,
        updated_at=updated_at,
        created_at=FROZEN_NOW - timedelta(days=3),
        recipient_email="candidate@example.com",
        subject="Application update",
        body="Thank you for your application.",
        in_reply_to=None,
        references_json=None,
    )
    application = SimpleNamespace(current_stage="Rejected", status="Active")
    return draft, application, SimpleNamespace(), SimpleNamespace(), None


def test_retry_older_than_24_hours_uses_last_attempt_and_stops_before_claim() -> None:
    row = _failed_retry_row(
        last_attempt_at=FROZEN_NOW - timedelta(hours=25),
        updated_at=FROZEN_NOW - timedelta(hours=1),
    )
    account = SimpleNamespace(company_id=7)

    with (
        patch.object(email_workflow_service, "_now", return_value=FROZEN_NOW),
        patch.object(email_workflow_service.email_workflow, "row", return_value=row),
        patch.object(
            email_workflow_service.email_workflow,
            "employer_name",
            return_value="FitCV Test Company",
        ) as employer_name,
        patch.object(
            email_workflow_service.email_workflow,
            "claim_send",
            return_value=False,
        ) as claim_send,
        patch.object(email_workflow_service, "send_candidate_email") as sender,
    ):
        with pytest.raises(HTTPException) as rejected:
            email_workflow_service.send(object(), account, row[0].email_id)

    assert rejected.value.status_code == 409
    assert "24-hour idempotency window" in rejected.value.detail
    employer_name.assert_not_called()
    claim_send.assert_not_called()
    sender.assert_not_called()


def test_retry_within_24_hours_uses_last_attempt_and_reaches_claim() -> None:
    row = _failed_retry_row(
        last_attempt_at=FROZEN_NOW - timedelta(hours=23),
        updated_at=FROZEN_NOW - timedelta(hours=25),
    )
    account = SimpleNamespace(company_id=7)

    with (
        patch.object(email_workflow_service, "_now", return_value=FROZEN_NOW),
        patch.object(email_workflow_service.email_workflow, "row", return_value=row),
        patch.object(
            email_workflow_service.email_workflow,
            "employer_name",
            return_value="FitCV Test Company",
        ),
        patch.object(
            email_workflow_service.email_workflow,
            "claim_send",
            return_value=False,
        ) as claim_send,
        patch.object(email_workflow_service, "send_candidate_email") as sender,
    ):
        with pytest.raises(HTTPException) as rejected:
            email_workflow_service.send(object(), account, row[0].email_id)

    assert rejected.value.status_code == 409
    assert "Another delivery attempt" in rejected.value.detail
    claim_send.assert_called_once()
    assert claim_send.call_args.kwargs["attempt_at"] == FROZEN_NOW
    sender.assert_not_called()


@pytest.mark.parametrize(
    ("model", "column_name"),
    [
        (CandidateEmailThread, "last_message_at"),
        (CandidateEmailThread, "created_at"),
        (CandidateEmailCampaign, "created_at"),
        (CandidateEmail, "created_at"),
        (CandidateEmailInbound, "created_at"),
        (CandidateEmailEvent, "created_at"),
    ],
)
def test_email_timestamp_defaults_are_python_callables(model, column_name: str) -> None:
    column = model.__table__.c[column_name]

    assert column.server_default is None
    assert column.default is not None
    assert callable(column.default.arg)


@pytest.mark.parametrize(
    ("model", "column_name"),
    [
        (CandidateEmailThread, "updated_at"),
        (CandidateEmail, "updated_at"),
    ],
)
def test_email_timestamp_onupdates_are_python_callables(model, column_name: str) -> None:
    column = model.__table__.c[column_name]

    assert column.server_onupdate is None
    assert column.onupdate is not None
    assert callable(column.onupdate.arg)


def test_email_repository_does_not_write_database_clock_timestamps() -> None:
    tree = ast.parse(inspect.getsource(email_workflow))
    database_clock_calls = [
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "now"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "func"
    ]

    assert database_clock_calls == []


def test_core_bulk_inserts_apply_python_defaults_and_orm_onupdates(
    timestamp_db: Session,
) -> None:
    timestamp_db.execute(
        insert(CandidateEmailThread),
        [
            {
                "company_id": 1,
                "application_id": application_id,
                "reply_token": f"00000000-0000-0000-0000-{application_id:012d}",
            }
            for application_id in (101, 102)
        ],
    )
    timestamp_db.commit()
    threads = list(
        timestamp_db.scalars(
            select(CandidateEmailThread).order_by(
                CandidateEmailThread.application_id
            )
        )
    )

    timestamp_db.execute(
        insert(CandidateEmail),
        [
            {
                "company_id": 1,
                "application_id": thread.application_id,
                "thread_id": thread.thread_id,
                "template_key": "follow_up",
                "recipient_email": f"candidate-{index}@example.com",
                "subject": "Application update",
                "body": "Thank you for your application.",
            }
            for index, thread in enumerate(threads, start=1)
        ],
    )
    timestamp_db.commit()
    emails = list(
        timestamp_db.scalars(select(CandidateEmail).order_by(CandidateEmail.email_id))
    )

    assert len(threads) == len(emails) == 2
    assert all(
        isinstance(value, datetime) and value.tzinfo is None
        for thread in threads
        for value in (thread.created_at, thread.last_message_at)
    )
    assert all(
        isinstance(email.created_at, datetime) and email.created_at.tzinfo is None
        for email in emails
    )

    threads[0].subject = "Updated subject"
    emails[0].body = "Updated body"
    timestamp_db.commit()
    timestamp_db.refresh(threads[0])
    timestamp_db.refresh(emails[0])

    assert isinstance(threads[0].updated_at, datetime)
    assert threads[0].updated_at.tzinfo is None
    assert isinstance(emails[0].updated_at, datetime)
    assert emails[0].updated_at.tzinfo is None


def test_sent_timestamp_becomes_exact_thread_last_message_timestamp(
    timestamp_db: Session,
) -> None:
    thread = CandidateEmailThread(
        company_id=1,
        application_id=201,
        reply_token="00000000-0000-0000-0000-000000000201",
    )
    timestamp_db.add(thread)
    timestamp_db.flush()
    draft = CandidateEmail(
        company_id=1,
        application_id=201,
        thread_id=thread.thread_id,
        template_key="follow_up",
        recipient_email="candidate@example.com",
        subject="Application update",
        body="Thank you for your application.",
    )
    timestamp_db.add(draft)
    timestamp_db.commit()

    email_workflow.save(
        timestamp_db,
        draft,
        {"status": "Sent", "sent_at": FROZEN_NOW},
    )
    timestamp_db.refresh(thread)

    assert draft.sent_at == FROZEN_NOW
    assert thread.last_message_at == draft.sent_at


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2026-07-30T08:00:00Z", datetime(2026, 7, 30, 8, 0, 0)),
        ("2026-07-30T15:00:00+07:00", datetime(2026, 7, 30, 8, 0, 0)),
    ],
)
def test_webhook_timestamp_is_normalized_to_utc_naive(
    value: str,
    expected: datetime,
) -> None:
    parsed = email_webhook_service._parse_timestamp(value)

    assert parsed == expected
    assert parsed.tzinfo is None


def test_invalid_webhook_timestamp_uses_utc_naive_fallback() -> None:
    with patch.object(
        email_webhook_service,
        "utc_now_naive",
        return_value=FROZEN_NOW,
    ) as utc_now:
        parsed = email_webhook_service._parse_timestamp("not-a-timestamp")

    assert parsed == FROZEN_NOW
    utc_now.assert_called_once_with()
