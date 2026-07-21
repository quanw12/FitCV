import json
import re
from dataclasses import dataclass

from app.models.improvement import SuggestionPriority
from app.schemas.improvement import (
    CvSection,
    ImprovementReportData,
    QuickWin,
    RewriteSuggestion,
    SectionFeedback,
    SkillGap,
)
from app.services.document_parser import SKILL_ALIASES, SOFT_SKILLS
from app.services.improvement_validator import cv_quote_leaves


@dataclass(frozen=True)
class _CoverageTargets:
    skill_gaps: int
    section_feedback: int
    rewrites: int
    quick_wins: int


_SECTION_BY_KEY = {
    "summary": CvSection.summary,
    "profile": CvSection.summary,
    "objective": CvSection.summary,
    "experience": CvSection.work_experience,
    "workexperience": CvSection.work_experience,
    "work_experience": CvSection.work_experience,
    "skills": CvSection.skills,
    "technicalskills": CvSection.skills,
    "technical_skills": CvSection.skills,
    "education": CvSection.education,
    "projects": CvSection.projects,
}
_REWRITE_SECTION_ORDER = (
    CvSection.work_experience,
    CvSection.projects,
    CvSection.summary,
    CvSection.other,
)
_CV_HEADINGS = {
    "about",
    "achievements",
    "certifications",
    "contact",
    "education",
    "experience",
    "interests",
    "objective",
    "profile",
    "projects",
    "skills",
    "summary",
    "technical skills",
    "work experience",
}


def enrich_improvement_report(
    report: ImprovementReportData,
    *,
    parsed_cv: dict | str | None,
    raw_cv_text: str | None,
    job_description: str,
    match_result: dict,
) -> ImprovementReportData:
    """Fill sparse reports with deterministic advice grounded in Analyzer/CV evidence."""
    targets = _coverage_targets(_score(match_result.get("overall_score")))
    breakdown = _match_breakdown(match_result)
    section_lines = _section_lines(parsed_cv, raw_cv_text=raw_cv_text)
    available_sections = set(section_lines)

    skill_gaps = list(report.skill_gaps)
    _add_analyzer_skill_gaps(
        skill_gaps,
        target=targets.skill_gaps,
        breakdown=breakdown,
        job_description=job_description,
    )

    section_feedback = list(report.section_feedback)
    _add_section_feedback(
        section_feedback,
        target=targets.section_feedback,
        breakdown=breakdown,
        available_sections=available_sections,
    )

    rewrite_suggestions = list(report.rewrite_suggestions)
    _add_rewrites(
        rewrite_suggestions,
        target=targets.rewrites,
        section_lines=section_lines,
    )

    quick_wins = list(report.quick_wins)
    _add_quick_wins(
        quick_wins,
        target=targets.quick_wins,
        skill_gaps=skill_gaps,
        breakdown=breakdown,
        available_sections=available_sections,
    )

    return report.model_copy(
        update={
            "skill_gaps": skill_gaps,
            "section_feedback": section_feedback,
            "rewrite_suggestions": rewrite_suggestions,
            "quick_wins": quick_wins,
        }
    )


def _coverage_targets(score: float) -> _CoverageTargets:
    if score < 50:
        return _CoverageTargets(5, 4, 3, 5)
    if score < 80:
        return _CoverageTargets(4, 3, 2, 4)
    return _CoverageTargets(2, 2, 1, 3)


def _score(value: object, default: float = 100.0) -> float:
    if isinstance(value, bool):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _match_breakdown(match_result: dict) -> dict:
    direct = match_result.get("breakdown")
    if isinstance(direct, dict):
        return direct
    evidence = match_result.get("evidence_json")
    if isinstance(evidence, str):
        try:
            evidence = json.loads(evidence)
        except (TypeError, ValueError):
            return {}
    if not isinstance(evidence, dict):
        return {}
    breakdown = evidence.get("breakdown")
    return breakdown if isinstance(breakdown, dict) else {}


def _add_analyzer_skill_gaps(
    gaps: list[SkillGap],
    *,
    target: int,
    breakdown: dict,
    job_description: str,
) -> None:
    existing = {_term_identity(item.skill) for item in gaps}
    missing_terms: list[tuple[str, float]] = []
    for category in ("skills", "soft_skills"):
        evidence = breakdown.get(category)
        if not isinstance(evidence, dict):
            continue
        category_score = _score(evidence.get("score"))
        missing = evidence.get("missing")
        if not isinstance(missing, list):
            continue
        missing_terms.extend(
            (str(value).strip(), category_score)
            for value in missing
            if str(value).strip()
        )

    for missing_term, category_score in missing_terms:
        if len(gaps) >= target:
            return
        grounded = _grounded_term_and_line(missing_term, job_description)
        if grounded is None:
            continue
        skill, jd_line = grounded
        identity = _term_identity(skill)
        if identity in existing:
            continue
        priority = (
            SuggestionPriority.high
            if category_score < 50
            else SuggestionPriority.medium
        )
        gaps.append(
            SkillGap(
                skill=skill[:100],
                priority=priority,
                reason=(
                    f"The analyzed CV does not show verifiable evidence of {skill}, "
                    "while the JD explicitly mentions it."
                ),
                jd_evidence=jd_line[:1000],
            )
        )
        existing.add(identity)


def _grounded_term_and_line(
    missing_term: str,
    job_description: str,
) -> tuple[str, str] | None:
    aliases = [missing_term]
    canonical = _alias_canonical(missing_term)
    for source in (SKILL_ALIASES, SOFT_SKILLS):
        if canonical in source:
            aliases.extend(source[canonical])

    for line in _non_empty_lines(job_description):
        for alias in aliases:
            match = re.search(
                rf"(?<![\w+#]){re.escape(alias)}(?![\w+#])",
                line,
                re.IGNORECASE,
            )
            if match:
                return match.group(0), line
    return None


def _alias_canonical(value: str) -> str:
    normalized = _normalize(value)
    for source in (SKILL_ALIASES, SOFT_SKILLS):
        for canonical, aliases in source.items():
            if normalized in {_normalize(canonical), *(_normalize(alias) for alias in aliases)}:
                return canonical
    return value


def _term_identity(value: str) -> str:
    return _normalize(_alias_canonical(value))


def _add_section_feedback(
    feedback: list[SectionFeedback],
    *,
    target: int,
    breakdown: dict,
    available_sections: set[CvSection],
) -> None:
    existing = {
        (item.section, _normalize(item.issue))
        for item in feedback
    }

    candidates: list[SectionFeedback] = []
    skill_evidence = breakdown.get("skills")
    if isinstance(skill_evidence, dict) and skill_evidence.get("missing"):
        section = _available_or_other(CvSection.skills, available_sections)
        candidates.append(
            SectionFeedback(
                section=section,
                issue="The CV does not cover every JD skill requirement identified by the analysis.",
                explanation=(
                    "Important requirements may be hard to verify from the current skills and supporting evidence."
                ),
                priority=_priority_for_score(skill_evidence.get("score")),
                suggested_action=(
                    "Add only skills you can verify, then support them with a matching project or experience example."
                ),
            )
        )

    experience_evidence = breakdown.get("experience")
    if isinstance(experience_evidence, dict) and _score(experience_evidence.get("score")) < 80:
        candidates.append(
            SectionFeedback(
                section=_available_or_other(CvSection.work_experience, available_sections),
                issue="Relevant experience evidence is weaker than the JD expectation.",
                explanation=(
                    "The CV should make the duration, scope, and relevance of verified experience easier to assess."
                ),
                priority=_priority_for_score(experience_evidence.get("score")),
                suggested_action=(
                    "Clarify the most relevant responsibilities and add only outcomes or scope details you can prove."
                ),
            )
        )

    education_evidence = breakdown.get("education")
    if isinstance(education_evidence, dict) and _score(education_evidence.get("score")) < 80:
        candidates.append(
            SectionFeedback(
                section=_available_or_other(CvSection.education, available_sections),
                issue="The education evidence does not fully meet the JD expectation.",
                explanation=(
                    "The current CV may not make the closest relevant education or verified training clear enough."
                ),
                priority=_priority_for_score(education_evidence.get("score")),
                suggested_action=(
                    "State the closest relevant qualification, coursework, certification, "
                    "or training only when accurate."
                ),
            )
        )

    soft_skill_evidence = breakdown.get("soft_skills")
    if isinstance(soft_skill_evidence, dict) and soft_skill_evidence.get("missing"):
        preferred = next(
            (
                section
                for section in (
                    CvSection.work_experience,
                    CvSection.projects,
                    CvSection.summary,
                )
                if section in available_sections
            ),
            CvSection.other,
        )
        candidates.append(
            SectionFeedback(
                section=preferred,
                issue="Requested soft skills are not supported by clear examples in the CV.",
                explanation=(
                    "A skill label alone is less persuasive than a short, factual example of how it was demonstrated."
                ),
                priority=_priority_for_score(soft_skill_evidence.get("score")),
                suggested_action=(
                    "Add a concise project, study, or work example for each relevant soft "
                    "skill you can genuinely support."
                ),
            )
        )

    generic_templates = {
        CvSection.work_experience: (
            "Some experience entries could make their outcome and scope clearer.",
            "The reader can see activities, but the verified impact or responsibility boundary may remain unclear.",
            "Add an accurate result, scale, responsibility boundary, or lesson learned to the strongest entry.",
        ),
        CvSection.projects: (
            "Project entries could connect technical work to a clearer result.",
            "A concise outcome helps show why the project evidence matters for the target JD.",
            "For the most relevant project, state the problem, your contribution, and a verified outcome.",
        ),
        CvSection.summary: (
            "The summary could align verified strengths with the target JD more directly.",
            "A focused opening helps the reader find the most relevant evidence quickly.",
            "Mention the strongest verified fit and the target direction without adding unsupported claims.",
        ),
        CvSection.skills: (
            "The skills list could be easier to connect to supporting CV evidence.",
            "A keyword is stronger when a project or experience entry demonstrates how it was used.",
            "Keep verified skills and make the most JD-relevant ones easy to find in supporting sections.",
        ),
        CvSection.education: (
            "The education section could highlight its most relevant evidence more clearly.",
            "Relevant coursework, training, or achievements can help when they are accurate and concise.",
            "Surface only verified education details that strengthen the fit for this JD.",
        ),
        CvSection.other: (
            "The CV could prioritize its strongest verified evidence more clearly.",
            "The current structure may make relevant information harder to scan against this JD.",
            "Move the most relevant factual evidence earlier and keep labels and formatting consistent.",
        ),
    }
    ordered_sections = (
        CvSection.work_experience,
        CvSection.projects,
        CvSection.summary,
        CvSection.skills,
        CvSection.education,
        CvSection.other,
    )
    for section in ordered_sections:
        if section != CvSection.other and section not in available_sections:
            continue
        issue, explanation, action = generic_templates[section]
        candidates.append(
            SectionFeedback(
                section=section,
                issue=issue,
                explanation=explanation,
                priority=SuggestionPriority.medium,
                suggested_action=action,
            )
        )

    candidates.extend(
        [
            SectionFeedback(
                section=CvSection.other,
                issue="Important CV claims could connect to supporting examples more directly.",
                explanation=(
                    "A nearby factual example makes it easier to verify why each claim matters for the JD."
                ),
                priority=SuggestionPriority.medium,
                suggested_action=(
                    "Link the most important requirement to a concise project, study, or work example you can support."
                ),
            ),
            SectionFeedback(
                section=CvSection.other,
                issue="Several entries could state ownership and contribution more precisely.",
                explanation=(
                    "Clear ownership helps distinguish personal contribution from general team activity."
                ),
                priority=SuggestionPriority.medium,
                suggested_action=(
                    "Clarify what you personally did while keeping collaborators, scope, and outcomes accurate."
                ),
            ),
        ]
    )

    for item in candidates:
        if len(feedback) >= target:
            return
        identity = (item.section, _normalize(item.issue))
        if identity in existing:
            continue
        feedback.append(item)
        existing.add(identity)


def _add_rewrites(
    rewrites: list[RewriteSuggestion],
    *,
    target: int,
    section_lines: dict[CvSection, list[str]],
) -> None:
    existing = {_normalize(item.original_text) for item in rewrites}
    for section in _REWRITE_SECTION_ORDER:
        for original in section_lines.get(section, []):
            if len(rewrites) >= target:
                return
            if not _is_rewrite_candidate(original):
                continue
            identity = _normalize(original)
            if identity in existing:
                continue
            base = original.rstrip(" .;")
            rewrites.append(
                RewriteSuggestion(
                    section=section,
                    original_text=original,
                    issue=(
                        "The entry leaves the verified scope or outcome less clear than it could be."
                    ),
                    suggested_text=f"{base} — [verified scope or outcome].",
                    framework="Action → Scope → Result",
                )
            )
            existing.add(identity)


def _add_quick_wins(
    quick_wins: list[QuickWin],
    *,
    target: int,
    skill_gaps: list[SkillGap],
    breakdown: dict,
    available_sections: set[CvSection],
) -> None:
    existing = {_normalize(item.title) for item in quick_wins}
    candidates: list[QuickWin] = []

    for gap in skill_gaps:
        candidates.append(
            QuickWin(
                title=f"Address the {gap.skill} evidence gap"[:200],
                category="Keyword",
                priority=gap.priority,
                explanation=(
                    f"If you have verifiable {gap.skill} experience, add it to the most relevant CV section; "
                    "otherwise keep it as a learning priority and do not claim it yet."
                )[:1000],
            )
        )

    experience_evidence = breakdown.get("experience")
    if isinstance(experience_evidence, dict) and _score(experience_evidence.get("score")) < 80:
        candidates.append(
            QuickWin(
                title="Clarify the strongest relevant experience",
                category=(
                    "Experience"
                    if CvSection.work_experience in available_sections
                    else "Other"
                ),
                priority=_priority_for_score(experience_evidence.get("score")),
                explanation=(
                    "Make the duration, responsibility, and verified result easy to find "
                    "without overstating the evidence."
                ),
            )
        )

    candidates.extend(
        [
            QuickWin(
                title="Strengthen one CV entry with verified impact",
                category=(
                    "Experience"
                    if CvSection.work_experience in available_sections
                    else "Other"
                ),
                priority=SuggestionPriority.high,
                explanation=(
                    "Choose the most relevant entry and add an accurate outcome, scope detail, or result you can prove."
                ),
            ),
            QuickWin(
                title="Align the opening with the target JD",
                category="Keyword",
                priority=SuggestionPriority.medium,
                explanation=(
                    "Lead with verified strengths that directly match the role and remove "
                    "generic wording that hides them."
                ),
            ),
            QuickWin(
                title="Make supporting evidence easier to scan",
                category="Format",
                priority=SuggestionPriority.medium,
                explanation=(
                    "Use consistent section labels and concise entries so each important claim is easy to verify."
                ),
            ),
            QuickWin(
                title="Review every claim before submitting",
                category="Other",
                priority=SuggestionPriority.low,
                explanation=(
                    "Keep only statements, skills, and outcomes that you can explain and support accurately."
                ),
            ),
        ]
    )

    for item in candidates:
        if len(quick_wins) >= target:
            return
        identity = _normalize(item.title)
        if identity in existing:
            continue
        quick_wins.append(item)
        existing.add(identity)


def _priority_for_score(value: object) -> SuggestionPriority:
    return (
        SuggestionPriority.high
        if _score(value) < 50
        else SuggestionPriority.medium
    )


def _available_or_other(
    preferred: CvSection,
    available_sections: set[CvSection],
) -> CvSection:
    return preferred if preferred in available_sections else CvSection.other


def _section_lines(
    parsed_cv: dict | str | None,
    *,
    raw_cv_text: str | None,
) -> dict[CvSection, list[str]]:
    quote_lines = cv_quote_leaves(parsed_cv, raw_cv_text=raw_cv_text)
    exact_by_normalized = {_normalize(line): line for line in quote_lines}
    result: dict[CvSection, list[str]] = {}
    mapped: set[str] = set()

    if isinstance(parsed_cv, dict) and isinstance(parsed_cv.get("sections"), dict):
        for key, value in parsed_cv["sections"].items():
            section_key = str(key).replace(" ", "").replace("-", "_").casefold()
            section = _SECTION_BY_KEY.get(section_key, CvSection.other)
            for parsed_line in _non_empty_lines(str(value or "")):
                normalized = _normalize(parsed_line)
                source_line = exact_by_normalized.get(normalized, parsed_line)
                _append_unique(result, section, source_line)
                mapped.add(_normalize(source_line))

    for line in quote_lines:
        if _normalize(line) not in mapped:
            _append_unique(result, CvSection.other, line)
    return result


def _append_unique(
    destination: dict[CvSection, list[str]],
    section: CvSection,
    value: str,
) -> None:
    items = destination.setdefault(section, [])
    if _normalize(value) not in {_normalize(item) for item in items}:
        items.append(value)


def _is_rewrite_candidate(value: str) -> bool:
    text = re.sub(r"^[\s•●▪◦*-]+", "", value).strip()
    normalized = _normalize(text).rstrip(":")
    if not 25 <= len(text) <= 600 or normalized in _CV_HEADINGS:
        return False
    if "@" in text or re.search(r"https?://|www\.", text, re.IGNORECASE):
        return False
    words = re.findall(r"[A-Za-zÀ-ỹ]+", text)
    if len(words) < 5:
        return False
    if text.isupper() and len(words) <= 10:
        return False
    return True


def _non_empty_lines(value: str) -> list[str]:
    return [line.strip() for line in value.splitlines() if line.strip()]


def _normalize(value: object) -> str:
    return " ".join(str(value or "").split()).casefold()
