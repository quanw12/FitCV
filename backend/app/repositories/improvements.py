from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.improvement import (
    AiTask,
    AiTaskStatus,
    Cv,
    CvImprovementSuggestion,
    CvParseResult,
    MatchResult,
)
from app.models.analyzer import JobDescription

TASK_TYPE = "ImprovementReport"


def get_owned_match_result(
    db: Session,
    match_result_id: int,
    account_id: int,
    *,
    for_update: bool = False,
) -> MatchResult | None:
    statement = (
        select(MatchResult)
        .join(Cv, Cv.cv_id == MatchResult.cv_id)
        .where(
            MatchResult.match_result_id == match_result_id,
            Cv.account_id == account_id,
        )
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalar(statement)


def get_generation_context(
    db: Session,
    match_result_id: int,
) -> tuple[MatchResult, CvParseResult | None, str]:
    match = db.get(MatchResult, match_result_id)
    if match is None:
        raise LookupError("Match result not found.")
    if match.cv_parse_id is not None:
        parsed = db.scalar(
            select(CvParseResult).where(
                CvParseResult.cv_parse_id == match.cv_parse_id,
                CvParseResult.cv_id == match.cv_id,
                CvParseResult.parse_status == "Success",
            )
        )
        if parsed is None:
            raise LookupError("Successful CV parse linked to match not found.")
    else:
        # Legacy match rows predate cv_parse_id. Only those rows may fall back to the
        # latest successful parse for the CV.
        parsed = db.scalar(
            select(CvParseResult)
            .where(
                CvParseResult.cv_id == match.cv_id,
                CvParseResult.parse_status == "Success",
            )
            .order_by(CvParseResult.parsed_at.desc(), CvParseResult.cv_parse_id.desc())
            .limit(1)
        )
    if match.job_description_id is not None:
        job_description = db.get(JobDescription, match.job_description_id)
        if job_description is None:
            raise LookupError("Job description not found.")
        description = job_description.raw_text
    else:
        raise LookupError(
            "Immutable job-description snapshot not found. Run the analysis again."
        )
    return match, parsed, description


def get_latest_task(db: Session, match_result_id: int) -> AiTask | None:
    return db.scalar(
        select(AiTask)
        .where(
            AiTask.task_type == TASK_TYPE,
            AiTask.resource_id == match_result_id,
        )
        .order_by(AiTask.created_at.desc(), AiTask.ai_task_id.desc())
    )


def create_task(
    db: Session,
    match_result_id: int,
    provider: str,
    model_name: str | None,
) -> AiTask:
    task = AiTask(
        task_type=TASK_TYPE,
        resource_id=match_result_id,
        status=AiTaskStatus.pending,
        provider=provider,
        model_name=model_name,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def mark_active_task_failed(
    db: Session,
    task_id: int,
    *,
    error_message: str,
    completed_at: datetime,
) -> bool:
    result = db.execute(
        update(AiTask)
        .where(
            AiTask.ai_task_id == task_id,
            AiTask.status.in_([AiTaskStatus.pending, AiTaskStatus.processing]),
        )
        .values(
            status=AiTaskStatus.failed,
            error_message=error_message,
            completed_at=completed_at,
        )
        .execution_options(synchronize_session=False)
    )
    return result.rowcount == 1


def claim_task(db: Session, task_id: int, *, started_at: datetime) -> AiTask | None:
    result = db.execute(
        update(AiTask)
        .where(
            AiTask.ai_task_id == task_id,
            AiTask.status == AiTaskStatus.pending,
        )
        .values(status=AiTaskStatus.processing, started_at=started_at)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        return None
    db.commit()
    return db.get(AiTask, task_id)


def complete_claimed_task(
    db: Session,
    task_id: int,
    *,
    completed_at: datetime,
) -> bool:
    result = db.execute(
        update(AiTask)
        .where(
            AiTask.ai_task_id == task_id,
            AiTask.status == AiTaskStatus.processing,
        )
        .values(
            status=AiTaskStatus.success,
            error_message=None,
            completed_at=completed_at,
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        return False
    db.commit()
    return True


def get_suggestions(
    db: Session,
    match_result_id: int,
) -> list[CvImprovementSuggestion]:
    return list(db.scalars(
        select(CvImprovementSuggestion)
        .where(CvImprovementSuggestion.match_result_id == match_result_id)
        .order_by(
            CvImprovementSuggestion.suggestion_type,
            CvImprovementSuggestion.sort_order,
        )
    ))


def replace_suggestions(
    db: Session,
    match_result_id: int,
    rows: list[CvImprovementSuggestion],
) -> None:
    db.execute(
        delete(CvImprovementSuggestion).where(
            CvImprovementSuggestion.match_result_id == match_result_id
        )
    )
    db.add_all(rows)


def get_report_source_timestamps(
    db: Session,
    match_result_id: int,
) -> list[datetime | None]:
    match, parsed, _ = get_generation_context(db, match_result_id)
    cv = db.get(Cv, match.cv_id)
    if cv is None:
        return []

    job_timestamps: list[datetime | None] = []
    if match.job_description_id is not None:
        job_description = db.get(JobDescription, match.job_description_id)
        if job_description is not None:
            job_timestamps.append(job_description.created_at)
    return [
        cv.uploaded_at,
        parsed.parsed_at if parsed else None,
        *job_timestamps,
        match.generated_at,
    ]
