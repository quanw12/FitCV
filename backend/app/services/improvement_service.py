from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.account import Account
from app.models.improvement import AiTask, AiTaskStatus, MatchResult
from app.repositories import improvements
from app.schemas.improvement import GenerateImprovementResponse, ImprovementReportResponse
from app.services.improvement_provider import ImprovementProviderError, get_improvement_provider, validate_report_grounding


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


def request_generation(
    db: Session, *, match_result_id: int, account: Account, regenerate: bool
) -> tuple[GenerateImprovementResponse, bool]:
    _owned_match_or_404(db, match_result_id, account, for_update=True)
    latest = improvements.get_latest_task(db, match_result_id)
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

        match, parsed, job = improvements.get_generation_context(db, task.resource_id)
        provider = get_improvement_provider()
        parsed_cv = parsed.parsed_json if parsed and parsed.parsed_json else (parsed.parsed_text if parsed else None)
        description = "\n".join(part for part in [job.description, job.requirements] if part)
        report = provider.generate_improvement_report(
            parsed_cv=parsed_cv,
            job_description=description,
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
        validate_report_grounding(report, parsed_cv)
        improvements.replace_report(db, task.resource_id, report)
        task.status = AiTaskStatus.success
        task.error_message = None
        task.completed_at = _utcnow_naive()
        db.commit()
    except Exception as exc:
        db.rollback()
        if task is not None:
            task.status = AiTaskStatus.failed
            task.error_message = str(exc)[:1000] or "Improvement generation failed."
            task.completed_at = _utcnow_naive()
            db.add(task)
            db.commit()
    finally:
        db.close()


def get_report(db: Session, *, match_result_id: int, account: Account) -> ImprovementReportResponse:
    match = _owned_match_or_404(db, match_result_id, account)
    task = improvements.get_latest_task(db, match_result_id)
    if task is None:
        return ImprovementReportResponse(
            match_result_id=match_result_id, status=AiTaskStatus.pending,
            overall_score=float(match.overall_score),
        )
    report = improvements.load_report(db, match_result_id) if task.status == AiTaskStatus.success else None
    return ImprovementReportResponse(
        match_result_id=match_result_id,
        status=task.status,
        generated_at=task.completed_at,
        error_message=task.error_message,
        overall_score=float(match.overall_score),
        report=report,
    )
