from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Application,
    ApplicationStageHistory,
    Job,
    MatchResult,
    Position,
)


def job_rows(db: Session, company_id: int):
    """Published, non-archived jobs for the company, with department name."""
    statement = (
        select(Job, Position.full_name)
        .outerjoin(Position, Position.position_id == Job.position_id)
        .where(
            Job.company_id == company_id,
            Job.status == "Published",
            Job.archived_at.is_(None),
        )
        .order_by(Job.created_at.desc(), Job.job_id.desc())
    )
    return db.execute(statement).all()


def application_rows_with_scores(
    db: Session, company_id: int, from_dt: datetime, to_dt: datetime
):
    """Applications applied in [from_dt, to_dt] with their latest match score."""
    latest_match = (
        select(
            MatchResult.application_id.label("application_id"),
            func.max(MatchResult.match_result_id).label("match_result_id"),
        )
        .where(MatchResult.application_id.is_not(None))
        .group_by(MatchResult.application_id)
        .subquery()
    )
    statement = (
        select(Application, MatchResult.overall_score)
        .join(Job, Job.job_id == Application.job_id)
        .outerjoin(
            latest_match,
            latest_match.c.application_id == Application.application_id,
        )
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match.c.match_result_id,
        )
        .where(
            Job.company_id == company_id,
            Application.applied_at >= from_dt,
            Application.applied_at <= to_dt,
        )
        .order_by(Application.applied_at, Application.application_id)
    )
    return db.execute(statement).all()


def first_reached_stage_map(
    db: Session,
    company_id: int,
    from_dt: datetime,
    to_dt: datetime,
    stage: str,
) -> dict[int, datetime]:
    """application_id -> earliest changed_at where history reached `stage`."""
    rows = db.execute(
        select(
            ApplicationStageHistory.application_id,
            func.min(ApplicationStageHistory.changed_at).label("first_at"),
        )
        .join(
            Application,
            Application.application_id
            == ApplicationStageHistory.application_id,
        )
        .join(Job, Job.job_id == Application.job_id)
        .where(
            Job.company_id == company_id,
            Application.applied_at >= from_dt,
            Application.applied_at <= to_dt,
            ApplicationStageHistory.new_stage == stage,
        )
        .group_by(ApplicationStageHistory.application_id)
    ).all()
    return {app_id: first_at for app_id, first_at in rows}
