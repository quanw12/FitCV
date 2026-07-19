from app.models.improvement import (
    CvImprovementSuggestion,
    SuggestionCategory,
    SuggestionPriority,
    SuggestionType,
)
from app.schemas.improvement import ImprovementReportData

PRIORITY_RANK = {
    SuggestionPriority.high: 0,
    SuggestionPriority.medium: 1,
    SuggestionPriority.low: 2,
}


def suggestions_to_report(rows: list[CvImprovementSuggestion]) -> ImprovementReportData:
    payload: dict[str, list[dict]] = {
        "skill_gaps": [],
        "section_feedback": [],
        "rewrite_suggestions": [],
        "quick_wins": [],
    }
    for row in rows:
        metadata = row.metadata_json or {}
        if row.suggestion_type == SuggestionType.skill_gap:
            payload["skill_gaps"].append({
                "skill": row.suggested_text or "",
                "priority": row.priority,
                "reason": row.explanation or "",
                "jd_evidence": metadata.get("jd_evidence", ""),
            })
        elif row.suggestion_type == SuggestionType.section_feedback:
            payload["section_feedback"].append({
                "section": row.section or "Other",
                "issue": row.original_text or "",
                "explanation": row.explanation or "",
                "priority": row.priority,
                "suggested_action": row.suggested_text or "",
            })
        elif row.suggestion_type == SuggestionType.rewrite:
            payload["rewrite_suggestions"].append({
                "section": row.section or "Other",
                "original_text": row.original_text or "",
                "issue": row.explanation or "",
                "suggested_text": row.suggested_text or "",
                "framework": metadata.get("framework", "Problem → Action → Result"),
            })
        elif row.suggestion_type == SuggestionType.quick_win:
            payload["quick_wins"].append({
                "title": row.suggested_text or "",
                "category": metadata.get("category", row.category.value),
                "priority": row.priority,
                "explanation": row.explanation or "",
            })
    return ImprovementReportData.model_validate(payload)


def report_to_suggestions(
    match_result_id: int,
    report: ImprovementReportData,
) -> list[CvImprovementSuggestion]:
    rows: list[CvImprovementSuggestion] = []
    for order, item in enumerate(
        sorted(report.skill_gaps, key=lambda value: PRIORITY_RANK[value.priority])
    ):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id,
            suggestion_type=SuggestionType.skill_gap,
            category=SuggestionCategory.skill,
            suggested_text=item.skill,
            explanation=item.reason,
            priority=item.priority,
            sort_order=order,
            metadata_json={"jd_evidence": item.jd_evidence},
        ))
    for order, item in enumerate(
        sorted(report.section_feedback, key=lambda value: PRIORITY_RANK[value.priority])
    ):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id,
            suggestion_type=SuggestionType.section_feedback,
            category=_category_for_section(item.section.value),
            section=item.section.value,
            original_text=item.issue,
            suggested_text=item.suggested_action,
            explanation=item.explanation,
            priority=item.priority,
            sort_order=order,
        ))
    for order, item in enumerate(report.rewrite_suggestions):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id,
            suggestion_type=SuggestionType.rewrite,
            category=_category_for_section(item.section.value),
            section=item.section.value,
            original_text=item.original_text,
            suggested_text=item.suggested_text,
            explanation=item.issue,
            priority=SuggestionPriority.high,
            sort_order=order,
            metadata_json={"framework": item.framework},
        ))
    for order, item in enumerate(
        sorted(report.quick_wins, key=lambda value: PRIORITY_RANK[value.priority])
    ):
        rows.append(CvImprovementSuggestion(
            match_result_id=match_result_id,
            suggestion_type=SuggestionType.quick_win,
            category=_category_from_text(item.category),
            suggested_text=item.title,
            explanation=item.explanation,
            priority=item.priority,
            sort_order=order,
            metadata_json={"category": item.category},
        ))
    return rows


def _category_for_section(section: str) -> SuggestionCategory:
    return {
        "WorkExperience": SuggestionCategory.experience,
        "Education": SuggestionCategory.education,
        "Skills": SuggestionCategory.skill,
    }.get(section, SuggestionCategory.other)


def _category_from_text(value: str) -> SuggestionCategory:
    normalized = value.lower()
    return next(
        (item for item in SuggestionCategory if item.value.lower() == normalized),
        SuggestionCategory.other,
    )
