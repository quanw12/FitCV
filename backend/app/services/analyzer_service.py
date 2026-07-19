import hashlib
import logging
import re
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.account import Account
from app.models.analyzer import MatchResult
from app.repositories import analyzer
from app.schemas.analyzer import AnalyzeCvRequest, CvVersionResponse, MatchResultResponse
from app.services.document_parser import (
    MAX_CV_BYTES,
    PARSER_VERSION,
    extract_document_text,
    parse_cv_text,
    parse_jd_text,
    validate_cv_content,
)
from app.services.matching_service import ALGORITHM_VERSION, match_documents
from app.services.gemini_analyzer import (
    GEMINI_EXTRACTOR_VERSION,
    GeminiAnalyzerError,
    extract_match_inputs,
)

logger = logging.getLogger(__name__)


async def upload_cv(db: Session, *, file: UploadFile, account: Account) -> CvVersionResponse:
    file_name = Path(file.filename or "").name
    if not file_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A CV file is required.")
    content = await file.read(MAX_CV_BYTES + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded CV is empty.")
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="CV files must be 10 MB or smaller.")
    try:
        file_type = validate_cv_content(file_name, content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    relative_path = Path("cv") / str(account.account_id) / f"{uuid4().hex}{Path(file_name).suffix.lower()}"
    target_path = settings.upload_dir / relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content)
    try:
        cv, parsed = analyzer.create_cv(
            db,
            account_id=account.account_id,
            file_name=file_name,
            file_path=str(relative_path),
            file_type=file_type,
            file_size_kb=(len(content) + 1023) // 1024,
            file_sha256=hashlib.sha256(content).hexdigest(),
            parser_version=PARSER_VERSION,
        )
    except Exception:
        db.rollback()
        target_path.unlink(missing_ok=True)
        raise
    return _cv_response(cv, parsed)


def run_cv_parse(cv_id: int) -> None:
    db = SessionLocal()
    try:
        cv = analyzer.get_cv_for_parse(db, cv_id)
        parsed = analyzer.get_latest_parse(db, cv_id)
        if cv is None or parsed is None or parsed.parse_status == "Success":
            return
        analyzer.set_parse_processing(db, parsed)
        text = extract_document_text(_stored_file_path(cv.file_path), cv.file_type)
        analyzer.set_parse_success(db, parsed, text=text, payload=parse_cv_text(text))
    except Exception as exc:
        logger.exception("CV parse task failed for cv_id=%s", cv_id)
        db.rollback()
        parsed = analyzer.get_latest_parse(db, cv_id)
        if parsed is not None:
            analyzer.set_parse_failed(db, parsed, str(exc) or "CV parsing failed.")
    finally:
        db.close()


def list_cvs(db: Session, *, account: Account) -> list[CvVersionResponse]:
    return [_cv_response(cv, parsed) for cv, parsed in analyzer.list_cv_records(db, account.account_id)]


def get_cv(db: Session, *, cv_id: int, account: Account) -> CvVersionResponse:
    record = analyzer.get_cv_record(db, cv_id, account.account_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV not found.")
    return _cv_response(*record)


def delete_cv(db: Session, *, cv_id: int, account: Account) -> None:
    cv = analyzer.get_owned_cv(db, cv_id, account.account_id)
    if cv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV not found.")
    stored_path = _stored_file_path(cv.file_path)
    analyzer.delete_owned_cv(db, cv)
    stored_path.unlink(missing_ok=True)


def request_analysis(
    db: Session, *, request: AnalyzeCvRequest, account: Account
) -> tuple[MatchResultResponse, bool]:
    record = analyzer.get_cv_record(db, request.cv_id, account.account_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CV not found.")
    cv, parsed_cv = record
    if parsed_cv is None or parsed_cv.parse_status in {"Pending", "Processing"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CV parsing is still in progress.")
    if parsed_cv.parse_status != "Success" or not parsed_cv.parsed_json:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=parsed_cv.error_message if parsed_cv else "CV parsing failed.",
        )
    try:
        parsed_jd_payload = parse_jd_text(request.job_description)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    description, parsed_jd = analyzer.get_or_create_job_description(
        db,
        account_id=account.account_id,
        title=request.title,
        raw_text=request.job_description,
        content_sha256=hashlib.sha256(request.job_description.encode("utf-8")).hexdigest(),
        parsed_payload=parsed_jd_payload,
        parser_version=PARSER_VERSION,
    )
    try:
        algorithm_version, model_name = _selected_analyzer_config()
    except GeminiAnalyzerError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    match = analyzer.find_exact_match(
        db, parsed_cv.cv_parse_id, parsed_jd.jd_parse_id, algorithm_version
    )
    should_start = False
    if match is None:
        match = analyzer.create_pending_match(
            db,
            cv=cv,
            parsed_cv=parsed_cv,
            description=description,
            parsed_jd=parsed_jd,
            algorithm_version=algorithm_version,
            model_name=model_name,
        )
        should_start = True
    elif match.status == "Failed":
        analyzer.restart_match(db, match)
        should_start = True
    return _match_response(db, match), should_start


def run_match_task(match_result_id: int) -> None:
    db = SessionLocal()
    match = db.get(MatchResult, match_result_id)
    try:
        if match is None or match.status == "Success":
            return
        analyzer.set_match_processing(db, match)
        match, parsed_cv, parsed_jd, description = analyzer.get_match_context(db, match_result_id)
        if not parsed_cv.parsed_json or not parsed_jd.parsed_json:
            raise ValueError("Parsed CV or job description data is missing.")
        if match.algorithm_version == ALGORITHM_VERSION:
            result = match_documents(parsed_cv.parsed_json, parsed_jd.parsed_json)
        elif match.algorithm_version.startswith("fitcv-gemini-"):
            if not parsed_cv.parsed_text:
                raise ValueError("Readable CV text is missing.")
            cv_payload, jd_payload = extract_match_inputs(
                cv_text=parsed_cv.parsed_text,
                job_description=description.raw_text,
                model_name=match.model_name,
            )
            result = match_documents(cv_payload, jd_payload)
            result["match_summary"] = (
                f"{result['match_label']} using Gemini semantic extraction and FitCV's weighted evidence scorer."
            )
        else:
            raise ValueError(f"Unsupported analyzer version: {match.algorithm_version}")
        analyzer.set_match_success(db, match, result)
    except Exception as exc:
        db.rollback()
        match = db.get(MatchResult, match_result_id)
        if match is not None:
            analyzer.set_match_failed(db, match, str(exc) or "CV/JD matching failed.")
    finally:
        db.close()


def get_match_result(db: Session, *, match_result_id: int, account: Account) -> MatchResultResponse:
    match = analyzer.get_owned_match(db, match_result_id, account.account_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match result not found.")
    return _match_response(db, match)


def _cv_response(cv, parsed) -> CvVersionResponse:
    return CvVersionResponse(
        cv_id=cv.cv_id,
        file_name=cv.file_name,
        file_type=cv.file_type,
        file_size_kb=cv.file_size_kb,
        version_number=cv.version_number,
        is_latest=cv.is_latest,
        uploaded_at=cv.uploaded_at,
        parse_status=parsed.parse_status if parsed else "Pending",
        parser_version=parsed.parser_version if parsed else None,
        error_message=parsed.error_message if parsed else None,
    )


def _match_response(db: Session, match: MatchResult) -> MatchResultResponse:
    evidence = match.evidence_json or {}
    return MatchResultResponse(
        match_result_id=match.match_result_id,
        status=match.status,
        cv_id=match.cv_id,
        job_description_id=match.job_description_id,
        title=analyzer.get_match_title(db, match),
        overall_score=float(match.overall_score) if match.overall_score is not None else None,
        match_label=match.match_label,
        pass_probability=float(match.pass_probability) if match.pass_probability is not None else None,
        breakdown=evidence.get("breakdown", {}),
        strengths=evidence.get("strengths", []),
        weaknesses=evidence.get("weaknesses", []),
        suggestions=evidence.get("suggestions", []),
        algorithm_version=match.algorithm_version,
        error_message=match.error_message,
        generated_at=match.generated_at,
        completed_at=match.completed_at,
    )


def _stored_file_path(file_path: str) -> Path:
    root = settings.upload_dir.resolve()
    candidate = (root / file_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError("Stored CV path is outside the configured upload directory.")
    return candidate


def _selected_analyzer_config() -> tuple[str, str | None]:
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
            f"fitcv-gemini-{model_slug[:31]}-{GEMINI_EXTRACTOR_VERSION}",
            settings.gemini_model,
        )
    raise GeminiAnalyzerError(
        f"Unsupported ANALYZER_PROVIDER: {settings.analyzer_provider}"
    )
