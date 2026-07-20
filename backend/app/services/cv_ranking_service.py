from __future__ import annotations

from io import BytesIO
import re
from zipfile import ZipFile

from fastapi import HTTPException, UploadFile, status

from app.schemas.cv_ranking import BatchParseResponse, ParsedCandidateResponse, ScoreBreakdown
from app.services.document_parser import parse_cv_text, parse_jd_text
from app.services.matching_service import match_documents


MAX_FILE_SIZE = 10 * 1024 * 1024


def _format_bytes(size: int) -> str:
    if size < 1024 * 1024:
        return f"{max(1, round(size / 1024))} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def _candidate_name_from_file(file_name: str) -> str:
    base_name = re.sub(r"\.[^.]+$", "", file_name)
    base_name = re.sub(r"[_-]+", " ", base_name).strip()
    base_name = re.sub(r"\b(cv|resume|profile|candidate)\b", "", base_name, flags=re.IGNORECASE)
    base_name = re.sub(r"\s+", " ", base_name).strip()
    return base_name.title() if base_name else "Unnamed Candidate"


def _extract_docx_text(content: bytes) -> tuple[str, str | None]:
    try:
        from docx import Document

        document = Document(BytesIO(content))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
        return text, None
    except ImportError:
        pass
    except Exception as exc:
        return "", f"DOCX parser failed: {exc}"

    try:
        with ZipFile(BytesIO(content)) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
        text = re.sub(r"<[^>]+>", " ", xml)
        return re.sub(r"\s+", " ", text), "python-docx is not installed; used a simple XML fallback."
    except Exception as exc:
        return "", f"DOCX XML fallback failed: {exc}"


def _extract_pdf_text(content: bytes) -> tuple[str, str | None]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text, None
    except ImportError:
        return "", "pypdf is not installed; PDF text was not extracted."
    except Exception as exc:
        return "", f"PDF parser failed: {exc}"


def _extract_text(file_name: str, content: bytes) -> tuple[str, str | None]:
    extension = file_name.rsplit(".", 1)[-1].lower()
    if extension == "pdf":
        return _extract_pdf_text(content)
    if extension == "docx":
        return _extract_docx_text(content)
    return "", "Unsupported file type."


def _first_match(pattern: str, source: str, default: str) -> str:
    match = re.search(pattern, source, flags=re.IGNORECASE)
    return match.group(0).strip() if match else default


def _infer_name(text: str, file_name: str) -> str:
    for line in text.splitlines()[:8]:
        value = line.strip()
        if 2 <= len(value) <= 80 and not re.search(r"@|\d{4,}", value):
            return value.title()
    return _candidate_name_from_file(file_name)


def _score_candidate(
    cv_payload: dict, jd_payload: dict
) -> tuple[int, ScoreBreakdown, dict]:
    result = match_documents(cv_payload, jd_payload)
    breakdown = result["breakdown"]
    return (
        round(result["overall_score"]),
        ScoreBreakdown(
            skills=round(breakdown.get("skills", {}).get("score", 0)),
            experience=round(breakdown.get("experience", {}).get("score", 0)),
            education=round(breakdown.get("education", {}).get("score", 0)),
        ),
        result,
    )


async def parse_batch(files: list[UploadFile], job_description: str) -> BatchParseResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one CV file is required.")

    try:
        jd_payload = parse_jd_text(job_description)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    if not any(
        (
            jd_payload.get("required_skills"),
            jd_payload.get("preferred_skills"),
            jd_payload.get("experience_years") is not None,
            jd_payload.get("education"),
            jd_payload.get("soft_skills"),
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The job description has no scorable requirements.",
        )

    required = list(jd_payload.get("required_skills") or [])
    warnings: list[str] = []
    candidates: list[ParsedCandidateResponse] = []

    for file in files:
        extension = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
        if extension not in {"pdf", "docx"}:
            warnings.append(f"{file.filename}: Only PDF and DOCX files are supported.")
            continue

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            warnings.append(f"{file.filename}: File must be 10MB or smaller.")
            continue

        parsed_text, parse_warning = _extract_text(file.filename, content)
        try:
            cv_payload = parse_cv_text(parsed_text)
            score, score_breakdown, match_result = _score_candidate(
                cv_payload, jd_payload
            )
        except ValueError as exc:
            warnings.append(f"{file.filename}: {exc}")
            continue

        skills = list(cv_payload.get("skills") or [])
        missing_skills = list(
            match_result.get("breakdown", {})
            .get("skills", {})
            .get("missing", [])
        )
        experience_years = int(cv_payload.get("experience_years") or 0)
        education = str(cv_payload.get("education") or "Education not detected")

        notes = [
            "MVP parser extracts text when local parser dependencies are available.",
            "Ranking is rule-based for now; AI scoring will be designed in the next phase.",
        ]
        if parse_warning:
            notes.append(parse_warning)
            warnings.append(f"{file.filename}: {parse_warning}")

        candidates.append(
            ParsedCandidateResponse(
                id=f"{file.filename}-{len(content)}",
                file_name=file.filename,
                file_type=extension.upper(),
                file_size_label=_format_bytes(len(content)),
                name=_infer_name(parsed_text, file.filename),
                email=_first_match(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", parsed_text, "Not detected"),
                phone=_first_match(r"(?:\+?\d[\d\s().-]{7,}\d)", parsed_text, "Not detected"),
                location="Not detected",
                position="Senior Backend Developer",
                skills=skills,
                missing_skills=missing_skills,
                experience_years=experience_years,
                education=education,
                score=score,
                score_breakdown=score_breakdown,
                status="Ready",
                parse_notes=notes,
            )
        )

    return BatchParseResponse(
        required_skills=required,
        candidates=sorted(candidates, key=lambda candidate: candidate.score, reverse=True),
        warnings=warnings,
    )
