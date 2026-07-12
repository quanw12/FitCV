from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.improvement import (
    AiTask,
    AiTaskStatus,
    Cv,
    CvImprovementSuggestion,
    CvParseResult,
    Job,
    MatchResult,
    SuggestionCategory,
    SuggestionPriority,
    SuggestionType,
)
from app.schemas.improvement import ImprovementReportData

TASK_TYPE = "ImprovementReport"


def get_owned_match_result(
    db: Session, match_result_id: int, account_id: int, *, for_update: bool = False
) -> MatchResult | None:
    statement = (
        select(MatchResult)
        .join(Cv, Cv.cv_id == MatchResult.cv_id)
        .where(MatchResult.match_result_id == match_result_id, Cv.account_id == account_id)
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalar(statement)


def get_generation_context(db: Session, match_result_id: int) -> tuple[MatchResult, CvParseResult | None, Job]:
    match = db.get(MatchResult, match_result_id)
    if match is None:
        raise LookupError("Match result not found.")
    parsed = db.scalar(
        select(CvParseResult)
        .where(CvParseResult.cv_id == match.cv_id, CvParseResult.parse_status == "Success")
        .order_by(CvParseResult.parsed_at.desc())
    )
    job = db.get(Job, match.job_id)
    if job is None:
        raise LookupError("Job description not found.")
    return match, parsed, job


def get_latest_task(db: Session, match_result_id: int) -> AiTask | None:
    return db.scalar(
        select(AiTask)
        .where(AiTask.task_type == TASK_TYPE, AiTask.resource_id == match_result_id)
        .order_by(AiTask.created_at.desc(), AiTask.ai_task_id.desc())
    )


def create_task(db: Session, match_result_id: int, provider: str, model_name: str | None) -> AiTask:
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


def has_suggestions(db: Session, match_result_id: int) -> bool:
    return db.scalar(
        select(CvImprovementSuggestion.suggestion_id).where(
            CvImprovementSuggestion.match_result_id == match_result_id
        ).limit(1)
    ) is not None


def load_report(db: Session, match_result_id: int) -> ImprovementReportData:
    rows = list(db.scalars(
        select(CvImprovementSuggestion)
        .where(CvImprovementSuggestion.match_result_id == match_result_id)
        .order_by(CvImprovementSuggestion.suggestion_type, CvImprovementSuggestion.sort_order)
    ))
    payload: dict[str, list[dict]] = {
        "skill_gaps": [], "section_feedback": [], "rewrite_suggestions": [], "quick_wins": []
    }
    for row in rows:
        meta = row.metadata_json or {}
        if row.suggestion_type == SuggestionType.skill_gap:
            payload["skill_gaps"].append({
                "skill": row.suggested_text or "", "priority": row.priority,
                "reason": row.explanation or "", "jd_evidence": meta.get("jd_evidence", ""),
            })
        elif row.suggestion_type == SuggestionType.section_feedback:
            payload["section_feedback"].append({
                "section": row.section or "Other", "issue": row.original_text or "",
                "explanation": row.explanation or "", "priority": row.priority,
                "suggested_action": row.suggested_text or "",
            })
        elif row.suggestion_type == SuggestionType.rewrite:
            payload["rewrite_suggestions"].append({
                "section": row.section or "Other", "original_text": row.original_text or "",
                "issue": row.explanation or "", "suggested_text": row.suggested_text or "",
                "framework": meta.get("framework", "Problem → Action → Result"),
            })
        elif row.suggestion_type == SuggestionType.quick_win:
            payload["quick_wins"].append({
                "title": row.suggested_text or "", "category": meta.get("category", row.category.value),
                "priority": row.priority, "explanation": row.explanation or "",
            })
    return ImprovementReportData.model_validate(payload)


def replace_report(db: Session, match_result_id: int, report: ImprovementReportData) -> None:
    db.execute(delete(CvImprovementSuggestion).where(CvImprovementSuggestion.match_result_id == match_result_id))
    rows: list[CvImprovementSuggestion] = []
    for order, item in enumerate(report.skill_gaps):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id, suggestion_type=SuggestionType.skill_gap,
            category=SuggestionCategory.skill, suggested_text=item.skill, explanation=item.reason,
            priority=item.priority, sort_order=order, metadata_json={"jd_evidence": item.jd_evidence},
        ))
    for order, item in enumerate(report.section_feedback):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id, suggestion_type=SuggestionType.section_feedback,
            category=_category_for_section(item.section.value), section=item.section.value,
            original_text=item.issue, suggested_text=item.suggested_action, explanation=item.explanation,
            priority=item.priority, sort_order=order,
        ))
    for order, item in enumerate(report.rewrite_suggestions):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id, suggestion_type=SuggestionType.rewrite,
            category=_category_for_section(item.section.value), section=item.section.value,
            original_text=item.original_text, suggested_text=item.suggested_text, explanation=item.issue,
            priority=SuggestionPriority.high, sort_order=order, metadata_json={"framework": item.framework},
        ))
    for order, item in enumerate(report.quick_wins):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id, suggestion_type=SuggestionType.quick_win,
            category=_category_from_text(item.category), suggested_text=item.title, explanation=item.explanation,
            priority=item.priority, sort_order=order, metadata_json={"category": item.category},
        ))
    db.add_all(rows)


def _category_for_section(section: str) -> SuggestionCategory:
    return {
        "WorkExperience": SuggestionCategory.experience,
        "Education": SuggestionCategory.education,
        "Skills": SuggestionCategory.skill,
    }.get(section, SuggestionCategory.other)


def _category_from_text(value: str) -> SuggestionCategory:
    normalized = value.lower()
    return next((item for item in SuggestionCategory if item.value.lower() == normalized), SuggestionCategory.other)
