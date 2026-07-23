from __future__ import annotations

import re
from typing import Any

from app.core.config import settings
from app.services.document_parser import (
    parse_cv_text,
    parse_jd_text,
    preprocess_document_text,
)
from app.services.gemini_analyzer import (
    GEMINI_EXTRACTOR_VERSION,
    GeminiAnalyzerError,
    extract_match_inputs,
)
from app.services.matching_service import (
    ALGORITHM_VERSION,
    CATEGORY_WEIGHTS,
    SCORING_FRAMEWORK_VERSION,
    match_documents,
    supplement_semantic_cv,
    supplement_semantic_jd,
)

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
            f"fitcv-gemini-{model_slug[:22]}-{GEMINI_EXTRACTOR_VERSION}-s2",
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
) -> dict[str, Any]:
    normalized_jd = normalize_scoring_jd_text(jd_text)
    local_cv = parsed_cv or parse_cv_text(cv_text)
    local_jd = parsed_jd or parse_jd_text(normalized_jd)
    selected_version = algorithm_version or selected_analyzer_config()[0]

    if selected_version in {ALGORITHM_VERSION, LEGACY_DETERMINISTIC_VERSION}:
        score_cv = local_cv
        score_jd = local_jd
        extraction_provider = "deterministic"
    elif selected_version.startswith("fitcv-gemini-"):
        semantic_cv, semantic_jd = extract_match_inputs(
            cv_text=cv_text,
            job_description=normalized_jd,
            model_name=model_name,
        )
        score_cv = supplement_semantic_cv(semantic_cv, local_cv)
        score_jd = supplement_semantic_jd(semantic_jd, local_jd)
        extraction_provider = "gemini"
    else:
        raise ValueError(f"Unsupported analyzer version: {selected_version}")

    result = match_documents(score_cv, score_jd)
    result["algorithm_version"] = selected_version
    result["matching_inputs"] = {"cv": score_cv, "jd": score_jd}
    result["engine"] = {
        "framework_version": SCORING_FRAMEWORK_VERSION,
        "algorithm_version": selected_version,
        "extraction_provider": extraction_provider,
        "weights": CATEGORY_WEIGHTS,
        "source_scope": source_scope,
        "excluded_jd_sections": list(EXCLUDED_JD_SECTION_NAMES),
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
            "locally verified CV/JD facts, and FitCV's shared weighted scorer."
        )
    return result


def _normalized_section_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" :-").casefold()
