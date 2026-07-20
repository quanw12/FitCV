from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.application import (
    ApplicationCreate,
    ApplicationDetailResponse,
    ApplicationNoteCreate,
    ApplicationNoteResponse,
    ApplicationNoteUpdate,
    ApplicationStatsResponse,
    ApplicationStatus,
    ApplicationSummaryResponse,
    ApplicationUpdate,
)
from app.schemas.applications import (
    ApplicationRetryResponse,
    TrackedApplicationResponse,
)
from app.services import application_service

router = APIRouter()
student = require_role(AccountRole.student)
student_account = student


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


@router.post("", response_model=ApplicationDetailResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: ApplicationCreate,
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> ApplicationDetailResponse:
    return application_service.create_application(db, payload=payload, account=account)


@router.get("", response_model=list[ApplicationSummaryResponse])
def list_applications(
    search: str | None = Query(default=None, max_length=200),
    application_status: ApplicationStatus | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None, max_length=50),
    reminders_only: bool = False,
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> list[ApplicationSummaryResponse]:
    return application_service.list_applications(
        db,
        account=account,
        search=search,
        application_status=application_status,
        source=source,
        reminders_only=reminders_only,
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=ApplicationStatsResponse)
def get_application_stats(
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> ApplicationStatsResponse:
    return application_service.get_stats(db, account=account)


@router.get("/{application_id}", response_model=ApplicationDetailResponse)
def get_application(
    application_id: int,
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> ApplicationDetailResponse:
    return application_service.get_application(db, application_id=application_id, account=account)


@router.patch("/{application_id}", response_model=ApplicationDetailResponse)
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> ApplicationDetailResponse:
    return application_service.update_application(
        db,
        application_id=application_id,
        payload=payload,
        account=account,
    )


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    application_id: int,
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> Response:
    application_service.delete_application(db, application_id=application_id, account=account)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{application_id}/notes",
    response_model=ApplicationNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_application_note(
    application_id: int,
    payload: ApplicationNoteCreate,
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> ApplicationNoteResponse:
    return application_service.create_note(
        db,
        application_id=application_id,
        payload=payload,
        account=account,
    )


@router.patch("/{application_id}/notes/{note_id}", response_model=ApplicationNoteResponse)
def update_application_note(
    application_id: int,
    note_id: int,
    payload: ApplicationNoteUpdate,
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> ApplicationNoteResponse:
    return application_service.update_note(
        db,
        application_id=application_id,
        note_id=note_id,
        payload=payload,
        account=account,
    )


@router.delete("/{application_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application_note(
    application_id: int,
    note_id: int,
    account: Account = Depends(student_account),
    db: Session = Depends(get_db),
) -> Response:
    application_service.delete_note(
        db,
        application_id=application_id,
        note_id=note_id,
        account=account,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
