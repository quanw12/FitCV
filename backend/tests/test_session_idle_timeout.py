from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import Settings, settings
from app.core.security import create_refresh_token
from app.db.session import Base
from app.models.account import Account, AuthProvider
from app.repositories import auth_sessions
from app.services import auth_service


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(autouse=True)
def three_hour_idle_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "session_idle_timeout_minutes", 180, raising=False)


def test_default_idle_timeout_is_three_hours(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SESSION_IDLE_TIMEOUT_MINUTES", raising=False)

    configured = Settings(
        _env_file=None,
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret_key="test-only-secret",
    )

    assert configured.session_idle_timeout_minutes == 180


def _account(db: Session) -> Account:
    account = Account(
        email="idle-test@example.com",
        password_hash="test-only",
        full_name="Idle Test",
        auth_provider=AuthProvider.password,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _session(db: Session, *, now: datetime):
    account = _account(db)
    return auth_sessions.create(
        db,
        account_id=account.account_id,
        refresh_token_hash="a" * 64,
        expires_at=now + timedelta(days=30),
        now=now,
    )


def test_idle_boundary_accepts_2_59_59_and_rejects_3_00_01(db: Session) -> None:
    started_at = datetime(2026, 8, 10, 8, 0, 0)
    record = _session(db, now=started_at)

    assert (
        auth_sessions.get_active_by_id(
            db,
            record.session_id,
            now=started_at + timedelta(hours=2, minutes=59, seconds=59),
        )
        is not None
    )
    assert (
        auth_sessions.get_active_by_id(
            db,
            record.session_id,
            now=started_at + timedelta(hours=3, seconds=1),
        )
        is None
    )


def test_human_activity_slides_idle_window(db: Session) -> None:
    started_at = datetime(2026, 8, 10, 8, 0, 0)
    record = _session(db, now=started_at)

    assert auth_sessions.touch_activity(
        db,
        record.session_id,
        now=started_at + timedelta(minutes=90),
    )
    assert (
        auth_sessions.get_active_by_id(
            db,
            record.session_id,
            now=started_at + timedelta(hours=4, minutes=29),
        )
        is not None
    )

    untouched = auth_sessions.create(
        db,
        account_id=record.account_id,
        refresh_token_hash="b" * 64,
        expires_at=started_at + timedelta(days=30),
        now=started_at,
    )
    assert (
        auth_sessions.get_active_by_id(
            db,
            untouched.session_id,
            now=started_at + timedelta(hours=3, minutes=1),
        )
        is None
    )


def test_legacy_null_last_used_at_falls_back_to_created_at(db: Session) -> None:
    started_at = datetime(2026, 8, 10, 8, 0, 0)
    record = _session(db, now=started_at)
    record.last_used_at = None
    record.created_at = started_at
    db.commit()

    assert (
        auth_sessions.get_active_by_id(
            db,
            record.session_id,
            now=started_at + timedelta(hours=2, minutes=59),
        )
        is not None
    )
    assert (
        auth_sessions.get_active_by_id(
            db,
            record.session_id,
            now=started_at + timedelta(hours=3, minutes=1),
        )
        is None
    )


def test_refresh_rotation_is_not_activity_and_keeps_absolute_expiry(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started_at = datetime(2026, 8, 10, 8, 0, 0)
    account = _account(db)
    record = auth_sessions.create(
        db,
        account_id=account.account_id,
        refresh_token_hash="c" * 64,
        expires_at=started_at + timedelta(days=30),
        now=started_at,
    )
    absolute_expiry = record.expires_at

    monkeypatch.setattr(
        auth_service,
        "utc_now_naive",
        lambda: started_at + timedelta(minutes=30),
    )
    monkeypatch.setattr(
        auth_service,
        "hash_refresh_token",
        lambda token: "c" * 64 if token == "current" else "d" * 64,
    )

    refreshed = auth_service.refresh(db, refresh_token="current")
    db.refresh(record)

    assert refreshed.refresh_token != "current"
    assert record.last_used_at == started_at
    assert record.expires_at == absolute_expiry


def test_refresh_rejects_an_idle_session(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started_at = datetime(2026, 8, 10, 8, 0, 0)
    _session(db, now=started_at)
    monkeypatch.setattr(
        auth_service,
        "utc_now_naive",
        lambda: started_at + timedelta(hours=3, minutes=1),
    )
    monkeypatch.setattr(auth_service, "hash_refresh_token", lambda _: "a" * 64)

    with pytest.raises(HTTPException) as error:
        auth_service.refresh(db, refresh_token="expired-idle-token")

    assert error.value.status_code == 401


def test_refresh_expiry_timestamp_is_naive_utc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixed_now = datetime(2026, 8, 10, 8, 0, 0)
    monkeypatch.setattr(
        "app.core.security.utc_now_naive",
        lambda: fixed_now,
    )

    _, expires_at = create_refresh_token()

    assert expires_at == fixed_now + timedelta(days=settings.refresh_token_expire_days)
    assert expires_at.tzinfo is None
