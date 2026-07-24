from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.account import Account
from app.repositories import pipeline
from app.schemas.pipeline import (
    PipelineApplicationResponse,
    PipelineNoteResponse,
    PipelineStageHistoryResponse,
)

TERMINAL_STATUS = {"Hired": "Hired", "Rejected": "Rejected"}


def _company_id(account: Account) -> int:
    if account.company_id is None:
        raise HTTPException(
            status_code=400,
            detail="A company must be assigned to manage the pipeline.",
        )
    return account.company_id


def _managed_application(db: Session, account: Account, application_id: int):
    application = pipeline.managed_application(
        db, application_id, _company_id(account)
    )
    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Application not found for this company.",
        )
    return application


def list_applications(
    db: Session, account: Account, job_id: int | None = None
) -> list[PipelineApplicationResponse]:
    company_id = _company_id(account)
    rows = pipeline.application_rows(db, company_id, job_id)
    return [
        PipelineApplicationResponse(
            application_id=application.application_id,
            job_id=job.job_id,
            job_title=job.title,
            candidate_name=candidate.full_name or "Unnamed candidate",
            candidate_email=candidate.email or "",
            candidate_phone=candidate.phone or "",
            current_stage=application.current_stage,
            status=application.status,
            applied_at=application.applied_at,
            overall_score=(
                float(match.overall_score)
                if match is not None and match.overall_score is not None
                else None
            ),
            match_label=match.match_label if match is not None else None,
            note_count=int(note_count),
        )
        for application, candidate, job, match, note_count in rows
    ]


def move_stage(
    db: Session, account: Account, application_id: int, stage: str
) -> PipelineApplicationResponse:
    application = _managed_application(db, account, application_id)
    if application.status == "Withdrawn":
        raise HTTPException(
            status_code=409,
            detail="A withdrawn application cannot move through the pipeline.",
        )
    if application.current_stage == stage:
        raise HTTPException(
            status_code=409,
            detail=f"Application is already in {stage}.",
        )
    pipeline.update_stage(
        db,
        application,
        stage=stage,
        status=TERMINAL_STATUS.get(stage, "Active"),
        account_id=account.account_id,
    )
    return next(
        item
        for item in list_applications(db, account, job_id=application.job_id)
        if item.application_id == application_id
    )


def add_note(
    db: Session, account: Account, application_id: int, content: str
) -> PipelineNoteResponse:
    _managed_application(db, account, application_id)
    note = pipeline.create_note(
        db,
        application_id,
        account_id=account.account_id,
        content=content,
    )
    return PipelineNoteResponse(
        note_id=note.note_id,
        application_id=note.application_id,
        author_name=account.full_name,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def list_notes(
    db: Session, account: Account, application_id: int
) -> list[PipelineNoteResponse]:
    _managed_application(db, account, application_id)
    return [
        PipelineNoteResponse(
            note_id=note.note_id,
            application_id=note.application_id,
            author_name=author_name or "Former team member",
            content=note.content,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note, author_name in pipeline.note_rows(db, application_id)
    ]


def list_history(
    db: Session, account: Account, application_id: int
) -> list[PipelineStageHistoryResponse]:
    _managed_application(db, account, application_id)
    return [
        PipelineStageHistoryResponse(
            stage_history_id=history.stage_history_id,
            previous_stage=history.previous_stage,
            new_stage=history.new_stage,
            changed_by_name=author_name or "Former team member",
            changed_at=history.changed_at,
        )
        for history, author_name in pipeline.history_rows(db, application_id)
    ]
