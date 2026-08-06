import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from app.core.config import settings
from app.core.security import decode_access_token, hash_refresh_token
from app.db.session import Base
from app.models.account import Account, AccountRole, AuthProvider
from app.models.improvement import AiTaskStatus
from app.models.jobs import Company
from app.models.platform import AuthSessionRecord, ScreeningBatchStatus
from app.repositories import ai_tasks, auth_sessions
from app.services import auth_rate_limit, auth_service, cv_ranking_service


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture
def db_factory():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    try:
        yield factory
    finally:
        engine.dispose()


def _manager(factory: sessionmaker) -> Account:
    db = factory()
    company = Company(company_name="FitCV Test Company")
    db.add(company)
    db.flush()
    account = Account(
        email="manager@example.com",
        password_hash="test",
        full_name="HR Manager",
        role=AccountRole.hr,
        company_id=company.company_id,
        auth_provider=AuthProvider.password,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    db.expunge(account)
    db.close()
    return account


def _request(ip: str = "127.0.0.1") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/auth/login",
            "headers": [],
            "client": (ip, 5000),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        }
    )


def test_screening_batch_is_saved_reloaded_filtered_and_selected(db_factory) -> None:
    manager = _manager(db_factory)
    original_upload_dir = settings.upload_dir
    original_provider = settings.analyzer_provider
    with TemporaryDirectory(prefix="fitcv-screening-test-") as directory:
        settings.upload_dir = Path(directory)
        settings.analyzer_provider = "deterministic"
        db = db_factory()
        file = UploadFile(
            filename="alice.pdf",
            file=BytesIO(b"%PDF-1.4\nFitCV persisted screening test"),
        )
        with ThreadPoolExecutor(max_workers=1) as executor:
            created = executor.submit(
                lambda: asyncio.run(
                    cv_ranking_service.create_screening_batch(
                        db,
                        files=[file],
                        job_description=(
                            "Backend Engineer requires Python, FastAPI, three years of "
                            "experience, a bachelor degree and communication skills."
                        ),
                        title="Backend Engineer August",
                        account=manager,
                    )
                )
            ).result()
        assert created.screening_batch_id is not None
        assert created.ai_task_id is not None

        readable_cv = (
            "Alice Nguyen\nBackend Engineer\nalice@example.com\nSkills\n"
            "Python FastAPI\nExperience\n4 years building APIs.\nEducation\n"
            "Bachelor degree.\nCommunication."
        )
        with (
            patch("app.services.cv_ranking_service.SessionLocal", db_factory),
            patch(
                "app.services.cv_ranking_service.extract_document_text",
                return_value=readable_cv,
            ),
        ):
            with ThreadPoolExecutor(max_workers=1) as executor:
                executor.submit(
                    cv_ranking_service.run_screening_batch,
                    created.screening_batch_id,
                ).result()

        detail = cv_ranking_service.get_screening_batch(
            db, batch_id=created.screening_batch_id, account=manager
        )
        assert detail.status == ScreeningBatchStatus.completed
        assert len(detail.candidates) == 1
        candidate = detail.candidates[0]
        assert candidate.name == "Alice Nguyen"

        saved = cv_ranking_service.save_selection(
            db,
            batch_id=created.screening_batch_id,
            request=cv_ranking_service.ScreeningSelectionRequest(
                selected_candidate_keys=[candidate.id],
                confirmed_candidate_keys=[candidate.id],
            ),
            account=manager,
        )
        assert saved.candidates[0].is_confirmed is True
        history = cv_ranking_service.list_screening_history(
            db,
            account=manager,
            query="Backend",
            status_filter=ScreeningBatchStatus.completed,
            created_from=None,
            created_to=None,
            min_score=50,
            limit=20,
            offset=0,
        )
        assert len(history) == 1
        assert history[0].selected_count == 1
        db.close()
    settings.upload_dir = original_upload_dir
    settings.analyzer_provider = original_provider


def test_ai_task_retries_then_fails_and_stale_task_recovers(db_factory) -> None:
    manager = _manager(db_factory)
    db = db_factory()
    now = _utcnow_naive()
    task = ai_tasks.create(
        db,
        task_type="MatchAnalysis",
        resource_id=99,
        owner_account_id=manager.account_id,
        company_id=manager.company_id,
        max_attempts=2,
    )
    claimed = ai_tasks.claim_next(db, worker_id="worker-a", now=now)
    assert claimed and claimed.ai_task_id == task.ai_task_id
    retried = ai_tasks.fail_or_retry(
        db,
        task.ai_task_id,
        worker_id="worker-a",
        now=now,
        available_at=now,
        error_message="temporary provider error",
    )
    assert retried and retried.status == AiTaskStatus.pending
    claimed = ai_tasks.claim_next(db, worker_id="worker-a", now=now)
    assert claimed and claimed.attempt_count == 2
    failed = ai_tasks.fail_or_retry(
        db,
        task.ai_task_id,
        worker_id="worker-a",
        now=now,
        available_at=now,
        error_message="provider remains unavailable",
    )
    assert failed and failed.status == AiTaskStatus.failed

    stale = ai_tasks.create(
        db,
        task_type="CvParse",
        resource_id=100,
        owner_account_id=manager.account_id,
        company_id=manager.company_id,
    )
    claimed_stale = ai_tasks.claim_next(db, worker_id="dead-worker", now=now)
    assert claimed_stale and claimed_stale.ai_task_id == stale.ai_task_id
    claimed_stale.heartbeat_at = now - timedelta(hours=1)
    db.commit()
    assert ai_tasks.recover_stale(
        db, stale_before=now - timedelta(minutes=30), now=now
    ) == 1
    db.refresh(claimed_stale)
    assert claimed_stale.status == AiTaskStatus.pending
    db.close()


def test_refresh_rotation_logout_and_rate_limit(db_factory) -> None:
    db = db_factory()
    issued = auth_service.register(
        db,
        email="student@example.com",
        password="StrongPass123!",
        full_name="FitCV Student",
    )
    claims = decode_access_token(issued.session.access_token)
    assert claims is not None
    old_hash = hash_refresh_token(issued.refresh_token)
    refreshed = auth_service.refresh(db, refresh_token=issued.refresh_token)
    assert refreshed.refresh_token != issued.refresh_token
    assert auth_sessions.get_active_by_refresh_hash(
        db, old_hash, now=_utcnow_naive()
    ) is None

    auth_service.logout(db, session_id=claims.session_id)
    assert auth_sessions.get_active_by_id(
        db, claims.session_id, now=_utcnow_naive()
    ) is None
    record = db.scalar(
        select(AuthSessionRecord).where(AuthSessionRecord.session_id == claims.session_id)
    )
    assert record and record.revoke_reason == "Logout"

    request = _request()
    for _ in range(5):
        auth_rate_limit.consume(
            db, action="login", request=request, identifier="limited@example.com"
        )
    with pytest.raises(HTTPException) as blocked:
        auth_rate_limit.consume(
            db, action="login", request=request, identifier="limited@example.com"
        )
    assert blocked.value.status_code == 429
    db.close()
