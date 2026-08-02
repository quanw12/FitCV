from __future__ import annotations

from collections.abc import Iterable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.account import Account
from app.repositories import analyzer
from app.schemas.analyzer import (
    CvComparisonChangeResponse,
    CvComparisonResponse,
    CvScoreDeltaResponse,
    CvVersionResponse,
)
from app.services.document_parser import PARSER_VERSION, extract_document_text
from app.services.gemini_analyzer import (
    GEMINI_CV_PARSE_VERSION,
    GeminiAnalyzerError,
    extract_cv_inputs_from_file,
)
from app.services.match_engine import selected_analyzer_config


def compare_cv_versions(
    db: Session, *, base_cv_id: int, target_cv_id: int, account: Account
) -> CvComparisonResponse:
    records = analyzer.get_cv_comparison_records(
        db,
        base_cv_id=base_cv_id,
        target_cv_id=target_cv_id,
        account_id=account.account_id,
    )
    if records is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Both CV versions must belong to the signed-in account and be different.",
        )
    (base, base_parse), (target, target_parse) = records
    for label, parsed in (("base", base_parse), ("target", target_parse)):
        if parsed is None or parsed.parse_status in {"Pending", "Processing"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The {label} CV is still being parsed.",
            )
        if parsed.parse_status != "Success" or not isinstance(parsed.parsed_json, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"The {label} CV could not be parsed for comparison.",
            )
    _refresh_legacy_cv_parses(db, base, base_parse)
    _refresh_legacy_cv_parses(db, target, target_parse)

    changes = [
        _list_change("Skills", base_parse.parsed_json.get("skills"), target_parse.parsed_json.get("skills")),
        _list_change("Soft skills", base_parse.parsed_json.get("soft_skills"), target_parse.parsed_json.get("soft_skills")),
        _list_change(
            "Experience",
            base_parse.parsed_json.get("experience_entries"),
            target_parse.parsed_json.get("experience_entries"),
        ),
        _list_change(
            "Education",
            base_parse.parsed_json.get("education_entries"),
            target_parse.parsed_json.get("education_entries"),
        ),
    ]
    deltas = [
        CvScoreDeltaResponse(
            job_description_id=description.job_description_id,
            title=description.title,
            base_score=base_score,
            target_score=target_score,
            delta=round(target_score - base_score, 2),
        )
        for description, base_score, target_score in analyzer.list_cv_score_deltas(
            db,
            base_cv_id=base_cv_id,
            target_cv_id=target_cv_id,
            account_id=account.account_id,
        )
    ]
    return CvComparisonResponse(
        base=_version_response(base, base_parse),
        target=_version_response(target, target_parse),
        changes=changes,
        score_deltas=deltas,
    )


def _version_response(cv, parsed) -> CvVersionResponse:
    return CvVersionResponse(
        cv_id=cv.cv_id,
        file_name=cv.file_name,
        file_type=cv.file_type,
        file_size_kb=cv.file_size_kb,
        version_number=cv.version_number,
        is_latest=cv.is_latest,
        uploaded_at=cv.uploaded_at,
        parse_status=parsed.parse_status,
        parser_version=parsed.parser_version,
        error_message=parsed.error_message,
    )


def _names(values: object) -> set[str]:
    if not isinstance(values, Iterable) or isinstance(values, (str, bytes, dict)):
        return set()
    names: set[str] = set()
    for value in values:
        if isinstance(value, dict):
            value = value.get("name")
        if isinstance(value, str) and value.strip():
            names.add(value.strip())
    return names


def _list_change(category: str, base: object, target: object) -> CvComparisonChangeResponse:
    base_names = _names(base)
    target_names = _names(target)
    return CvComparisonChangeResponse(
        category=category,
        added=sorted(target_names - base_names, key=str.casefold),
        removed=sorted(base_names - target_names, key=str.casefold),
        retained=sorted(base_names & target_names, key=str.casefold),
        summary=_summary(category, target_names - base_names, base_names - target_names),
    )


def _scalar_change(category: str, base: object, target: object) -> CvComparisonChangeResponse:
    base_value = "" if base is None else str(base)
    target_value = "" if target is None else str(target)
    added = [target_value] if target_value and target_value != base_value else []
    removed = [base_value] if base_value and target_value != base_value else []
    retained = [target_value] if target_value and target_value == base_value else []
    return CvComparisonChangeResponse(
        category=category,
        added=added,
        removed=removed,
        retained=retained,
        summary=_summary(category, set(added), set(removed))
        if added or removed
        else f"{category} unchanged.",
    )


def _refresh_legacy_cv_parses(db: Session, cv, parsed) -> None:
    """Upgrade existing CV records before comparison when Gemini is enabled."""
    if not isinstance(parsed.parsed_json, dict):
        return
    if (
        parsed.parsed_json.get("_extraction_provider") == "gemini"
        and parsed.parsed_json.get("_extraction_version") == GEMINI_CV_PARSE_VERSION
    ):
        return
    try:
        algorithm_version, model_name = selected_analyzer_config()
    except GeminiAnalyzerError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    if not algorithm_version.startswith("fitcv-gemini-"):
        return

    root = settings.upload_dir.resolve()
    stored_path = (root / cv.file_path).resolve()
    if stored_path != root and root not in stored_path.parents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The stored CV path is invalid.",
        )
    try:
        text = parsed.parsed_text or extract_document_text(stored_path, cv.file_type)
        payload = extract_cv_inputs_from_file(
            file_path=stored_path,
            file_type=cv.file_type,
            model_name=model_name,
            source_text=text,
        )
        analyzer.set_parse_success(
            db,
            parsed,
            text=text,
            payload=payload,
        )
        parsed.parser_version = PARSER_VERSION
        db.commit()
    except GeminiAnalyzerError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc


def _summary(category: str, added: set[str], removed: set[str]) -> str:
    if not added and not removed:
        return f"No {category.lower()} changed."
    pieces: list[str] = []
    if added:
        pieces.append(f"{len(added)} added")
    if removed:
        pieces.append(f"{len(removed)} removed")
    return f"{category}: {', '.join(pieces)}."
