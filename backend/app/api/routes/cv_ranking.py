from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.applications import RankedApplicationResponse
from app.models.platform import ScreeningBatchStatus
from app.schemas.cv_ranking import (
    BatchParseResponse,
    ScreeningBatchSummary,
    ScreeningSelectionRequest,
)
from app.services import ai_task_service, application_service, cv_ranking_service

router = APIRouter()
manager = require_role(AccountRole.hr, AccountRole.hiring_manager, AccountRole.admin)


@router.post(
    "/parse",
    response_model=BatchParseResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def parse_cv_batch(
    background_tasks: BackgroundTasks,
    job_description: str = Form(..., min_length=50),
    title: str | None = Form(default=None, max_length=200),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
) -> BatchParseResponse:
    response = await cv_ranking_service.create_screening_batch(
        db,
        files=files,
        job_description=job_description,
        title=title,
        account=account,
    )
    if (
        response.screening_batch_id is not None
        and ai_task_service.should_eager_execute()
    ):
        background_tasks.add_task(
            cv_ranking_service.run_screening_batch,
            response.screening_batch_id,
        )
    return response


@router.get("/batches", response_model=list[ScreeningBatchSummary])
def list_screening_batches(
    q: str | None = Query(default=None, max_length=200),
    batch_status: ScreeningBatchStatus | None = Query(default=None, alias="status"),
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    min_score: float | None = Query(default=None, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
) -> list[ScreeningBatchSummary]:
    return cv_ranking_service.list_screening_history(
        db,
        account=account,
        query=q,
        status_filter=batch_status,
        created_from=created_from,
        created_to=created_to,
        min_score=min_score,
        limit=limit,
        offset=offset,
    )


@router.get("/batches/{batch_id}", response_model=BatchParseResponse)
def get_screening_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
) -> BatchParseResponse:
    return cv_ranking_service.get_screening_batch(
        db, batch_id=batch_id, account=account
    )


@router.patch("/batches/{batch_id}/selection", response_model=BatchParseResponse)
def save_screening_selection(
    batch_id: int,
    payload: ScreeningSelectionRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
) -> BatchParseResponse:
    return cv_ranking_service.save_selection(
        db, batch_id=batch_id, request=payload, account=account
    )


@router.get("/batches/{batch_id}/candidates/{candidate_id}/cv")
def download_screening_candidate_cv(
    batch_id: int,
    candidate_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
) -> FileResponse:
    return cv_ranking_service.download_screening_cv(
        db,
        batch_id=batch_id,
        candidate_id=candidate_id,
        account=account,
    )


@router.get(
    "/jobs/{job_id}/applications",
    response_model=list[RankedApplicationResponse],
)
def list_ranked_applications(
    job_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
) -> list[RankedApplicationResponse]:
    return application_service.ranked(db, job_id=job_id, account=account)


@router.get("/jobs/{job_id}/cvs/archive")
def download_job_application_cvs(
    job_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
) -> Response:
    content, file_name = application_service.download_all_cvs(
        db,
        job_id=job_id,
        account=account,
    )
    return Response(
        content=content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
        },
    )
