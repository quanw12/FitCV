from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.pipeline import (
    PipelineApplicationResponse,
    PipelineNoteCreate,
    PipelineNoteResponse,
    PipelineStageHistoryResponse,
    PipelineStageUpdate,
)
from app.services import pipeline_service

router = APIRouter()
manager = require_role(
    AccountRole.hr,
    AccountRole.hiring_manager,
    AccountRole.admin,
)


@router.get("", response_model=list[PipelineApplicationResponse])
def list_pipeline(
    job_id: int | None = None,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return pipeline_service.list_applications(db, account, job_id)


@router.patch(
    "/applications/{application_id}/stage",
    response_model=PipelineApplicationResponse,
)
def move_pipeline_stage(
    application_id: int,
    payload: PipelineStageUpdate,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return pipeline_service.move_stage(
        db, account, application_id, payload.stage
    )


@router.get(
    "/applications/{application_id}/notes",
    response_model=list[PipelineNoteResponse],
)
def list_pipeline_notes(
    application_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return pipeline_service.list_notes(db, account, application_id)


@router.post(
    "/applications/{application_id}/notes",
    response_model=PipelineNoteResponse,
    status_code=201,
)
def add_pipeline_note(
    application_id: int,
    payload: PipelineNoteCreate,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return pipeline_service.add_note(
        db, account, application_id, payload.content
    )


@router.get(
    "/applications/{application_id}/history",
    response_model=list[PipelineStageHistoryResponse],
)
def list_pipeline_history(
    application_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return pipeline_service.list_history(db, account, application_id)
