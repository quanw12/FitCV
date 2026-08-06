from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.platform import AuthRateLimit


LIMITS: dict[str, tuple[int, int]] = {
    "login": (5, 15 * 60),
    "register": (5, 60 * 60),
    "google": (10, 15 * 60),
    "forgot-password": (5, 15 * 60),
    "verify-reset": (10, 15 * 60),
    "reset-password": (10, 15 * 60),
    "refresh": (30, 15 * 60),
}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _key(action: str, request: Request, identifier: str) -> str:
    source = f"{action}:{client_ip(request)}:{identifier.strip().lower()}"
    return sha256(source.encode("utf-8")).hexdigest()


def consume(
    db: Session,
    *,
    action: str,
    request: Request,
    identifier: str,
) -> str:
    limit, window_seconds = LIMITS[action]
    now = _now()
    key_hash = _key(action, request, identifier)
    row = db.scalar(
        select(AuthRateLimit)
        .where(AuthRateLimit.key_hash == key_hash)
        .with_for_update()
    )
    if row is None:
        row = AuthRateLimit(
            key_hash=key_hash,
            action=action,
            attempt_count=1,
            window_started_at=now,
        )
        db.add(row)
        db.commit()
        return key_hash

    if row.blocked_until and row.blocked_until > now:
        retry_after = max(1, int((row.blocked_until - now).total_seconds()))
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    window_end = row.window_started_at + timedelta(seconds=window_seconds)
    if now >= window_end:
        row.attempt_count = 1
        row.window_started_at = now
        row.blocked_until = None
    else:
        row.attempt_count += 1
        if row.attempt_count > limit:
            row.blocked_until = window_end
            db.commit()
            retry_after = max(1, int((window_end - now).total_seconds()))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many authentication attempts. Try again later.",
                headers={"Retry-After": str(retry_after)},
            )
    db.commit()
    return key_hash


def clear(db: Session, key_hash: str) -> None:
    db.execute(delete(AuthRateLimit).where(AuthRateLimit.key_hash == key_hash))
    db.commit()
