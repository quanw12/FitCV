import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.account import Account, AccountRole
from app.models.improvement import AiTask, AiTaskStatus, MatchResult
from app.repositories import improvements
from app.schemas.improvement import GenerateImprovementResponse, ImprovementReportResponse
from app.services.improvement_provider import ImprovementProviderError, get_improvement_provider, validate_report_grounding

logger = logging.getLogger(__name__)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _owned_match_or_404(
    db: Session, match_result_id: int, account: Account, *, for_update: bool = False
) -> MatchResult:
    match = improvements.get_owned_match_result(
        db, match_result_id, account.account_id, for_update=for_update
    )
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match result not found.")
    if account.role != AccountRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Improvement suggestions are available for student accounts.",
        )
    return match


def _mark_stale_task_failed(db: Session, task: AiTask) -> None:
    task.status = AiTaskStatus.failed
    task.error_message = "Improvement generation was interrupted. Please generate again."
    task.completed_at = _utcnow_naive()
    db.add(task)
    db.commit()


def _validate_generation_context(parsed_cv: dict | str | None, job_description: str) -> None:
    cv_text = json.dumps(parsed_cv, ensure_ascii=False) if isinstance(parsed_cv, dict) else str(parsed_cv or "")
    if not cv_text.strip():
        raise ImprovementProviderError("A successful CV parse is required before generating improvements.")
    if not job_description.strip():
        raise ImprovementProviderError("A job description is required before generating improvements.")
    if len(cv_text) > settings.improvement_max_cv_chars:
        raise ImprovementProviderError("The parsed CV is too large for improvement generation.")
    if len(job_description) > settings.improvement_max_jd_chars:
        raise ImprovementProviderError("The job description is too large for improvement generation.")


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, ImprovementProviderError):
        return str(exc)[:1000] or "Improvement generation failed."
    return "Improvement generation failed. Please try again."


def request_generation(
    db: Session, *, match_result_id: int, account: Account, regenerate: bool
) -> tuple[GenerateImprovementResponse, bool]:
    match = _owned_match_or_404(db, match_result_id, account, for_update=True)
    if match.status != "Success" or match.overall_score is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CV/JD analysis is not complete.")
    latest = improvements.get_latest_task(db, match_result_id)
    if latest and latest.status in {AiTaskStatus.pending, AiTaskStatus.processing}:
        started_at = latest.started_at or latest.created_at
        stale_after = _utcnow_naive() - timedelta(minutes=settings.improvement_task_stale_minutes)
        if started_at and started_at < stale_after:
            _mark_stale_task_failed(db, latest)
            latest = None

    if latest and (
        latest.status in {AiTaskStatus.pending, AiTaskStatus.processing}
        or (not regenerate and latest.status == AiTaskStatus.success)
    ):
        return GenerateImprovementResponse(
            match_result_id=match_result_id, status=latest.status, task_id=latest.ai_task_id
        ), False

    try:
        provider = get_improvement_provider()
    except ImprovementProviderError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    task = improvements.create_task(db, match_result_id, provider.name, provider.model_name)
    return GenerateImprovementResponse(
        match_result_id=match_result_id, status=task.status, task_id=task.ai_task_id
    ), True


def run_generation_task(task_id: int) -> None:
    db = SessionLocal()
    task = None
    try:
        task = db.get(AiTask, task_id)
        if task is None:
            return
        task.status = AiTaskStatus.processing
        task.started_at = _utcnow_naive()
        db.commit()

        match, parsed, job_description = improvements.get_generation_context(db, task.resource_id)
        provider = get_improvement_provider()
        parsed_cv = parsed.parsed_json if parsed and parsed.parsed_json else (parsed.parsed_text if parsed else None)
        _validate_generation_context(parsed_cv, job_description)
        report = provider.generate_improvement_report(
            parsed_cv=parsed_cv,
            job_description=job_description,
            match_result={
                "overall_score": float(match.overall_score),
                "skill_score": float(match.skill_score) if match.skill_score is not None else None,
                "experience_score": float(match.experience_score) if match.experience_score is not None else None,
                "education_score": float(match.education_score) if match.education_score is not None else None,
                "soft_skill_score": float(match.soft_skill_score) if match.soft_skill_score is not None else None,
                "strengths": match.strengths,
                "weaknesses": match.weaknesses,
            },
        )
        validate_report_grounding(report, parsed_cv, job_description)
        improvements.replace_report(db, task.resource_id, report)
        task.status = AiTaskStatus.success
        task.error_message = None
        task.completed_at = _utcnow_naive()
        db.commit()
    except Exception as exc:
        db.rollback()
        if task is not None:
            task.status = AiTaskStatus.failed
            task.error_message = _safe_error_message(exc)
            task.completed_at = _utcnow_naive()
            db.add(task)
            db.commit()
        if not isinstance(exc, ImprovementProviderError):
            logger.exception("Unexpected improvement generation failure for task %s", task_id)
    finally:
        db.close()


def get_report(db: Session, *, match_result_id: int, account: Account) -> ImprovementReportResponse:
    match = _owned_match_or_404(db, match_result_id, account)
    if match.status != "Success" or match.overall_score is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CV/JD analysis is not complete.")
    task = improvements.get_latest_task(db, match_result_id)
    if task is None:
        return ImprovementReportResponse(
            match_result_id=match_result_id, status=AiTaskStatus.pending,
            overall_score=float(match.overall_score),
        )
    report = improvements.load_report(db, match_result_id) if task.status == AiTaskStatus.success else None
    stale = task.status == AiTaskStatus.success and improvements.is_report_stale(db, match_result_id, task.completed_at)
    return ImprovementReportResponse(
        match_result_id=match_result_id,
        status=task.status,
        generated_at=task.completed_at,
        error_message=task.error_message,
        overall_score=float(match.overall_score),
        stale=stale,
        report=report,
    )
