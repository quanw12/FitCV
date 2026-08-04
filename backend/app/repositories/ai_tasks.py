from datetime import datetime

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.improvement import AiTask, AiTaskStatus


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
    task.error_message = error_message[:1000]
    task.locked_by = None
    task.heartbeat_at = now
    if task.attempt_count < task.max_attempts:
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
        task.locked_by = None
        task.error_message = "Task lease expired and was recovered."
        if task.attempt_count < task.max_attempts:
            task.status = AiTaskStatus.pending
            task.available_at = now
            task.started_at = None
        else:
            task.status = AiTaskStatus.failed
            task.completed_at = now
    db.commit()
    return len(tasks)
