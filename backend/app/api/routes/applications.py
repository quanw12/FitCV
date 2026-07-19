from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.applications import (
    ApplicationRetryResponse,
    TrackedApplicationResponse,
)
from app.services import application_service

router = APIRouter()
student = require_role(AccountRole.student)


@router.get("/mine", response_model=list[TrackedApplicationResponse])
def list_my_applications(
    db: Session = Depends(get_db),
    account: Account = Depends(student),
):
    return application_service.mine(db, account=account)


@router.post(
    "/{application_id}/retry-analysis",
    response_model=ApplicationRetryResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def retry_application_analysis(
    application_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
):
    response = application_service.retry_analysis(
        db,
        application_id=application_id,
        account=account,
    )
    background_tasks.add_task(
        application_service.run_analysis,
        application_id,
    )
    return response


@router.get("/{application_id}/cv/download", response_class=FileResponse)
def download_application_cv(
    application_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
):
    return application_service.download(db, application_id=application_id, account=account)
