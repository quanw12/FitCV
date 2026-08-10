import re
from datetime import datetime

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.improvement import (
    AiTask,
    AiTaskAttemptHistory,
    AiTaskAttemptOutcome,
    AiTaskStatus,
)


_REDACTED = "[redacted]"
_ERROR_FALLBACK = "AI task attempt failed."
_SENSITIVE_KEY = (
    r"(?:api[_-]?key|key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|"
    r"client[_-]?secret|secret|password|passwd|pwd|authorization|auth|signature|sig)"
)
_PII_KEY = (
    r"(?:e-?mail|full[_-]?name|candidate[_-]?name|name|phone|mobile|telephone|tel|"
    r"address|ssn)"
)
_PRIVATE_KEY = rf"(?:{_SENSITIVE_KEY}|{_PII_KEY})"
_DATABASE_URL_PATTERN = re.compile(
    r"(?i)\b(?:postgres(?:ql)?|mysql(?:\+[a-z0-9_]+)?|mariadb(?:\+[a-z0-9_]+)?|"
    r"mongodb(?:\+srv)?|redis(?:\+[a-z0-9_]+)?|rediss|mssql(?:\+[a-z0-9_]+)?|"
    r"oracle(?:\+[a-z0-9_]+)?|sqlite(?:\+[a-z0-9_]+)?|cockroachdb(?:\+[a-z0-9_]+)?)"
    r"://[^\s,;]+"
)
_CREDENTIAL_URL_PATTERN = re.compile(
    r"(?i)\b[a-z][a-z0-9+.-]*://[^/\s:@]+:[^@\s/]+@[^\s,;]+"
)
_AUTHORIZATION_PATTERN = re.compile(
    r"(?i)\b(?P<prefix>authorization\s*[:=]\s*)?"
    r"(?P<scheme>bearer|basic)\s+"
    r"(?P<credential>[a-z0-9._~+/=:-]+)"
)
_URL_QUERY_SECRET_PATTERN = re.compile(
    r"(?i)(?P<prefix>[?&]"
    + _SENSITIVE_KEY
    + r"\s*=\s*)(?P<value>[^&#\s]*)"
)
_LABELED_QUOTED_VALUE_PATTERN = re.compile(
    r"(?is)(?P<prefix>(?<![\w-])[\"']?"
    + _PRIVATE_KEY
    + r"[\"']?(?![\w-])\s*[:=]\s*)"
    r"(?P<quote>[\"'])(?:\\.|(?!(?P=quote)).)*(?P=quote)"
)
_LABELED_UNQUOTED_VALUE_PATTERN = re.compile(
    r"(?i)(?P<prefix>(?<![\w-])[\"']?"
    + _PRIVATE_KEY
    + r"[\"']?(?![\w-])\s*[:=])"
    r"(?!\s*(?:[\"']|\[redacted\]|(?:bearer|basic)\s+\[redacted\]))"
    r"(?P<spacing>\s*)(?P<value>[^,;\r\n&}\]]+)"
)
_EMAIL_PATTERN = re.compile(
    r"(?i)(?<![\w.+-])[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?![\w.-])"
)
_SSN_PATTERN = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
_RESIDUAL_PRIVATE_VALUE_PATTERN = re.compile(
    r"(?i)(?<![\w-])[\"']?"
    + _PRIVATE_KEY
    + r"[\"']?(?![\w-])\s*[:=]"
    r"(?!\s*(?:[\"']?\[redacted\][\"']?|(?:bearer|basic)\s+\[redacted\]))"
)


def _sanitize_attempt_error(error_message: str) -> str:
    if not isinstance(error_message, str):
        return _ERROR_FALLBACK
    try:
        sanitized = _DATABASE_URL_PATTERN.sub(_REDACTED, error_message)
        sanitized = _CREDENTIAL_URL_PATTERN.sub(_REDACTED, sanitized)
        sanitized = _AUTHORIZATION_PATTERN.sub(
            lambda match: (
                f"{match.group('prefix') or ''}"
                f"{match.group('scheme').title()} {_REDACTED}"
            ),
            sanitized,
        )
        sanitized = _URL_QUERY_SECRET_PATTERN.sub(
            lambda match: f"{match.group('prefix')}{_REDACTED}",
            sanitized,
        )
        sanitized = _LABELED_QUOTED_VALUE_PATTERN.sub(
            lambda match: (
                f"{match.group('prefix')}{match.group('quote')}"
                f"{_REDACTED}{match.group('quote')}"
            ),
            sanitized,
        )
        sanitized = _LABELED_UNQUOTED_VALUE_PATTERN.sub(
            lambda match: (
                f"{match.group('prefix')}{match.group('spacing')}{_REDACTED}"
            ),
            sanitized,
        )
        sanitized = _EMAIL_PATTERN.sub(_REDACTED, sanitized)
        sanitized = _SSN_PATTERN.sub(_REDACTED, sanitized)
        sanitized = " ".join(sanitized.split())
        if not sanitized:
            return _ERROR_FALLBACK
        if any(
            pattern.search(sanitized)
            for pattern in (
                _DATABASE_URL_PATTERN,
                _CREDENTIAL_URL_PATTERN,
                _AUTHORIZATION_PATTERN,
                _EMAIL_PATTERN,
                _SSN_PATTERN,
                _RESIDUAL_PRIVATE_VALUE_PATTERN,
            )
        ):
            return _ERROR_FALLBACK
        return sanitized[:1000]
    except (IndexError, re.error, TypeError, ValueError):
        return _ERROR_FALLBACK


def _append_attempt_history(
    db: Session,
    *,
    task: AiTask,
    outcome: AiTaskAttemptOutcome,
    error_message: str,
    failed_at: datetime,
) -> str:
    sanitized_error = _sanitize_attempt_error(error_message)
    db.add(
        AiTaskAttemptHistory(
            ai_task_id=task.ai_task_id,
            attempt_number=task.attempt_count,
            outcome=outcome,
            error_message=sanitized_error,
            failed_at=failed_at,
        )
    )
    return sanitized_error


def create(
    db: Session,
    *,
    task_type: str,
    resource_id: int,
    owner_account_id: int | None,
    company_id: int | None,
    provider: str | None = None,
    model_name: str | None = None,
    payload: dict | None = None,
    idempotency_key: str | None = None,
    max_attempts: int = 3,
) -> AiTask:
    if idempotency_key:
        existing = db.scalar(
            select(AiTask).where(AiTask.idempotency_key == idempotency_key)
        )
        if existing is not None:
            return existing
    task = AiTask(
        task_type=task_type,
        resource_id=resource_id,
        owner_account_id=owner_account_id,
        company_id=company_id,
        provider=provider,
        model_name=model_name,
        payload_json=payload,
        idempotency_key=idempotency_key,
        max_attempts=max_attempts,
        status=AiTaskStatus.pending,
    )
    db.add(task)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if idempotency_key:
            existing = db.scalar(
                select(AiTask).where(AiTask.idempotency_key == idempotency_key)
            )
            if existing is not None:
                return existing
        raise
    db.refresh(task)
    return task


def get_visible(
    db: Session,
    task_id: int,
    *,
    account_id: int,
    company_id: int | None,
) -> AiTask | None:
    visibility = [AiTask.owner_account_id == account_id]
    if company_id is not None:
        visibility.append(AiTask.company_id == company_id)
    return db.scalar(
        select(AiTask).where(
            AiTask.ai_task_id == task_id,
            or_(*visibility),
        )
    )


def get_latest_for_resource(
    db: Session, *, task_type: str, resource_id: int
) -> AiTask | None:
    return db.scalar(
        select(AiTask)
        .where(
            AiTask.task_type == task_type,
            AiTask.resource_id == resource_id,
        )
        .order_by(AiTask.ai_task_id.desc())
        .limit(1)
    )


def claim_next(db: Session, *, worker_id: str, now: datetime) -> AiTask | None:
    task = db.scalar(
        select(AiTask)
        .where(
            AiTask.status == AiTaskStatus.pending,
            AiTask.available_at <= now,
        )
        .order_by(AiTask.available_at, AiTask.created_at, AiTask.ai_task_id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if task is None:
        db.rollback()
        return None
    task.status = AiTaskStatus.processing
    task.attempt_count += 1
    task.started_at = now
    task.heartbeat_at = now
    task.locked_by = worker_id
    task.error_message = None
    db.commit()
    db.refresh(task)
    return task


def heartbeat(db: Session, task_id: int, *, worker_id: str, now: datetime) -> bool:
    result = db.execute(
        update(AiTask)
        .where(
            AiTask.ai_task_id == task_id,
            AiTask.status == AiTaskStatus.processing,
            AiTask.locked_by == worker_id,
        )
        .values(heartbeat_at=now)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount == 1


def complete(db: Session, task_id: int, *, worker_id: str, now: datetime) -> bool:
    result = db.execute(
        update(AiTask)
        .where(
            AiTask.ai_task_id == task_id,
            AiTask.status == AiTaskStatus.processing,
            AiTask.locked_by == worker_id,
        )
        .values(
            status=AiTaskStatus.success,
            completed_at=now,
            heartbeat_at=now,
            locked_by=None,
            error_message=None,
        )
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount == 1


def fail_or_retry(
    db: Session,
    task_id: int,
    *,
    worker_id: str,
    now: datetime,
    available_at: datetime,
    error_message: str,
) -> AiTask | None:
    task = db.scalar(
        select(AiTask)
        .where(
            AiTask.ai_task_id == task_id,
            AiTask.status == AiTaskStatus.processing,
            AiTask.locked_by == worker_id,
        )
        .with_for_update()
    )
    if task is None:
        db.rollback()
        return None
    will_retry = task.attempt_count < task.max_attempts
    sanitized_error = _append_attempt_history(
        db,
        task=task,
        outcome=(
            AiTaskAttemptOutcome.retry_scheduled
            if will_retry
            else AiTaskAttemptOutcome.terminal_failure
        ),
        error_message=error_message,
        failed_at=now,
    )
    task.error_message = sanitized_error
    task.locked_by = None
    task.heartbeat_at = now
    if will_retry:
        task.status = AiTaskStatus.pending
        task.available_at = available_at
        task.started_at = None
    else:
        task.status = AiTaskStatus.failed
        task.completed_at = now
    db.commit()
    db.refresh(task)
    return task


def recover_stale(db: Session, *, stale_before: datetime, now: datetime) -> int:
    tasks = list(
        db.scalars(
            select(AiTask)
            .where(
                AiTask.status == AiTaskStatus.processing,
                or_(
                    AiTask.heartbeat_at < stale_before,
                    AiTask.heartbeat_at.is_(None),
                ),
            )
            .with_for_update(skip_locked=True)
        )
    )
    for task in tasks:
        recovery_message = "Task lease expired and was recovered."
        sanitized_error = _append_attempt_history(
            db,
            task=task,
            outcome=AiTaskAttemptOutcome.stale_recovery,
            error_message=recovery_message,
            failed_at=now,
        )
        task.locked_by = None
        task.error_message = sanitized_error
        if task.attempt_count < task.max_attempts:
            task.status = AiTaskStatus.pending
            task.available_at = now
            task.started_at = None
        else:
            task.status = AiTaskStatus.failed
            task.completed_at = now
    db.commit()
    return len(tasks)
