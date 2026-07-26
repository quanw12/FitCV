from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Account,
    Application,
    ApplicationNote,
    ApplicationStageHistory,
    Candidate,
    Job,
    MatchResult,
)


def managed_application(
    db: Session, application_id: int, company_id: int
) -> Application | None:
    return db.scalar(
        select(Application)
        .join(Job, Job.job_id == Application.job_id)
        .where(
            Application.application_id == application_id,
            Job.company_id == company_id,
        )
    )


def application_rows(
    db: Session, company_id: int, job_id: int | None = None
):
    latest_match = (
        select(
            MatchResult.application_id.label("application_id"),
            func.max(MatchResult.match_result_id).label("match_result_id"),
        )
        .where(MatchResult.application_id.is_not(None))
        .group_by(MatchResult.application_id)
        .subquery()
    )
    note_counts = (
        select(
            ApplicationNote.application_id.label("application_id"),
            func.count(ApplicationNote.note_id).label("note_count"),
        )
        .group_by(ApplicationNote.application_id)
        .subquery()
    )
    statement = (
        select(
            Application,
            Candidate,
            Job,
            MatchResult,
            func.coalesce(note_counts.c.note_count, 0),
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .outerjoin(
            latest_match,
            latest_match.c.application_id == Application.application_id,
        )
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match.c.match_result_id,
        )
        .outerjoin(
            note_counts,
            note_counts.c.application_id == Application.application_id,
        )
        .where(Job.company_id == company_id)
        .order_by(Application.applied_at.desc(), Application.application_id.desc())
    )
    if job_id is not None:
        statement = statement.where(Job.job_id == job_id)
    return db.execute(statement).all()


def update_stage(
    db: Session,
    application: Application,
    *,
    stage: str,
    status: str,
    account_id: int,
) -> Application:
    previous_stage = application.current_stage
    application.current_stage = stage
    application.status = status
    db.add(
        ApplicationStageHistory(
            application_id=application.application_id,
            previous_stage=previous_stage,
            new_stage=stage,
            changed_by_account_id=account_id,
        )
    )
    db.commit()
    db.refresh(application)
    return application


def create_note(
    db: Session,
    application_id: int,
    *,
    account_id: int,
    content: str,
) -> ApplicationNote:
    note = ApplicationNote(
        application_id=application_id,
        author_account_id=account_id,
        content=content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def note_rows(db: Session, application_id: int):
    return db.execute(
        select(ApplicationNote, Account.full_name)
        .outerjoin(Account, Account.account_id == ApplicationNote.author_account_id)
        .where(ApplicationNote.application_id == application_id)
        .order_by(ApplicationNote.created_at.desc(), ApplicationNote.note_id.desc())
    ).all()


def history_rows(db: Session, application_id: int):
    return db.execute(
        select(ApplicationStageHistory, Account.full_name)
        .outerjoin(
            Account,
            Account.account_id
            == ApplicationStageHistory.changed_by_account_id,
        )
        .where(ApplicationStageHistory.application_id == application_id)
        .order_by(
            ApplicationStageHistory.changed_at.desc(),
            ApplicationStageHistory.stage_history_id.desc(),
        )
    ).all()
