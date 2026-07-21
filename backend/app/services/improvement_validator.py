import re

from app.schemas.improvement import CvSection, ImprovementReportData
from app.services.document_parser import SKILL_ALIASES


SECTION_KEYS = {
    CvSection.summary: {"summary", "profile", "objective"},
    CvSection.work_experience: {"experience", "workexperience", "work_experience"},
    CvSection.skills: {"skills", "technicalskills", "technical_skills"},
    CvSection.education: {"education"},
    CvSection.projects: {"projects"},
}

_AMBIGUOUS_DOMAIN_TERMS = {"go", "react", "agile", "scrum"}
_DOMAIN_TERMS = sorted(
    {
        term.casefold()
        for canonical, aliases in SKILL_ALIASES.items()
        for term in (canonical, *aliases)
        if len(term) >= 3 and term.casefold() not in _AMBIGUOUS_DOMAIN_TERMS
    },
    key=len,
    reverse=True,
)
_ROLE_TERMS = {
    "analyst",
    "architect",
    "consultant",
    "developer",
    "director",
    "engineer",
    "intern",
    "manager",
    "specialist",
}
_ROLE_CLAIM_PATTERN = re.compile(
    rf"\b(?:work|worked|working|experience|employed|employment|served|serving)"
    rf"\s+(?:as|in)\s+(?:an?\s+|the\s+)?(?P<role>{'|'.join(sorted(_ROLE_TERMS))})s?\b",
    re.IGNORECASE,
)
_NAMED_ENTITY = r"[A-Z][A-Za-z0-9&.+#/-]*(?:\s+[A-Z][A-Za-z0-9&.+#/-]*){0,3}"
_EMPLOYER_CLAIM_PATTERNS = (
    re.compile(
        rf"(?i:\b(?:work|worked|working|experience|employed|employment|role|job|position|project)"
        rf"\s+(?:at|with|for)\s+)(?P<entity>{_NAMED_ENTITY})\b"
    ),
    re.compile(
        rf"(?:^|[.!?]\s+)(?P<entity>{_NAMED_ENTITY})"
        rf"\s+(?:experience|role|employment|project|work)\b"
    ),
    re.compile(rf"(?i:\b(?:joined|joining)\s+)(?P<entity>{_NAMED_ENTITY})\b"),
    re.compile(
        rf"(?i:\b(?:built|created|delivered|designed|developed|implemented|launched|led|"
        rf"maintained|managed|migrated|optimized|supported)\b[^.!?\n]{{0,80}}"
        rf"\b(?:at|for|with)\s+)(?P<entity>{_NAMED_ENTITY})\b"
    ),
)
_GENERIC_ENTITY_PREFIXES = {
    "a",
    "an",
    "candidate",
    "current",
    "cv",
    "jd",
    "relevant",
    "requested",
    "some",
    "the",
    "these",
    "this",
    "verified",
    "your",
}
_CASE_SENSITIVE_DOMAIN_TERMS = ("Agile", "React", "Scrum")
_GO_TECH_CLAIM_PATTERN = re.compile(
    r"(?:\b(?:built|developed|implemented|using|with)\b[^.!?\n]{0,40}\bGo\b|"
    r"\bGo\s+(?:api|apis|developer|development|language|service|services)\b)"
)


class ImprovementValidationError(RuntimeError):
    pass


_REPORT_COLLECTIONS = (
    "skill_gaps",
    "section_feedback",
    "rewrite_suggestions",
    "quick_wins",
)


def filter_grounded_report(
    report: ImprovementReportData,
    parsed_cv: dict | str | None,
    job_description: str,
    *,
    raw_cv_text: str | None = None,
    require_any: bool = True,
) -> ImprovementReportData:
    """Keep safely grounded suggestions instead of rejecting an entire mixed report."""
    grounded: dict[str, list] = {name: [] for name in _REPORT_COLLECTIONS}

    for collection_name in _REPORT_COLLECTIONS:
        for item in getattr(report, collection_name):
            candidate = ImprovementReportData.model_validate(
                {collection_name: [item]}
            )
            try:
                validate_report_grounding(
                    candidate,
                    parsed_cv,
                    job_description,
                    raw_cv_text=raw_cv_text,
                )
            except ImprovementValidationError:
                continue
            grounded[collection_name].append(item)

    if require_any and not any(grounded.values()):
        raise ImprovementValidationError(
            "Gemini did not return any safely grounded improvement advice."
        )
    return report.model_copy(update=grounded)


def validate_report_grounding(
    report: ImprovementReportData,
    parsed_cv: dict | str | None,
    job_description: str,
    *,
    raw_cv_text: str | None = None,
) -> None:
    """Reject suggestions that are not grounded in the supplied CV and JD."""
    semantic_leaves = cv_source_leaves(parsed_cv)
    quote_leaves = cv_quote_leaves(parsed_cv, raw_cv_text=raw_cv_text)
    source = "\n".join(quote_leaves)
    normalized_semantic_leaves = [_normalize_text(value) for value in semantic_leaves]
    normalized_quote_leaves = [_normalize_text(value) for value in quote_leaves]
    normalized_jd = _normalize_text(job_description)
    normalized_jd_quote_leaves = [
        _normalize_text(value) for value in _quote_chunks(job_description)
    ]
    source_numbers = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", source))
    context_numbers = source_numbers | set(
        re.findall(r"\b\d+(?:\.\d+)?%?\b", job_description)
    )
    available_sections = _available_sections(parsed_cv)

    for gap in report.skill_gaps:
        skill = _normalize_text(gap.skill)
        evidence = _normalize_text(gap.jd_evidence)
        evidence_is_quoted = any(
            _contains_phrase(jd_line, evidence)
            for jd_line in normalized_jd_quote_leaves
        )
        if not _contains_phrase(normalized_jd, skill) or not evidence_is_quoted:
            raise ImprovementValidationError(
                "AI skill gap is not grounded in the job description."
            )
        if any(
            _contains_phrase(source_leaf, skill)
            for source_leaf in normalized_semantic_leaves
        ):
            raise ImprovementValidationError("AI skill gap is already present in the source CV.")
        _validate_numbers(gap.reason, context_numbers, "skill-gap explanation")
        _validate_named_claims([gap.reason], source, job_description)

    for feedback in report.section_feedback:
        _validate_section_exists(feedback.section, available_sections)
        _validate_numbers(
            " ".join([feedback.issue, feedback.explanation, feedback.suggested_action]),
            context_numbers,
            "section feedback",
        )
        _validate_named_claims(
            [feedback.issue, feedback.explanation, feedback.suggested_action],
            source,
            job_description,
        )

    for rewrite in report.rewrite_suggestions:
        original_text = _normalize_text(rewrite.original_text)
        if not any(
            _contains_phrase(source_leaf, original_text)
            for source_leaf in normalized_quote_leaves
        ):
            raise ImprovementValidationError("AI rewrite is not grounded in the source CV.")
        _validate_numbers(rewrite.suggested_text, source_numbers, "rewrite")
        _validate_named_claims(
            [rewrite.issue, rewrite.suggested_text],
            source,
            job_description,
        )

    for quick_win in report.quick_wins:
        section = _section_for_category(quick_win.category)
        if section is not None:
            _validate_section_exists(section, available_sections)
        _validate_numbers(
            " ".join([quick_win.title, quick_win.explanation]),
            context_numbers,
            "quick-win advice",
        )
        _validate_named_claims(
            [quick_win.title, quick_win.explanation],
            source,
            job_description,
        )


def _normalize_text(value: object) -> str:
    return " ".join(str(value or "").split()).casefold()


def cv_source_leaves(parsed_cv: dict | str | None) -> list[str]:
    """Return semantic CV values, including canonical fields produced by parsing."""
    if not isinstance(parsed_cv, dict):
        source = str(parsed_cv or "").strip()
        return [source] if source else []

    chunks: list[str] = []
    _collect_leaf_values(parsed_cv, chunks)
    return chunks


def cv_quote_leaves(
    parsed_cv: dict | str | None,
    *,
    raw_cv_text: str | None = None,
) -> list[str]:
    """Return only raw CV text suitable for exact evidence and rewrite quotes."""
    raw_source = str(raw_cv_text or "").strip()
    if raw_source:
        return _quote_chunks(raw_source)
    if not isinstance(parsed_cv, dict):
        source = str(parsed_cv or "").strip()
        return _quote_chunks(source)

    sections = parsed_cv.get("sections")
    if not isinstance(sections, dict):
        return []
    chunks: list[str] = []
    _collect_leaf_values(sections, chunks)
    return [chunk for value in chunks for chunk in _quote_chunks(value)]


def _quote_chunks(value: str) -> list[str]:
    return [line.strip() for line in value.splitlines() if line.strip()]


def _collect_leaf_values(value: object, chunks: list[str]) -> None:
    if isinstance(value, dict):
        for nested in value.values():
            _collect_leaf_values(nested, chunks)
    elif isinstance(value, (list, tuple, set)):
        for nested in value:
            _collect_leaf_values(nested, chunks)
    elif value is not None and not isinstance(value, bool):
        text = str(value).strip()
        if text:
            chunks.append(text)


def _contains_phrase(source: str, phrase: str) -> bool:
    if not phrase:
        return False
    return re.search(rf"(?<![\w+#]){re.escape(phrase)}(?![\w+#])", source) is not None


def _available_sections(parsed_cv: dict | str | None) -> set[str] | None:
    if not isinstance(parsed_cv, dict):
        return None
    sections = parsed_cv.get("sections")
    if not isinstance(sections, dict):
        return set()
    return {
        str(key).replace(" ", "").replace("-", "_").casefold()
        for key, value in sections.items()
        if str(value or "").strip()
    }


def _validate_section_exists(
    section: CvSection,
    available_sections: set[str] | None,
) -> None:
    if (
        available_sections is None
        or section == CvSection.other
        or SECTION_KEYS.get(section, set()) & available_sections
    ):
        return
    raise ImprovementValidationError(
        "AI section advice is not grounded in a section present in the source CV."
    )


def _section_for_category(category: str) -> CvSection | None:
    return {
        "skill": CvSection.skills,
        "skills": CvSection.skills,
        "experience": CvSection.work_experience,
        "education": CvSection.education,
    }.get(category.strip().casefold())


def _validate_numbers(value: str, allowed: set[str], label: str) -> None:
    claimed = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", value))
    if claimed - allowed:
        raise ImprovementValidationError(
            f"AI {label} introduced unsupported numeric claims; use placeholders instead."
        )


def _validate_named_claims(
    values: list[str],
    cv_source: str,
    job_description: str,
) -> None:
    generated = "\n".join(values)
    normalized_generated = _normalize_text(generated)
    normalized_context = _normalize_text(f"{cv_source}\n{job_description}")

    for term in _DOMAIN_TERMS:
        if _contains_phrase(normalized_generated, term) and not _contains_phrase(
            normalized_context,
            term,
        ):
            raise ImprovementValidationError(
                "AI advice introduced an unsupported technology or skill claim."
            )

    for term in _CASE_SENSITIVE_DOMAIN_TERMS:
        generated_has_term = re.search(
            rf"(?<![\w+#]){re.escape(term)}(?![\w+#])",
            generated,
        )
        if generated_has_term and not _contains_phrase(
            normalized_context,
            term.casefold(),
        ):
            raise ImprovementValidationError(
                "AI advice introduced an unsupported technology or skill claim."
            )

    if _GO_TECH_CLAIM_PATTERN.search(generated):
        raw_context = f"{cv_source}\n{job_description}"
        go_is_grounded = re.search(r"(?<![\w+#])Go(?![\w+#])", raw_context) or any(
            _contains_phrase(normalized_context, alias.casefold())
            for alias in SKILL_ALIASES["Go"]
        )
        if not go_is_grounded:
            raise ImprovementValidationError(
                "AI advice introduced an unsupported technology or skill claim."
            )

    for match in _ROLE_CLAIM_PATTERN.finditer(generated):
        role = match.group("role").casefold()
        if re.search(rf"\b{re.escape(role)}s?\b", normalized_context) is None:
            raise ImprovementValidationError(
                "AI advice introduced an unsupported role claim."
            )

    for value in values:
        for pattern in _EMPLOYER_CLAIM_PATTERNS:
            for match in pattern.finditer(value):
                entity = _normalize_text(match.group("entity"))
                entity_parts = entity.split()
                while entity_parts and entity_parts[0] in _GENERIC_ENTITY_PREFIXES:
                    entity_parts.pop(0)
                if not entity_parts:
                    continue
                entity = " ".join(entity_parts)
                if not _contains_phrase(normalized_context, entity):
                    raise ImprovementValidationError(
                        "AI advice introduced an unsupported named claim."
                    )
