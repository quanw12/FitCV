from __future__ import annotations

import hashlib
import re
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import HTTPException, UploadFile, status

from app.schemas.cv_ranking import (
    BatchParseResponse,
    ParsedCandidateResponse,
    ScoreBreakdown,
)
from app.services.document_parser import (
    MAX_CV_BYTES,
    extract_document_text,
    parse_cv_text,
    parse_jd_text,
    validate_cv_content,
)
from app.services.gemini_analyzer import GeminiAnalyzerError
from app.services.match_engine import (
    normalize_scoring_jd_text,
    score_match,
    selected_analyzer_config,
)

MAX_BATCH_FILES = 20
SECTION_HEADERS = {
    "about",
    "certificates",
    "contact",
    "education",
    "employment history",
    "experience",
    "languages",
    "links",
    "memberships",
    "objective",
    "profile",
    "projects",
    "skills",
    "summary",
    "technical skills",
    "work experience",
}


def _format_bytes(size: int) -> str:
    if size < 1024 * 1024:
        return f"{max(1, round(size / 1024))} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def _candidate_name_from_file(file_name: str) -> str:
    base_name = re.sub(r"\.[^.]+$", "", file_name)
    base_name = re.sub(r"[_-]+", " ", base_name).strip()
    base_name = re.sub(
        r"\b(cv|resume|profile|candidate)\b",
        "",
        base_name,
        flags=re.IGNORECASE,
    )
    base_name = re.sub(r"\s+", " ", base_name).strip()
    return base_name.title() if base_name else "Unnamed Candidate"


def _identity_lines(text: str) -> list[str]:
    return [
        line.strip()
        for line in text.splitlines()[:15]
        if line.strip()
        and line.strip().casefold().rstrip(":") not in SECTION_HEADERS
        and not re.search(r"@|https?://|www\.|\d{5,}", line, re.IGNORECASE)
    ]


def _infer_name(text: str, file_name: str) -> str:
    lines = _identity_lines(text)
    if lines and 2 <= len(lines[0]) <= 80:
        return lines[0]
    return _candidate_name_from_file(file_name)


def _infer_position(text: str, candidate_name: str) -> str:
    for line in _identity_lines(text):
        if line.casefold() != candidate_name.casefold() and len(line) <= 100:
            return line
    return "Position not detected"


def _first_match(pattern: str, source: str, default: str) -> str:
    match = re.search(pattern, source, flags=re.IGNORECASE)
    return match.group(0).strip() if match else default


def _breakdown_score(result: dict, category: str) -> int:
    value = result.get("breakdown", {}).get(category, {}).get("score")
    return round(float(value)) if value is not None else 0


def _score_candidate(
    result: dict,
) -> tuple[int, ScoreBreakdown, dict]:
    return (
        round(result["overall_score"]),
        ScoreBreakdown(
            skills=_breakdown_score(result, "skills"),
            experience=_breakdown_score(result, "experience"),
            education=_breakdown_score(result, "education"),
            soft_skills=_breakdown_score(result, "soft_skills"),
        ),
        result,
    )


async def parse_batch(
    files: list[UploadFile],
    job_description: str,
) -> BatchParseResponse:
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one CV file is required.",
        )
    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A batch can contain at most {MAX_BATCH_FILES} CV files.",
        )

    normalized_jd = normalize_scoring_jd_text(job_description)
    if len(normalized_jd) < 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description must contain at least 50 readable characters.",
        )

    try:
        algorithm_version, model_name = selected_analyzer_config()
    except GeminiAnalyzerError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    provider = (
        "gemini" if algorithm_version.startswith("fitcv-gemini-")
        else "deterministic"
    )
    deterministic_jd = parse_jd_text(normalized_jd)
    if provider == "deterministic" and not any(
        (
            deterministic_jd.get("required_skills"),
            deterministic_jd.get("preferred_skills"),
            deterministic_jd.get("experience_years") is not None,
            deterministic_jd.get("education"),
            deterministic_jd.get("soft_skills"),
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The job description has no scorable requirements.",
        )

    warnings: list[str] = []
    candidates: list[ParsedCandidateResponse] = []
    response_jd = deterministic_jd

    with TemporaryDirectory(prefix="fitcv-ranking-") as directory:
        working_directory = Path(directory)
        for source_index, file in enumerate(files):
            file_name = Path(file.filename or "").name
            try:
                content = await file.read(MAX_CV_BYTES + 1)
                if not content:
                    raise ValueError("The uploaded CV is empty.")
                if len(content) > MAX_CV_BYTES:
                    raise ValueError("File must be 10MB or smaller.")

                file_type = validate_cv_content(file_name, content)
                suffix = Path(file_name).suffix.lower()
                stored_path = working_directory / f"{source_index}{suffix}"
                stored_path.write_bytes(content)

                parsed_text = extract_document_text(stored_path, file_type)
                deterministic_cv = parse_cv_text(parsed_text)

                result = score_match(
                    cv_text=parsed_text,
                    jd_text=normalized_jd,
                    parsed_cv=deterministic_cv,
                    parsed_jd=deterministic_jd,
                    algorithm_version=algorithm_version,
                    model_name=model_name,
                    source_scope="hr-batch-upload",
                )
                cv_payload = result["matching_inputs"]["cv"]
                jd_payload = result["matching_inputs"]["jd"]
                response_jd = jd_payload
                if provider == "gemini":
                    engine_note = (
                        "Ranked with source-grounded Gemini extraction and "
                        "FitCV's shared weighted score engine."
                    )
                else:
                    engine_note = (
                        "Ranked with FitCV's shared deterministic score engine."
                    )

                score, score_breakdown, result = _score_candidate(
                    result,
                )
                skills_breakdown = result.get("breakdown", {}).get("skills", {})
                candidate_name = _infer_name(parsed_text, file_name)
                candidates.append(
                    ParsedCandidateResponse(
                        id=hashlib.sha256(content).hexdigest()[:20],
                        source_index=source_index,
                        file_name=file_name,
                        file_type=file_type,
                        file_size_label=_format_bytes(len(content)),
                        name=candidate_name,
                        email=_first_match(
                            r"[\w.+-]+@[\w.-]+\.[a-z]{2,}",
                            parsed_text,
                            "Not detected",
                        ),
                        phone=_first_match(
                            r"(?:\+?\d[\d\s().-]{7,}\d)",
                            parsed_text,
                            "Not detected",
                        ),
                        location="Not detected",
                        position=_infer_position(parsed_text, candidate_name),
                        skills=list(cv_payload.get("skills") or []),
                        matched_skills=list(skills_breakdown.get("matched") or []),
                        missing_skills=list(skills_breakdown.get("missing") or []),
                        experience_years=float(
                            cv_payload.get("experience_years") or 0
                        ),
                        education=str(
                            cv_payload.get("education")
                            or "Education not detected"
                        ),
                        score=score,
                        match_label=result["match_label"],
                        score_breakdown=score_breakdown,
                        status="Ready",
                        strengths=list(result.get("strengths") or []),
                        weaknesses=list(result.get("weaknesses") or []),
                        parse_notes=[engine_note],
                    )
                )
            except (GeminiAnalyzerError, RuntimeError, ValueError) as exc:
                warnings.append(f"{file_name or 'Unnamed file'}: {exc}")

    return BatchParseResponse(
        required_skills=list(response_jd.get("required_skills") or []),
        preferred_skills=list(response_jd.get("preferred_skills") or []),
        candidates=sorted(
            candidates,
            key=lambda candidate: candidate.score,
            reverse=True,
        ),
        warnings=warnings,
    )
