import json
import re

from app.schemas.improvement import ImprovementReportData


class ImprovementValidationError(RuntimeError):
    pass


def validate_report_grounding(
    report: ImprovementReportData,
    parsed_cv: dict | str | None,
    job_description: str,
) -> None:
    """Reject suggestions that are not grounded in the supplied CV and JD."""
    source = json.dumps(parsed_cv, ensure_ascii=False) if isinstance(parsed_cv, dict) else str(parsed_cv or "")
    normalized_source = _normalize_text(source)
    normalized_jd = _normalize_text(job_description)
    source_numbers = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", source))

    for gap in report.skill_gaps:
        skill = _normalize_text(gap.skill)
        evidence = _normalize_text(gap.jd_evidence)
        if not _contains_phrase(normalized_jd, skill) or not _contains_phrase(normalized_jd, evidence):
            raise ImprovementValidationError(
                "AI skill gap is not grounded in the job description."
            )
        if _contains_phrase(normalized_source, skill):
            raise ImprovementValidationError("AI skill gap is already present in the source CV.")

    for rewrite in report.rewrite_suggestions:
        if not _contains_phrase(normalized_source, _normalize_text(rewrite.original_text)):
            raise ImprovementValidationError("AI rewrite is not grounded in the source CV.")
        claimed = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", rewrite.suggested_text))
        unsupported = claimed - source_numbers
        if unsupported:
            raise ImprovementValidationError(
                "AI rewrite introduced unsupported numeric claims; use placeholders instead."
            )


def _normalize_text(value: object) -> str:
    return " ".join(str(value or "").split()).casefold()


def _contains_phrase(source: str, phrase: str) -> bool:
    if not phrase:
        return False
    return re.search(rf"(?<![\w+#]){re.escape(phrase)}(?![\w+#])", source) is not None
