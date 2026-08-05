from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.account import Account
from app.models.platform import HrScreeningCandidate, ScreeningBatchStatus
from app.repositories import screening_batches
from app.schemas.cv_ranking import (
    BatchParseResponse,
    ParsedCandidateResponse,
    ScoreBreakdown,
    ScreeningBatchSummary,
    ScreeningSelectionRequest,
)
from app.services import ai_task_service
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


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _batch_title(job_description: str, title: str | None) -> str:
    if title and title.strip():
        return title.strip()[:200]
    first_line = next(
        (line.strip() for line in job_description.splitlines() if line.strip()),
        "HR screening batch",
    )
    return first_line[:200]


def _stored_batch_file(file_path: str) -> Path:
    root = settings.upload_dir.resolve()
    candidate = (root / file_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError("Invalid screening CV path.")
    return candidate


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


async def create_screening_batch(
    db: Session,
    *,
    files: list[UploadFile],
    job_description: str,
    account: Account,
    title: str | None = None,
) -> BatchParseResponse:
    if account.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A company must be assigned before saving a screening batch.",
        )
    if not files or len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A batch must contain between 1 and {MAX_BATCH_FILES} CV files.",
        )
    normalized_jd = normalize_scoring_jd_text(job_description)
    if len(normalized_jd) < 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description must contain at least 50 readable characters.",
        )

    batch = screening_batches.create_batch(
        db,
        company_id=account.company_id,
        account_id=account.account_id,
        title=_batch_title(normalized_jd, title),
        job_description=normalized_jd,
        total_files=len(files),
    )
    directory = settings.upload_dir / "screening-batches" / str(batch.screening_batch_id)
    directory.mkdir(parents=True, exist_ok=True)
    rows: list[HrScreeningCandidate] = []
    written: list[Path] = []
    try:
        for source_index, file in enumerate(files):
            file_name = Path(file.filename or "").name
            content = await file.read(MAX_CV_BYTES + 1)
            if not content:
                raise ValueError(f"{file_name or 'Unnamed file'} is empty.")
            if len(content) > MAX_CV_BYTES:
                raise ValueError(f"{file_name}: file must be 10MB or smaller.")
            file_type = validate_cv_content(file_name, content)
            digest = hashlib.sha256(content).hexdigest()
            suffix = Path(file_name).suffix.lower()
            stored_name = f"{source_index}-{digest[:16]}{suffix}"
            relative_path = Path("screening-batches") / str(batch.screening_batch_id) / stored_name
            target = _stored_batch_file(str(relative_path))
            target.write_bytes(content)
            written.append(target)
            rows.append(
                HrScreeningCandidate(
                    screening_batch_id=batch.screening_batch_id,
                    source_index=source_index,
                    candidate_key=hashlib.sha256(
                        f"{source_index}:{digest}".encode("utf-8")
                    ).hexdigest(),
                    file_name=file_name,
                    file_path=str(relative_path).replace("\\", "/"),
                    file_type=file_type,
                    file_size_kb=(len(content) + 1023) // 1024,
                    file_sha256=digest,
                )
            )
        screening_batches.add_candidates(db, rows)
    except Exception as exc:
        db.rollback()
        for path in written:
            path.unlink(missing_ok=True)
        batch.status = ScreeningBatchStatus.failed
        batch.error_message = str(exc)[:1000]
        db.add(batch)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc) or "Unable to save screening files.",
        ) from exc

    task = ai_task_service.enqueue(
        db,
        task_type="ScreeningBatch",
        resource_id=batch.screening_batch_id,
        account=account,
        idempotency_key=f"screening-batch:{batch.screening_batch_id}",
    )
    return BatchParseResponse(
        required_skills=[],
        preferred_skills=[],
        candidates=[],
        warnings=[],
        screening_batch_id=batch.screening_batch_id,
        ai_task_id=task.ai_task_id,
        status=batch.status,
        title=batch.title,
        created_at=batch.created_at,
        total_files=batch.total_files,
        processed_count=batch.processed_count,
    )


def run_screening_batch(batch_id: int) -> None:
    db = SessionLocal()
    opened: list[UploadFile] = []
    try:
        batch = screening_batches.get(db, batch_id)
        if batch is None:
            raise LookupError("Screening batch not found.")
        if batch.status == ScreeningBatchStatus.completed:
            return
        screening_batches.mark_processing(db, batch)
        rows = screening_batches.list_candidates(db, batch_id)
        files: list[UploadFile] = []
        for row in rows:
            path = _stored_batch_file(row.file_path)
            upload = UploadFile(filename=row.file_name, file=BytesIO(path.read_bytes()))
            files.append(upload)
            opened.append(upload)
        response = asyncio.run(parse_batch(files, batch.job_description))
        results = {
            candidate.source_index: candidate.model_dump()
            for candidate in response.candidates
        }
        screening_batches.save_result(
            db,
            batch,
            required_skills=response.required_skills,
            preferred_skills=response.preferred_skills,
            warnings=response.warnings,
            results=results,
            completed_at=_utcnow_naive(),
        )
        if not response.candidates:
            raise RuntimeError("No CV in this screening batch could be processed.")
    except Exception as exc:
        db.rollback()
        failed_batch = screening_batches.get(db, batch_id)
        if failed_batch is not None:
            failed_batch.status = ScreeningBatchStatus.failed
            failed_batch.error_message = (str(exc) or "Screening failed.")[:1000]
            db.commit()
        raise
    finally:
        for upload in opened:
            upload.file.close()
        db.close()


def _persisted_candidate(row: HrScreeningCandidate) -> ParsedCandidateResponse | None:
    if row.status.value != "Ready" or row.score is None:
        return None
    breakdown = row.score_breakdown_json or {}
    return ParsedCandidateResponse(
        id=row.candidate_key,
        screening_candidate_id=row.screening_candidate_id,
        source_index=row.source_index,
        file_name=row.file_name,
        file_type=row.file_type,
        file_size_label=_format_bytes(row.file_size_kb * 1024),
        name=row.name or "Unnamed Candidate",
        email=row.email or "Not detected",
        phone=row.phone or "Not detected",
        location=row.location or "Not detected",
        position=row.position or "Position not detected",
        skills=list(row.skills_json or []),
        matched_skills=list(row.matched_skills_json or []),
        missing_skills=list(row.missing_skills_json or []),
        experience_years=float(row.experience_years or 0),
        education=row.education or "Education not detected",
        score=round(float(row.score)),
        match_label=row.match_label or "Weak Match",
        score_breakdown=ScoreBreakdown(
            skills=round(float(breakdown.get("skills", 0))),
            experience=round(float(breakdown.get("experience", 0))),
            education=round(float(breakdown.get("education", 0))),
            soft_skills=round(float(breakdown.get("soft_skills", 0))),
        ),
        status="Ready",
        strengths=list(row.strengths_json or []),
        weaknesses=list(row.weaknesses_json or []),
        parse_notes=list(row.parse_notes_json or []),
        is_selected=row.is_selected,
        is_confirmed=row.is_confirmed,
    )


def get_screening_batch(
    db: Session, *, batch_id: int, account: Account
) -> BatchParseResponse:
    if account.company_id is None:
        raise HTTPException(status_code=404, detail="Screening batch not found.")
    batch = screening_batches.get_owned(db, batch_id, account.company_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Screening batch not found.")
    rows = screening_batches.list_candidates(db, batch_id)
    candidates = [item for row in rows if (item := _persisted_candidate(row))]
    warnings = list(batch.warnings_json or [])
    warnings.extend(
        f"{row.file_name}: {row.error_message}"
        for row in rows
        if row.error_message and not any(item.startswith(f"{row.file_name}:") for item in warnings)
    )
    return BatchParseResponse(
        required_skills=list(batch.required_skills_json or []),
        preferred_skills=list(batch.preferred_skills_json or []),
        candidates=sorted(candidates, key=lambda candidate: candidate.score, reverse=True),
        warnings=warnings,
        screening_batch_id=batch.screening_batch_id,
        status=batch.status,
        title=batch.title,
        created_at=batch.created_at,
        total_files=batch.total_files,
        processed_count=batch.processed_count,
    )


def list_screening_history(
    db: Session,
    *,
    account: Account,
    query: str | None,
    status_filter: ScreeningBatchStatus | None,
    created_from: datetime | None,
    created_to: datetime | None,
    min_score: float | None,
    limit: int,
    offset: int,
) -> list[ScreeningBatchSummary]:
    if account.company_id is None:
        return []
    rows = screening_batches.list_history(
        db,
        company_id=account.company_id,
        query=query,
        status=status_filter,
        created_from=created_from,
        created_to=created_to,
        min_score=min_score,
        limit=limit,
        offset=offset,
    )
    return [ScreeningBatchSummary.model_validate(row) for row in rows]


def save_selection(
    db: Session,
    *,
    batch_id: int,
    request: ScreeningSelectionRequest,
    account: Account,
) -> BatchParseResponse:
    if account.company_id is None:
        raise HTTPException(status_code=404, detail="Screening batch not found.")
    batch = screening_batches.get_owned(db, batch_id, account.company_id, for_update=True)
    if batch is None:
        raise HTTPException(status_code=404, detail="Screening batch not found.")
    screening_batches.update_selection(
        db,
        batch,
        selected_keys=set(request.selected_candidate_keys),
        confirmed_keys=set(request.confirmed_candidate_keys),
    )
    return get_screening_batch(db, batch_id=batch_id, account=account)


def download_screening_cv(
    db: Session, *, batch_id: int, candidate_id: int, account: Account
) -> FileResponse:
    if account.company_id is None:
        raise HTTPException(status_code=404, detail="Screening CV not found.")
    batch = screening_batches.get_owned(db, batch_id, account.company_id)
    row = screening_batches.get_candidate(db, batch_id, candidate_id) if batch else None
    if row is None:
        raise HTTPException(status_code=404, detail="Screening CV not found.")
    path = _stored_batch_file(row.file_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Stored screening CV is unavailable.")
    return FileResponse(path, filename=row.file_name)
