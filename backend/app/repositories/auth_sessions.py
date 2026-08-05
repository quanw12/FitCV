from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.platform import AuthSessionRecord


def create(
    db: Session,
    *,
    account_id: int,
    refresh_token_hash: str,
    expires_at: datetime,
) -> AuthSessionRecord:
    record = AuthSessionRecord(
        session_id=str(uuid4()),
        account_id=account_id,
        refresh_token_hash=refresh_token_hash,
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_active_by_id(
    db: Session, session_id: str, *, now: datetime
) -> AuthSessionRecord | None:
    return db.scalar(
        select(AuthSessionRecord).where(
            AuthSessionRecord.session_id == session_id,
            AuthSessionRecord.revoked_at.is_(None),
            AuthSessionRecord.expires_at > now,
        )
    )


def get_active_by_refresh_hash(
    db: Session, refresh_token_hash: str, *, now: datetime, for_update: bool = False
) -> AuthSessionRecord | None:
    statement = select(AuthSessionRecord).where(
        AuthSessionRecord.refresh_token_hash == refresh_token_hash,
        AuthSessionRecord.revoked_at.is_(None),
        AuthSessionRecord.expires_at > now,
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalar(statement)


def rotate(
    db: Session,
    record: AuthSessionRecord,
    *,
    refresh_token_hash: str,
    expires_at: datetime,
    now: datetime,
) -> None:
    record.refresh_token_hash = refresh_token_hash
    record.expires_at = expires_at
    record.last_used_at = now
    db.commit()


def revoke(
    db: Session,
    session_id: str,
    *,
    reason: str,
    now: datetime,
) -> bool:
    result = db.execute(
        update(AuthSessionRecord)
        .where(
            AuthSessionRecord.session_id == session_id,
            AuthSessionRecord.revoked_at.is_(None),
        )
        .values(revoked_at=now, revoke_reason=reason)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount == 1


def revoke_by_refresh_hash(
    db: Session,
    refresh_token_hash: str,
    *,
    reason: str,
    now: datetime,
) -> bool:
    result = db.execute(
        update(AuthSessionRecord)
        .where(
            AuthSessionRecord.refresh_token_hash == refresh_token_hash,
            AuthSessionRecord.revoked_at.is_(None),
        )
        .values(revoked_at=now, revoke_reason=reason)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount == 1


def revoke_all(
    db: Session,
    account_id: int,
    *,
    reason: str,
    now: datetime,
) -> int:
    result = db.execute(
        update(AuthSessionRecord)
        .where(
            AuthSessionRecord.account_id == account_id,
            AuthSessionRecord.revoked_at.is_(None),
        )
        .values(revoked_at=now, revoke_reason=reason)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount
