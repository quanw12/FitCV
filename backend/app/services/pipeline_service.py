from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import ApplicationStageHistory
from app.models.account import Account
from app.repositories import email_workflow, pipeline
from app.schemas.pipeline import (
    PipelineBulkStageUpdateResponse,
    PipelineApplicationResponse,
    PipelineNoteResponse,
    PipelineStageHistoryResponse,
)

TERMINAL_STATUS = {"Hired": "Hired", "Rejected": "Rejected"}
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "Applied": {"Screening", "Rejected"},
    "Screening": {"Interview", "Rejected"},
    "Interview": {"Offer", "Rejected"},
    "Offer": {"Hired", "Rejected"},
    "Hired": set(),
    "Rejected": set(),
}


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


def _validate_transition(application, stage: str) -> None:
    allowed = sorted(ALLOWED_TRANSITIONS.get(application.current_stage, set()))
    if stage not in ALLOWED_TRANSITIONS.get(application.current_stage, set()):
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"Cannot move application from {application.current_stage} "
                    f"to {stage}."
                ),
                "current_stage": application.current_stage,
                "requested_stage": stage,
                "allowed_stages": allowed,
            },
        )


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
    _validate_transition(application, stage)
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


def bulk_move_stage(
    db: Session,
    account: Account,
    application_ids: list[int],
    stage: str,
) -> PipelineBulkStageUpdateResponse:
    company_id = _company_id(account)
    applications = pipeline.managed_applications(db, application_ids, company_id)
    found_ids = {application.application_id for application in applications}
    missing_ids = [
        application_id
        for application_id in application_ids
        if application_id not in found_ids
    ]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail="One or more applications were not found for this company.",
        )

    withdrawn = [
        application.application_id
        for application in applications
        if application.status == "Withdrawn"
    ]
    if withdrawn:
        raise HTTPException(
            status_code=409,
            detail="A withdrawn application cannot move through the pipeline.",
        )

    by_id = {application.application_id: application for application in applications}
    changed_ids = [
        application_id
        for application_id in application_ids
        if by_id[application_id].current_stage != stage
    ]
    skipped_ids = [
        application_id
        for application_id in application_ids
        if application_id not in changed_ids
    ]

    for application_id in changed_ids:
        _validate_transition(by_id[application_id], stage)

    changed_applications = [by_id[application_id] for application_id in changed_ids]
    histories = pipeline.update_stages(
        db,
        changed_applications,
        stage=stage,
        status=TERMINAL_STATUS.get(stage, "Active"),
        account_id=account.account_id,
    )

    rows = list_applications(db, account)
    updated_by_id = {
        item.application_id: item
        for item in rows
        if item.application_id in changed_ids
    }
    return PipelineBulkStageUpdateResponse(
        updated=[updated_by_id[application_id] for application_id in changed_ids],
        skipped_application_ids=skipped_ids,
        history_ids=[history.stage_history_id for history in histories],
    )


def reopen_application(
    db: Session,
    account: Account,
    application_id: int,
    stage: str = "Applied",
) -> PipelineApplicationResponse:
    application = _managed_application(db, account, application_id)
    if application.current_stage not in TERMINAL_STATUS:
        raise HTTPException(
            status_code=409,
            detail="Only a Hired or Rejected application can be reopened.",
        )
    if stage not in {"Applied", "Screening", "Interview", "Offer"}:
        raise HTTPException(
            status_code=422,
            detail="Reopen stage must be Applied, Screening, Interview, or Offer.",
        )

    previous_stage = application.current_stage
    application.current_stage = stage
    application.status = "Active"
    db.add(
        ApplicationStageHistory(
            application_id=application.application_id,
            previous_stage=previous_stage,
            new_stage=stage,
            changed_by_account_id=account.account_id,
        )
    )
    email_workflow.invalidate_pending_drafts(
        db,
        company_id=_company_id(account),
        application_id=application.application_id,
        reason="Pipeline application was reopened; review and regenerate this draft.",
        commit=False,
    )
    db.commit()
    db.refresh(application)
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
