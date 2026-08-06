from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.models.account import Account
from app.schemas.ai_tasks import AiTaskResponse
from app.services import ai_task_service

router = APIRouter()


@router.get("/{task_id}", response_model=AiTaskResponse)
def get_task_status(
    task_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AiTaskResponse:
    return ai_task_service.get_status(db, task_id=task_id, account=account)
