import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.account import Account
from app.models.improvement import AiTask, AiTaskStatus, MatchResult
from app.repositories import improvements
from app.schemas.improvement import GenerateImprovementResponse, ImprovementReportResponse
from app.services.improvement_provider import ImprovementProviderError, get_improvement_provider
from app.services.improvement_enricher import enrich_improvement_report
from app.services.improvement_report_mapper import report_to_suggestions, suggestions_to_report
from app.services.improvement_validator import (
    ImprovementValidationError,
    filter_grounded_report,
)

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
    return match


def _mark_stale_task_failed(db: Session, task: AiTask) -> bool:
    return improvements.mark_active_task_failed(
        db,
        task.ai_task_id,
        error_message="Improvement generation was interrupted. Please generate again.",
        completed_at=_utcnow_naive(),
    )


def _validate_generation_context(parsed_cv: dict | str | None, job_description: str) -> None:
    cv_text = json.dumps(parsed_cv, ensure_ascii=False) if isinstance(parsed_cv, dict) else str(parsed_cv or "")
    if not cv_text.strip():
        raise ImprovementValidationError("A successful CV parse is required before generating improvements.")
    if not job_description.strip():
        raise ImprovementValidationError("A job description is required before generating improvements.")
    if len(cv_text) > settings.improvement_max_cv_chars:
        raise ImprovementValidationError("The parsed CV is too large for improvement generation.")
    if len(job_description) > settings.improvement_max_jd_chars:
        raise ImprovementValidationError("The job description is too large for improvement generation.")


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, (ImprovementProviderError, ImprovementValidationError)):
        return str(exc)[:1000] or "Improvement generation failed."
    return "Improvement generation failed. Please try again."


def _decode_json_container(value: object) -> object:
    if not isinstance(value, str) or not value.lstrip().startswith(("{", "[")):
        return value
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return value
    return parsed if isinstance(parsed, (dict, list)) else value


def _match_context_payload(match: MatchResult) -> dict:
    evidence = _decode_json_container(match.evidence_json)
    evidence_fields = evidence if isinstance(evidence, dict) else {}
    return {
        "overall_score": float(match.overall_score),
        "algorithm_version": match.algorithm_version,
        "model_name": match.model_name,
        "skill_score": float(match.skill_score) if match.skill_score is not None else None,
        "experience_score": (
            float(match.experience_score) if match.experience_score is not None else None
        ),
        "education_score": (
            float(match.education_score) if match.education_score is not None else None
        ),
        "soft_skill_score": (
            float(match.soft_skill_score) if match.soft_skill_score is not None else None
        ),
        "match_summary": match.match_summary,
        "strengths": (
            evidence_fields["strengths"]
            if "strengths" in evidence_fields
            else _decode_json_container(match.strengths)
        ),
        "weaknesses": (
            evidence_fields["weaknesses"]
            if "weaknesses" in evidence_fields
            else _decode_json_container(match.weaknesses)
        ),
        "recommendation": (
            evidence_fields["suggestions"]
            if "suggestions" in evidence_fields
            else _decode_json_container(match.recommendation)
        ),
        "evidence_json": evidence,
    }


def _is_report_stale(
    db: Session,
    match_result_id: int,
    completed_at: datetime | None,
) -> bool:
    if completed_at is None:
        return True
    timestamps = improvements.get_report_source_timestamps(db, match_result_id)
    return not timestamps or any(
        value is not None and value > completed_at for value in timestamps
    )


def request_generation(
    db: Session, *, match_result_id: int, account: Account, regenerate: bool
) -> tuple[GenerateImprovementResponse, bool]:
    match = _owned_match_or_404(db, match_result_id, account, for_update=True)
    if match.status != "Success" or match.overall_score is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CV/JD analysis is not complete.")
    if match.job_description_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis is missing an immutable job-description snapshot. Run it again.",
        )
    latest = improvements.get_latest_task(db, match_result_id)
    if latest and latest.status in {AiTaskStatus.pending, AiTaskStatus.processing}:
        started_at = latest.started_at or latest.created_at
        stale_after = _utcnow_naive() - timedelta(minutes=settings.improvement_task_stale_minutes)
        if started_at and started_at < stale_after:
            if _mark_stale_task_failed(db, latest):
                # create_task commits this state transition and the replacement task
                # together while the owned MatchResult row remains locked.
                latest = None
            else:
                db.expire(latest)
                db.refresh(latest)

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
        task = improvements.claim_task(db, task_id, started_at=_utcnow_naive())
        if task is None:
            return

        match, parsed, job_description = improvements.get_generation_context(db, task.resource_id)
        provider = get_improvement_provider()
        parsed_cv = parsed.parsed_json if parsed and parsed.parsed_json else (parsed.parsed_text if parsed else None)
        raw_cv_text = parsed.parsed_text if parsed else None
        _validate_generation_context(parsed_cv, job_description)
        match_context = _match_context_payload(match)
        report = provider.generate_improvement_report(
            parsed_cv=parsed_cv,
            job_description=job_description,
            match_result=match_context,
            raw_cv_text=raw_cv_text,
        )
        report = filter_grounded_report(
            report,
            parsed_cv,
            job_description,
            raw_cv_text=raw_cv_text,
            require_any=False,
        )
        report = enrich_improvement_report(
            report,
            parsed_cv=parsed_cv,
            raw_cv_text=raw_cv_text,
            job_description=job_description,
            match_result=match_context,
        )
        report = filter_grounded_report(
            report,
            parsed_cv,
            job_description,
            raw_cv_text=raw_cv_text,
        )
        rows = report_to_suggestions(task.resource_id, report)
        improvements.replace_suggestions(db, task.resource_id, rows)
        improvements.complete_claimed_task(
            db,
            task.ai_task_id,
            completed_at=_utcnow_naive(),
        )
    except Exception as exc:
        db.rollback()
        if task is not None:
            marked_failed = improvements.mark_active_task_failed(
                db,
                task.ai_task_id,
                error_message=_safe_error_message(exc),
                completed_at=_utcnow_naive(),
            )
            if marked_failed:
                db.commit()
            else:
                db.rollback()
        if not isinstance(exc, (ImprovementProviderError, ImprovementValidationError)):
            logger.exception("Unexpected improvement generation failure for task %s", task_id)
    finally:
        db.close()


def get_report(db: Session, *, match_result_id: int, account: Account) -> ImprovementReportResponse:
    match = _owned_match_or_404(db, match_result_id, account)
    if match.status != "Success" or match.overall_score is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CV/JD analysis is not complete.")
    if match.job_description_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis is missing an immutable job-description snapshot. Run it again.",
        )
    task = improvements.get_latest_task(db, match_result_id)
    if task is None:
        return ImprovementReportResponse(
            match_result_id=match_result_id, status=AiTaskStatus.pending,
            overall_score=float(match.overall_score),
        )
    report = (
        suggestions_to_report(improvements.get_suggestions(db, match_result_id))
        if task.status == AiTaskStatus.success
        else None
    )
    stale = task.status == AiTaskStatus.success and _is_report_stale(
        db,
        match_result_id,
        task.completed_at,
    )
    return ImprovementReportResponse(
        match_result_id=match_result_id,
        status=task.status,
        generated_at=task.completed_at,
        error_message=task.error_message,
        overall_score=float(match.overall_score),
        stale=stale,
        report=report,
    )
