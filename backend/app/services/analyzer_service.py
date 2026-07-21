import hashlib
import logging
import re
from collections import Counter
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.account import Account
from app.models.analyzer import MatchResult
from app.repositories import analyzer
from app.schemas.analyzer import (
    AnalyzeCvRequest,
    CvComparisonSeriesResponse,
    CvScorePointResponse,
    CvVersionResponse,
    JdLibraryInsightsResponse,
    JdLibraryItemResponse,
    MatchResultResponse,
    SkillFrequencyResponse,
)
from app.services.document_parser import (
    MAX_CV_BYTES,
    PARSER_VERSION,
    extract_document_text,
    parse_cv_text,
    parse_jd_text,
    validate_cv_content,
)
from app.services.matching_service import (
    ALGORITHM_VERSION,
    match_documents,
    supplement_semantic_cv,
)
from app.services.gemini_analyzer import (
    GEMINI_EXTRACTOR_VERSION,
    GeminiAnalyzerError,
    extract_match_inputs,
)

logger = logging.getLogger(__name__)


async def upload_cv(
    db: Session, *, file: UploadFile, account: Account
) -> CvVersionResponse:
    file_name = Path(file.filename or "").name
    if not file_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="A CV file is required."
        )
    content = await file.read(MAX_CV_BYTES + 1)
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded CV is empty."
        )
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="CV files must be 10 MB or smaller.",
        )
    try:
        file_type = validate_cv_content(file_name, content)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    relative_path = (
        Path("cv")
        / str(account.account_id)
        / f"{uuid4().hex}{Path(file_name).suffix.lower()}"
    )
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
    return [
        _cv_response(cv, parsed)
        for cv, parsed in analyzer.list_cv_records(db, account.account_id)
    ]


def list_cv_comparisons(
    db: Session, *, account: Account
) -> list[CvComparisonSeriesResponse]:
    latest: dict[tuple[int, int], tuple[MatchResult, object, object]] = {}
    for match, cv, description in analyzer.list_owned_match_records(
        db, account.account_id
    ):
        latest[(description.job_description_id, cv.cv_id)] = (
            match,
            cv,
            description,
        )

    grouped: dict[int, list[tuple[MatchResult, object, object]]] = {}
    for match, cv, description in latest.values():
        grouped.setdefault(description.job_description_id, []).append(
            (match, cv, description)
        )

    series: list[CvComparisonSeriesResponse] = []
    for records in grouped.values():
        records.sort(key=lambda record: record[1].version_number)
        previous_score: float | None = None
        points: list[CvScorePointResponse] = []
        for match, cv, _ in records:
            score = float(match.overall_score)
            delta = (
                round(score - previous_score, 2) if previous_score is not None else None
            )
            points.append(
                CvScorePointResponse(
                    cv_id=cv.cv_id,
                    version_number=cv.version_number,
                    file_name=cv.file_name,
                    uploaded_at=cv.uploaded_at,
                    match_result_id=match.match_result_id,
                    overall_score=score,
                    skill_score=_optional_float(match.skill_score),
                    experience_score=_optional_float(match.experience_score),
                    education_score=_optional_float(match.education_score),
                    soft_skill_score=_optional_float(match.soft_skill_score),
                    match_label=match.match_label,
                    completed_at=match.completed_at,
                    delta_from_previous=delta,
                )
            )
            previous_score = score
        description = records[0][2]
        series.append(
            CvComparisonSeriesResponse(
                job_description_id=description.job_description_id,
                title=description.title,
                created_at=description.created_at,
                best_score=max(point.overall_score for point in points),
                latest_score=points[-1].overall_score,
                latest_delta=points[-1].delta_from_previous,
                versions=points,
            )
        )
    return sorted(series, key=lambda item: item.created_at, reverse=True)


def list_jd_library(
    db: Session, *, account: Account, query: str | None = None
) -> list[JdLibraryItemResponse]:
    matches = _latest_owned_matches(db, account.account_id)
    by_description: dict[int, list[MatchResult]] = {}
    for match, _, description in matches:
        by_description.setdefault(description.job_description_id, []).append(match)
    return [
        _jd_response(
            description, parsed, by_description.get(description.job_description_id, [])
        )
        for description, parsed in analyzer.list_jd_records(
            db, account.account_id, query
        )
    ]


def get_jd_library_item(
    db: Session, *, job_description_id: int, account: Account
) -> JdLibraryItemResponse:
    description = analyzer.get_owned_job_description(
        db, job_description_id, account.account_id
    )
    if description is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job description not found.",
        )
    parsed = analyzer.get_latest_jd_parse(db, description.job_description_id)
    matches = [
        match
        for match, _, item in _latest_owned_matches(db, account.account_id)
        if item.job_description_id == description.job_description_id
    ]
    return _jd_response(description, parsed, matches)


def delete_jd_library_item(
    db: Session, *, job_description_id: int, account: Account
) -> None:
    description = analyzer.get_owned_job_description(
        db, job_description_id, account.account_id
    )
    if description is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job description not found.",
        )
    analyzer.delete_owned_job_description(db, description)


def get_jd_library_insights(
    db: Session, *, account: Account
) -> JdLibraryInsightsResponse:
    records = analyzer.list_jd_records(db, account.account_id)
    matches = _latest_owned_matches(db, account.account_id)
    required: Counter[str] = Counter()
    preferred: Counter[str] = Counter()
    missing: Counter[str] = Counter()
    labels: dict[str, str] = {}

    for _, parsed in records:
        payload = (
            parsed.parsed_json
            if parsed and isinstance(parsed.parsed_json, dict)
            else {}
        )
        _count_skills(required, payload.get("required_skills"), labels)
        _count_skills(preferred, payload.get("preferred_skills"), labels)

    scores: list[float] = []
    for match, _, _ in matches:
        if match.overall_score is not None:
            scores.append(float(match.overall_score))
        evidence = match.evidence_json if isinstance(match.evidence_json, dict) else {}
        breakdown = (
            evidence.get("breakdown")
            if isinstance(evidence.get("breakdown"), dict)
            else {}
        )
        skill_evidence = (
            breakdown.get("skills") if isinstance(breakdown.get("skills"), dict) else {}
        )
        _count_skills(missing, skill_evidence.get("missing"), labels)

    return JdLibraryInsightsResponse(
        total_job_descriptions=len(records),
        total_matches=len(matches),
        average_match_score=(round(sum(scores) / len(scores), 1) if scores else None),
        required_skills=_skill_frequencies(required, len(records), labels),
        preferred_skills=_skill_frequencies(preferred, len(records), labels),
        missing_skills=_skill_frequencies(missing, len(matches), labels),
    )


def get_cv(db: Session, *, cv_id: int, account: Account) -> CvVersionResponse:
    record = analyzer.get_cv_record(db, cv_id, account.account_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="CV not found."
        )
    return _cv_response(*record)


def delete_cv(db: Session, *, cv_id: int, account: Account) -> None:
    cv = analyzer.get_owned_cv(db, cv_id, account.account_id)
    if cv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="CV not found."
        )
    stored_path = _stored_file_path(cv.file_path)
    analyzer.delete_owned_cv(db, cv)
    stored_path.unlink(missing_ok=True)


def request_analysis(
    db: Session, *, request: AnalyzeCvRequest, account: Account
) -> tuple[MatchResultResponse, bool]:
    record = analyzer.get_cv_record(db, request.cv_id, account.account_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="CV not found."
        )
    cv, parsed_cv = record
    if parsed_cv is None or parsed_cv.parse_status in {"Pending", "Processing"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CV parsing is still in progress.",
        )
    if parsed_cv.parse_status != "Success" or not parsed_cv.parsed_json:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=parsed_cv.error_message if parsed_cv else "CV parsing failed.",
        )
    try:
        parsed_jd_payload = parse_jd_text(request.job_description)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    description, parsed_jd = analyzer.get_or_create_job_description(
        db,
        account_id=account.account_id,
        title=request.title,
        raw_text=request.job_description,
        content_sha256=hashlib.sha256(
            request.job_description.encode("utf-8")
        ).hexdigest(),
        parsed_payload=parsed_jd_payload,
        parser_version=PARSER_VERSION,
    )
    try:
        algorithm_version, model_name = _selected_analyzer_config()
    except GeminiAnalyzerError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
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
        match, parsed_cv, parsed_jd, description = analyzer.get_match_context(
            db, match_result_id
        )
        if not parsed_cv.parsed_json or not parsed_jd.parsed_json:
            raise ValueError("Parsed CV or job description data is missing.")
        if match.algorithm_version == ALGORITHM_VERSION:
            score_cv = parsed_cv.parsed_json
            score_jd = parsed_jd.parsed_json
        elif match.algorithm_version.startswith("fitcv-gemini-"):
            if not parsed_cv.parsed_text:
                raise ValueError("Readable CV text is missing.")
            semantic_cv, semantic_jd = extract_match_inputs(
                cv_text=parsed_cv.parsed_text,
                job_description=description.raw_text,
                model_name=match.model_name,
            )
            score_cv = supplement_semantic_cv(
                semantic_cv,
                parsed_cv.parsed_json,
            )
            score_jd = semantic_jd
        else:
            raise ValueError(f"Unsupported analyzer version: {match.algorithm_version}")
        result = match_documents(score_cv, score_jd)
        result["matching_inputs"] = {"cv": score_cv, "jd": score_jd}
        if match.algorithm_version.startswith("fitcv-gemini-"):
            result["match_summary"] = (
                f"{result['match_label']} using Gemini semantic extraction, "
                "locally verified CV terms, and FitCV's weighted evidence scorer."
            )
        analyzer.set_match_success(db, match, result)
    except Exception as exc:
        db.rollback()
        match = db.get(MatchResult, match_result_id)
        if match is not None:
            analyzer.set_match_failed(db, match, str(exc) or "CV/JD matching failed.")
    finally:
        db.close()


def get_match_result(
    db: Session, *, match_result_id: int, account: Account
) -> MatchResultResponse:
    match = analyzer.get_owned_match(db, match_result_id, account.account_id)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Match result not found."
        )
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
        overall_score=float(match.overall_score)
        if match.overall_score is not None
        else None,
        match_label=match.match_label,
        pass_probability=float(match.pass_probability)
        if match.pass_probability is not None
        else None,
        breakdown=evidence.get("breakdown", {}),
        strengths=evidence.get("strengths", []),
        weaknesses=evidence.get("weaknesses", []),
        suggestions=evidence.get("suggestions", []),
        algorithm_version=match.algorithm_version,
        error_message=match.error_message,
        generated_at=match.generated_at,
        completed_at=match.completed_at,
    )


def _latest_owned_matches(
    db: Session, account_id: int
) -> list[tuple[MatchResult, object, object]]:
    latest: dict[tuple[int, int], tuple[MatchResult, object, object]] = {}
    for match, cv, description in analyzer.list_owned_match_records(db, account_id):
        latest[(description.job_description_id, cv.cv_id)] = (match, cv, description)
    return list(latest.values())


def _jd_response(
    description, parsed, matches: list[MatchResult]
) -> JdLibraryItemResponse:
    payload = (
        parsed.parsed_json if parsed and isinstance(parsed.parsed_json, dict) else {}
    )
    latest_match = max(matches, key=lambda match: match.match_result_id, default=None)
    return JdLibraryItemResponse(
        job_description_id=description.job_description_id,
        title=description.title,
        source_type=description.source_type,
        raw_text=description.raw_text,
        created_at=description.created_at,
        parse_status=parsed.parse_status if parsed else "Pending",
        required_skills=_skill_names(payload.get("required_skills")),
        preferred_skills=_skill_names(payload.get("preferred_skills")),
        soft_skills=_skill_names(payload.get("soft_skills")),
        experience_years=_optional_float(payload.get("experience_years")),
        education=str(payload["education"]) if payload.get("education") else None,
        match_count=len(matches),
        latest_score=(
            _optional_float(latest_match.overall_score) if latest_match else None
        ),
        latest_match_label=latest_match.match_label if latest_match else None,
    )


def _skill_names(values) -> list[str]:
    if not isinstance(values, list):
        return []
    names: list[str] = []
    for value in values:
        name = value.get("name") if isinstance(value, dict) else value
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


def _count_skills(counter: Counter[str], values, labels: dict[str, str]) -> None:
    seen: set[str] = set()
    for name in _skill_names(values):
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        current_label = labels.get(key)
        if current_label is None or (current_label.islower() and not name.islower()):
            labels[key] = name
        counter[key] += 1


def _skill_frequencies(
    counter: Counter[str], denominator: int, labels: dict[str, str]
) -> list[SkillFrequencyResponse]:
    return [
        SkillFrequencyResponse(
            skill=labels.get(key, key),
            count=count,
            percentage=round(count / denominator * 100, 1) if denominator else 0,
        )
        for key, count in sorted(
            counter.items(),
            key=lambda item: (-item[1], labels.get(item[0], item[0]).casefold()),
        )[:10]
    ]


def _optional_float(value) -> float | None:
    return float(value) if value is not None else None


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
        model_slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", settings.gemini_model).strip("-")
        if not model_slug:
            raise GeminiAnalyzerError("GEMINI_MODEL must not be empty.")
        return (
            f"fitcv-gemini-{model_slug[:31]}-{GEMINI_EXTRACTOR_VERSION}",
            settings.gemini_model,
        )
    raise GeminiAnalyzerError(
        f"Unsupported ANALYZER_PROVIDER: {settings.analyzer_provider}"
    )
