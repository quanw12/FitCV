from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models.account import Account, AccountRole, AuthProvider
from app.models.improvement import AiTaskAttemptOutcome, AiTaskStatus
from app.models.jobs import Company
from app.repositories import ai_tasks
from app.services import ai_task_service


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    session = factory()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def manager(db: Session) -> Account:
    company = Company(company_name="FitCV Attempt History")
    db.add(company)
    db.flush()
    account = Account(
        email="attempt-history@example.com",
        password_hash="test",
        full_name="Attempt History Manager",
        role=AccountRole.hr,
        company_id=company.company_id,
        auth_provider=AuthProvider.password,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _create_task(
    db: Session,
    manager: Account,
    *,
    max_attempts: int,
    available_at: datetime,
):
    task = ai_tasks.create(
        db,
        task_type="MatchAnalysis",
        resource_id=101,
        owner_account_id=manager.account_id,
        company_id=manager.company_id,
        max_attempts=max_attempts,
    )
    task.available_at = available_at
    db.commit()
    db.refresh(task)
    return task


def test_retry_then_success_keeps_sanitized_attempt_history(
    db: Session, manager: Account
) -> None:
    now = datetime(2026, 8, 9, 10, 0, 0)
    task = _create_task(db, manager, max_attempts=2, available_at=now)
    claimed = ai_tasks.claim_next(db, worker_id="worker-a", now=now)
    assert claimed and claimed.ai_task_id == task.ai_task_id

    raw_error = "temporary provider error\napi_key=super-secret"
    retried = ai_tasks.fail_or_retry(
        db,
        task.ai_task_id,
        worker_id="worker-a",
        now=now,
        available_at=now,
        error_message=raw_error,
    )
    assert retried and retried.status == AiTaskStatus.pending
    assert retried.error_message == "temporary provider error api_key=[redacted]"

    claimed = ai_tasks.claim_next(
        db,
        worker_id="worker-a",
        now=now + timedelta(minutes=1),
    )
    assert claimed and claimed.attempt_count == 2
    assert claimed.error_message is None
    assert ai_tasks.complete(
        db,
        task.ai_task_id,
        worker_id="worker-a",
        now=now + timedelta(minutes=2),
    )

    response = ai_task_service.get_status(
        db,
        task_id=task.ai_task_id,
        account=manager,
    )
    assert response.status == AiTaskStatus.success
    assert response.error_message is None
    assert len(response.attempt_history) == 1
    attempt = response.attempt_history[0]
    assert attempt.attempt_number == 1
    assert attempt.outcome == AiTaskAttemptOutcome.retry_scheduled
    assert attempt.error_message == "temporary provider error api_key=[redacted]"
    assert "super-secret" not in attempt.error_message
    assert attempt.failed_at == now


@pytest.mark.parametrize(
    ("raw_error", "expected_error"),
    [
        (
            'provider rejected {"api_key": "top secret value"}',
            'provider rejected {"api_key": "[redacted]"}',
        ),
        (
            "request failed with Authorization: Basic dXNlcjpwYXNz",
            "request failed with Authorization: Basic [redacted]",
        ),
        (
            "request failed with Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
            "request failed with Bearer [redacted]",
        ),
        (
            "GET https://provider.test/run?key=url-secret&mode=fast failed",
            "GET https://provider.test/run?key=[redacted]&mode=fast failed",
        ),
        (
            "provider secret=correct horse battery staple",
            "provider secret=[redacted]",
        ),
        (
            "provider password='correct horse battery staple'",
            "provider password='[redacted]'",
        ),
        (
            "database mysql+pymysql://fitcv:db-secret@db.test:3306/fitcv failed",
            "database [redacted] failed",
        ),
        (
            "provider contacted jane.doe@example.com before failing",
            "provider contacted [redacted] before failing",
        ),
        (
            "candidate phone=+84 912 345 678",
            "candidate phone=[redacted]",
        ),
        (
            'provider api_key="unterminated secret value',
            "AI task attempt failed.",
        ),
    ],
)
def test_latest_error_and_attempt_history_share_hardened_sanitization(
    db: Session,
    manager: Account,
    raw_error: str,
    expected_error: str,
) -> None:
    now = datetime(2026, 8, 9, 10, 30, 0)
    task = _create_task(db, manager, max_attempts=1, available_at=now)
    claimed = ai_tasks.claim_next(db, worker_id="worker-redaction", now=now)
    assert claimed and claimed.attempt_count == 1

    failed = ai_tasks.fail_or_retry(
        db,
        task.ai_task_id,
        worker_id="worker-redaction",
        now=now,
        available_at=now,
        error_message=raw_error,
    )
    assert failed and failed.status == AiTaskStatus.failed
    assert failed.error_message == expected_error

    response = ai_task_service.get_status(
        db,
        task_id=task.ai_task_id,
        account=manager,
    )
    assert response.error_message == expected_error
    assert len(response.attempt_history) == 1
    assert response.attempt_history[0].error_message == expected_error


def test_terminal_failure_keeps_current_error_and_records_attempt(
    db: Session, manager: Account
) -> None:
    now = datetime(2026, 8, 9, 11, 0, 0)
    task = _create_task(db, manager, max_attempts=1, available_at=now)
    claimed = ai_tasks.claim_next(db, worker_id="worker-terminal", now=now)
    assert claimed and claimed.attempt_count == 1

    failed = ai_tasks.fail_or_retry(
        db,
        task.ai_task_id,
        worker_id="worker-terminal",
        now=now,
        available_at=now,
        error_message="provider remains unavailable",
    )
    assert failed and failed.status == AiTaskStatus.failed

    response = ai_task_service.get_status(
        db,
        task_id=task.ai_task_id,
        account=manager,
    )
    assert response.error_message == "provider remains unavailable"
    assert [attempt.attempt_number for attempt in response.attempt_history] == [1]
    assert response.attempt_history[0].outcome == (
        AiTaskAttemptOutcome.terminal_failure
    )


def test_stale_recovery_records_every_failed_attempt_in_order(
    db: Session, manager: Account
) -> None:
    now = datetime(2026, 8, 9, 12, 0, 0)
    task = _create_task(db, manager, max_attempts=2, available_at=now)

    first_claim = ai_tasks.claim_next(db, worker_id="dead-worker-1", now=now)
    assert first_claim and first_claim.attempt_count == 1
    first_claim.heartbeat_at = now - timedelta(hours=1)
    db.commit()
    assert ai_tasks.recover_stale(
        db,
        stale_before=now - timedelta(minutes=30),
        now=now,
    ) == 1

    second_claim = ai_tasks.claim_next(
        db,
        worker_id="dead-worker-2",
        now=now + timedelta(minutes=1),
    )
    assert second_claim and second_claim.attempt_count == 2
    second_claim.heartbeat_at = now - timedelta(hours=1)
    db.commit()
    assert ai_tasks.recover_stale(
        db,
        stale_before=now - timedelta(minutes=30),
        now=now + timedelta(minutes=2),
    ) == 1

    response = ai_task_service.get_status(
        db,
        task_id=task.ai_task_id,
        account=manager,
    )
    assert response.status == AiTaskStatus.failed
    assert [attempt.attempt_number for attempt in response.attempt_history] == [1, 2]
    assert [attempt.outcome for attempt in response.attempt_history] == [
        AiTaskAttemptOutcome.stale_recovery,
        AiTaskAttemptOutcome.stale_recovery,
    ]
    assert [attempt.failed_at for attempt in response.attempt_history] == [
        now,
        now + timedelta(minutes=2),
    ]
