from __future__ import annotations

import logging
import re
from typing import Any

from app.core.config import settings
from app.services.document_parser import (
    parse_cv_text,
    parse_jd_text,
    preprocess_document_text,
)
from app.services.gemini_analyzer import (
    GEMINI_CV_PARSE_VERSION,
    GEMINI_EXTRACTOR_VERSION,
    GeminiAnalyzerError,
    align_soft_skills,
    extract_match_inputs,
)
from app.services.matching_service import (
    ALGORITHM_VERSION,
    SCORING_FRAMEWORK_VERSION,
    match_documents,
    unmatched_soft_skills,
)

logger = logging.getLogger(__name__)

LEGACY_DETERMINISTIC_VERSION = "fitcv-deterministic-v1"
EXCLUDED_JD_SECTION_NAMES = (
    "benefits",
    "compensation",
    "how we hire",
    "hiring process",
    "life at company",
    "life at the company",
    "perks",
    "recruitment process",
    "quyền lợi",
    "quy trình phỏng vấn",
    "quy trình tuyển dụng",
    "văn hóa công ty",
    "we offer",
    "what we offer",
)
INCLUDED_JD_SECTION_NAMES = (
    "about",
    "about the job",
    "education",
    "experience",
    "job description",
    "job title",
    "must have",
    "nice to have",
    "preferred qualifications",
    "qualifications",
    "requirements",
    "responsibilities",
    "skills",
    "kỹ năng",
    "mô tả công việc",
    "trách nhiệm",
    "yêu cầu",
    "what you will do",
    "who you are",
)
_SECTION_HEADER = re.compile(
    r"^\s*(?:#{1,6}\s*)?(?:\d+[.)]\s*)?"
    r"(?P<name>[^\W\d_][\w &/'-]{1,60})\s*:?\s*$",
    re.UNICODE,
)


def selected_analyzer_config() -> tuple[str, str | None]:
    provider = settings.analyzer_provider.strip().lower()
    if provider == "deterministic":
        return ALGORITHM_VERSION, None
    if provider == "gemini":
        if not settings.gemini_api_key:
            raise GeminiAnalyzerError(
                "GEMINI_API_KEY is required when ANALYZER_PROVIDER=gemini."
            )
        model_slug = re.sub(
            r"[^a-zA-Z0-9._-]+", "-", settings.gemini_model
        ).strip("-")
        if not model_slug:
            raise GeminiAnalyzerError("GEMINI_MODEL must not be empty.")
        return (
            f"fitcv-gemini-{model_slug[:22]}-{GEMINI_EXTRACTOR_VERSION}-s8",
            settings.gemini_model,
        )
    raise GeminiAnalyzerError(
        f"Unsupported ANALYZER_PROVIDER: {settings.analyzer_provider}"
    )


def build_structured_job_scoring_text(
    *,
    title: str | None,
    description: str | None,
    about_job: str | None,
    responsibilities: str | None,
    requirements: str | None,
) -> str:
    about = about_job or description
    sections = (
        ("Job title", title),
        ("About the job", about),
        ("Responsibilities", responsibilities),
        ("Requirements", requirements),
    )
    unique_values: set[str] = set()
    output: list[str] = []
    for label, value in sections:
        cleaned = preprocess_document_text(value or "")
        key = cleaned.casefold()
        if not cleaned or key in unique_values:
            continue
        unique_values.add(key)
        output.extend((label, cleaned))
    return normalize_scoring_jd_text("\n".join(output))


def normalize_scoring_jd_text(value: str) -> str:
    """Remove non-requirement JD sections before any parser or model sees them."""
    normalized = preprocess_document_text(value)
    kept: list[str] = []
    excluding = False
    for line in normalized.splitlines():
        header = _SECTION_HEADER.fullmatch(line)
        if header:
            section_name = _normalized_section_name(header.group("name"))
            if section_name in {
                *EXCLUDED_JD_SECTION_NAMES,
                *INCLUDED_JD_SECTION_NAMES,
            }:
                excluding = section_name in EXCLUDED_JD_SECTION_NAMES
        if not excluding:
            kept.append(line)
    return preprocess_document_text("\n".join(kept))


def score_match(
    *,
    cv_text: str,
    jd_text: str,
    parsed_cv: dict[str, Any] | None = None,
    parsed_jd: dict[str, Any] | None = None,
    algorithm_version: str | None = None,
    model_name: str | None = None,
    source_scope: str,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    normalized_jd = normalize_scoring_jd_text(jd_text)
    selected_version = algorithm_version or selected_analyzer_config()[0]

    if selected_version in {ALGORITHM_VERSION, LEGACY_DETERMINISTIC_VERSION}:
        score_cv = parsed_cv or parse_cv_text(cv_text)
        score_jd = parsed_jd or parse_jd_text(normalized_jd)
        extraction_provider = "deterministic"
        soft_skill_matches: list[tuple[str, str]] = []
    elif selected_version.startswith("fitcv-gemini-"):
        semantic_cv, semantic_jd = extract_match_inputs(
            cv_text=cv_text,
            job_description=normalized_jd,
            model_name=model_name,
        )
        # Gemini is authoritative for the Gemini analyzer. The local parser is intentionally
        # not used to add skills, education, or experience to model output.
        if (
            isinstance(parsed_cv, dict)
            and parsed_cv.get("_extraction_provider") == "gemini"
            and parsed_cv.get("_extraction_version") == GEMINI_CV_PARSE_VERSION
        ):
            # This is the exhaustive file-level extraction, including its coverage audit.
            score_cv = parsed_cv
        else:
            score_cv = semantic_cv
        score_jd = semantic_jd
        # The deterministic parser only supplements soft skills, because vaguely
        # phrased or non-English soft-skill claims are easy for the model to omit
        # while the grounded keyword scan still proves they appear in the source.
        score_cv = _supplement_soft_skills(score_cv, cv_text, is_jd=False)
        score_jd = _supplement_soft_skills(score_jd, normalized_jd, is_jd=True)
        soft_skill_matches = _align_unmatched_soft_skills(
            score_cv, score_jd, model_name
        )
        extraction_provider = "gemini"
    else:
        raise ValueError(f"Unsupported analyzer version: {selected_version}")

    result = match_documents(
        score_cv, score_jd, weights=weights, soft_skill_matches=soft_skill_matches
    )
    result["algorithm_version"] = selected_version
    result["matching_inputs"] = {"cv": score_cv, "jd": score_jd}
    result["engine"] = {
        "framework_version": SCORING_FRAMEWORK_VERSION,
        "algorithm_version": selected_version,
        "extraction_provider": extraction_provider,
        "weights": result["scoring_weights"],
        "source_scope": source_scope,
        "excluded_jd_sections": list(EXCLUDED_JD_SECTION_NAMES),
        "soft_skill_matches": [
            {"jd": jd_label, "cv": cv_label}
            for jd_label, cv_label in soft_skill_matches
        ],
        "principles": [
            "source-grounded evidence",
            "deterministic weighted aggregation",
            "hard eligibility separated from fit score",
            "no inferred or invented candidate facts",
        ],
    }
    if extraction_provider == "gemini":
        result["match_summary"] = (
            f"{result['match_label']} using source-grounded Gemini extraction, "
            "and FitCV's shared weighted scorer."
        )
    return result


def _normalized_section_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" :-").casefold()


def _align_unmatched_soft_skills(
    score_cv: dict[str, Any],
    score_jd: dict[str, Any],
    model_name: str | None,
) -> list[tuple[str, str]]:
    """Ask Gemini to align soft-skill labels that exact/synonym matching missed.

    The extra call is skipped when every JD soft skill already has a CV
    counterpart, and any failure falls back to the deterministic matching so a
    scoring run never depends on the alignment call succeeding.
    """
    cv_soft = [value for value in score_cv.get("soft_skills") or [] if isinstance(value, str)]
    jd_soft = [value for value in score_jd.get("soft_skills") or [] if isinstance(value, str)]
    if not cv_soft or not jd_soft:
        return []
    if not unmatched_soft_skills(cv_soft, jd_soft):
        return []
    try:
        return align_soft_skills(
            cv_soft_skills=cv_soft,
            jd_soft_skills=jd_soft,
            model_name=model_name,
        )
    except GeminiAnalyzerError:
        logger.warning(
            "Soft-skill alignment failed; falling back to deterministic soft-skill matching."
        )
        return []


def _supplement_soft_skills(payload: dict[str, Any], source_text: str, *, is_jd: bool) -> dict[str, Any]:
    """Merge deterministically grounded soft skills the semantic extractor missed."""
    try:
        parsed = parse_jd_text(source_text) if is_jd else parse_cv_text(source_text)
    except ValueError:
        return payload
    local_soft_skills = parsed.get("soft_skills") or []
    if not local_soft_skills:
        return payload
    merged: dict[str, str] = {}
    for value in [*(payload.get("soft_skills") or []), *local_soft_skills]:
        if isinstance(value, str) and value.strip():
            merged.setdefault(value.strip().casefold(), value.strip())
    return {**payload, "soft_skills": sorted(merged.values(), key=str.casefold)}
