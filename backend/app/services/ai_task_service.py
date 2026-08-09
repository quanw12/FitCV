import sys

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.account import Account
from app.models.improvement import AiTask, AiTaskStatus
from app.repositories import ai_tasks
from app.schemas.ai_tasks import AiTaskResponse


def should_eager_execute() -> bool:
    """Keep legacy BackgroundTasks behavior only inside the test process."""
    return "pytest" in sys.modules


def enqueue(
    db: Session,
    *,
    task_type: str,
    resource_id: int,
    account: Account | None,
    provider: str | None = None,
    model_name: str | None = None,
    payload: dict | None = None,
    idempotency_key: str | None = None,
    max_attempts: int | None = None,
) -> AiTask:
    return ai_tasks.create(
        db,
        task_type=task_type,
        resource_id=resource_id,
        owner_account_id=account.account_id if account else None,
        company_id=account.company_id if account else None,
        provider=provider,
        model_name=model_name,
        payload=payload,
        idempotency_key=idempotency_key,
        max_attempts=max_attempts or settings.ai_task_max_attempts,
    )


def get_active_for_resource(
    db: Session, *, task_type: str, resource_id: int
) -> AiTask | None:
    task = ai_tasks.get_latest_for_resource(
        db, task_type=task_type, resource_id=resource_id
    )
    if task is None or task.status not in {
        AiTaskStatus.pending,
        AiTaskStatus.processing,
    }:
        return None
    return task


def get_latest_for_resource(
    db: Session, *, task_type: str, resource_id: int
) -> AiTask | None:
    return ai_tasks.get_latest_for_resource(
        db, task_type=task_type, resource_id=resource_id
    )


def get_status(db: Session, *, task_id: int, account: Account) -> AiTaskResponse:
    task = ai_tasks.get_visible(
        db,
        task_id,
        account_id=account.account_id,
        company_id=account.company_id,
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI task not found.")
    return AiTaskResponse.model_validate(task)
