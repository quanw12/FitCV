from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.account import Account, AccountRole
from app.models.application import TrackedApplication
from app.repositories import analyzer, applications
from app.schemas.applications import (
    ApplicationCreatedResponse,
    ApplicationRetryResponse,
    RankedApplicationResponse,
    RankedCandidateResponse,
    RankedCvResponse,
    TrackedApplicationResponse,
    TrackedCompanyResponse,
    TrackedCvResponse,
    TrackedJobResponse,
)
from app.schemas.application import (
    ApplicationCreate,
    ApplicationDetailResponse,
    ApplicationNoteCreate,
    ApplicationNoteResponse,
    ApplicationNoteUpdate,
    ApplicationStatsResponse,
    ApplicationStatus,
    ApplicationSummaryResponse,
    ApplicationUpdate,
)
from app.services.analyzer_service import _selected_analyzer_config
from app.services.document_parser import (
    MAX_CV_BYTES,
    PARSER_VERSION,
    extract_document_text,
    parse_cv_text,
    parse_jd_text,
    validate_cv_content,
)
from app.services.gemini_analyzer import (
    GeminiAnalyzerError,
    extract_match_inputs,
)
from app.services.jobs_service import _decode_description
from app.services.matching_service import (
    ALGORITHM_VERSION,
    match_documents,
    supplement_semantic_cv,
)

logger = logging.getLogger(__name__)
MANAGER_ROLES = {AccountRole.hr, AccountRole.hiring_manager, AccountRole.admin}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _stored_path(relative_path: str) -> Path:
    root = settings.upload_dir.resolve()
    candidate = (root / relative_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError("Stored CV path is outside the configured upload directory.")
    return candidate


async def apply(
    db: Session,
    *,
    job_id: int,
    full_name: str,
    email: str,
    phone: str,
    file: UploadFile,
    account: Account,
) -> ApplicationCreatedResponse:
    full_name = full_name.strip()
    email = email.strip()
    phone = phone.strip()
    if not full_name or not phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Full name and phone are required.",
        )

    applications.lock_account(db, account.account_id)
    job = applications.job_for_apply(db, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
        )
    if job.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
        )
    if job.status != "Published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only published jobs accept applications.",
        )
    if job.deadline is not None:
        deadline = job.deadline.astimezone(timezone.utc).replace(tzinfo=None) if job.deadline.tzinfo else job.deadline
        if deadline <= _now():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The application deadline has expired.",
            )
    if applications.active_application(db, account.account_id, job_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active application already exists for this job.",
        )

    file_name = Path(file.filename or "").name
    content = await file.read(MAX_CV_BYTES + 1)
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded CV is empty.",
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
    if file_type != "PDF":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported for job applications.",
        )

    try:
        algorithm_version, model_name = _selected_analyzer_config()
    except GeminiAnalyzerError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    relative_path = Path("applications") / str(account.account_id) / f"{uuid4().hex}.pdf"
    target = _stored_path(str(relative_path))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    try:
        application, cv, match = applications.create_application_records(
            db,
            account_id=account.account_id,
            job_id=job_id,
            full_name=full_name,
            email=email,
            phone=phone,
            file_name=file_name,
            file_path=str(relative_path),
            file_size_kb=(len(content) + 1023) // 1024,
            file_sha256=hashlib.sha256(content).hexdigest(),
            parser_version=PARSER_VERSION,
            algorithm_version=algorithm_version,
            model_name=model_name,
        )
        return ApplicationCreatedResponse(
            application_id=application.application_id,
            cv_id=cv.cv_id,
            match_result_id=match.match_result_id,
            analysis_status="Pending",
        )
    except Exception:
        db.rollback()
        target.unlink(missing_ok=True)
        raise


def _job_text(job) -> str:
    virtual = _decode_description(job.description)
    sections = [
        ("Title", job.title),
        *[(name.replace("_", " ").title(), virtual.get(name)) for name in virtual],
        ("Requirements", job.requirements),
        ("Location", job.location),
        ("Employment Type", job.employment_type),
        ("Deadline", job.deadline.isoformat() if job.deadline else None),
    ]
    return "\n".join(f"{label}: {value}" for label, value in sections if value not in (None, ""))


def run_analysis(application_id: int) -> None:
    db = SessionLocal()
    parsed_cv = None
    parsed_jd = None
    match = None
    try:
        context = applications.analysis_context(db, application_id)
        if context is None:
            return
        application, cv, parsed_cv, job, match = context
        if match.status == "Success":
            return
        match.cv_parse_id = parsed_cv.cv_parse_id
        db.commit()
        analyzer.set_match_processing(db, match)
        if (
            parsed_cv.parse_status == "Success"
            and parsed_cv.parsed_text
            and parsed_cv.parsed_json
        ):
            text = parsed_cv.parsed_text
            cv_payload = parsed_cv.parsed_json
        else:
            analyzer.set_parse_processing(db, parsed_cv)
            text = parsed_cv.parsed_text or extract_document_text(
                _stored_path(cv.file_path),
                cv.file_type,
            )
            cv_payload = parse_cv_text(text)
            analyzer.set_parse_success(db, parsed_cv, text=text, payload=cv_payload)

        raw_jd = _job_text(job)
        parsed_jd = applications.create_job_parse(
            db,
            match=match,
            account_id=job.created_by_account_id,
            job_id=job.job_id,
            title=job.title,
            raw_text=raw_jd,
            content_sha256=hashlib.sha256(raw_jd.encode("utf-8")).hexdigest(),
            parser_version=PARSER_VERSION,
        )
        jd_payload = parse_jd_text(raw_jd)
        applications.set_job_parse_success(db, parsed_jd, jd_payload)
        if match.algorithm_version == ALGORITHM_VERSION:
            score_cv = cv_payload
            score_jd = jd_payload
        elif match.algorithm_version.startswith("fitcv-gemini-"):
            gemini_cv, gemini_jd = extract_match_inputs(
                cv_text=text,
                job_description=raw_jd,
                model_name=match.model_name,
            )
            score_cv = supplement_semantic_cv(gemini_cv, cv_payload)
            score_jd = gemini_jd
        else:
            raise ValueError(
                f"Unsupported analyzer version: {match.algorithm_version}"
            )
        result = match_documents(score_cv, score_jd)
        result["matching_inputs"] = {"cv": score_cv, "jd": score_jd}
        if match.algorithm_version.startswith("fitcv-gemini-"):
            result["match_summary"] = (
                f"{result['match_label']} using Gemini semantic extraction, "
                "locally verified CV terms, and FitCV's weighted evidence scorer."
            )
        analyzer.set_match_success(db, match, result)
    except Exception as exc:
        logger.exception("Application analysis failed for application_id=%s", application_id)
        db.rollback()
        if parsed_cv is not None and parsed_cv.parse_status != "Success":
            analyzer.set_parse_failed(db, parsed_cv, str(exc) or "CV parsing failed.")
        if parsed_jd is not None and parsed_jd.parse_status != "Success":
            applications.set_job_parse_failed(
                db, parsed_jd, str(exc) or "Job description parsing failed."
            )
        if match is not None:
            analyzer.set_match_failed(db, match, str(exc) or "Matching failed.")
    finally:
        db.close()


def ranked(db: Session, *, job_id: int, account: Account) -> list[RankedApplicationResponse]:
    if account.company_id is None:
        raise HTTPException(status_code=400, detail="A company must be assigned.")
    job = applications.get_job(db, job_id)
    if job is None or job.company_id != account.company_id:
        raise HTTPException(status_code=404, detail="Job not found for this company.")
    responses = []
    for application, candidate, cv, parsed, match in applications.ranked_rows(db, job_id):
        evidence = match.evidence_json if match and match.evidence_json else {}
        raw_breakdown = evidence.get("breakdown", {})
        breakdown = {
            name: (
                float(item["score"])
                if isinstance(item, dict) and item.get("score") is not None
                else None
            )
            for name, item in raw_breakdown.items()
        }
        responses.append(RankedApplicationResponse(
            application_id=application.application_id,
            job_id=application.job_id,
            current_stage=application.current_stage,
            status=application.status,
            applied_at=application.applied_at,
            candidate=RankedCandidateResponse(
                full_name=candidate.full_name or "Unnamed candidate",
                email=candidate.email or "",
                phone=candidate.phone or "",
            ),
            cv=RankedCvResponse(
                file_name=cv.file_name,
                file_type=cv.file_type,
                file_size_kb=cv.file_size_kb or 0,
            ),
            parse_status=parsed.parse_status if parsed else "Pending",
            parse_error=parsed.error_message if parsed else None,
            parsed_cv=parsed.parsed_json if parsed else None,
            analysis_status=match.status if match else (parsed.parse_status if parsed else "Pending"),
            analysis_error=match.error_message if match else None,
            overall_score=float(match.overall_score) if match and match.overall_score is not None else None,
            pass_probability=(
                float(match.pass_probability)
                if match and match.pass_probability is not None
                else None
            ),
            algorithm_version=match.algorithm_version if match else None,
            match_label=match.match_label if match else None,
            breakdown=breakdown,
        ))
    return responses


def mine(
    db: Session,
    *,
    account: Account,
) -> list[TrackedApplicationResponse]:
    responses = []
    for application, job, company, cv, parsed, match in applications.student_rows(
        db, account.account_id
    ):
        parse_status = parsed.parse_status if parsed else "Pending"
        analysis_status = (
            match.status if match else parse_status
        )
        analysis_error = None
        if parse_status == "Failed" and parsed is not None:
            analysis_error = parsed.error_message
        elif analysis_status == "Failed" and match is not None:
            analysis_error = match.error_message

        responses.append(
            TrackedApplicationResponse(
                application_id=application.application_id,
                job_id=application.job_id,
                current_stage=application.current_stage,
                status=application.status,
                applied_at=application.applied_at,
                updated_at=application.updated_at,
                job=TrackedJobResponse(
                    title=job.title,
                    location=job.location,
                    employment_type=job.employment_type,
                    job_status=job.status,
                    company=TrackedCompanyResponse(
                        name=company.company_name,
                        logo_url=company.logo_url,
                        website_url=company.website_url,
                    ),
                ),
                cv=TrackedCvResponse(
                    file_name=cv.file_name,
                    file_type=cv.file_type,
                    file_size_kb=cv.file_size_kb or 0,
                ),
                parse_status=parse_status,
                analysis_status=analysis_status,
                analysis_error=analysis_error,
            )
        )
    return responses


def retry_analysis(
    db: Session,
    *,
    application_id: int,
    account: Account,
) -> ApplicationRetryResponse:
    row = applications.download_context(db, application_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    application, candidate, _cv, job = row
    if not _can_access_application(account, candidate, job):
        raise HTTPException(
            status_code=403,
            detail="You cannot retry analysis for this application.",
        )

    context = applications.analysis_context(db, application_id)
    if context is None:
        raise HTTPException(
            status_code=404,
            detail="Application analysis context was not found.",
        )
    _application, _cv, parsed_cv, _job, match = context
    if match.status in {"Pending", "Processing"} or parsed_cv.parse_status in {
        "Pending",
        "Processing",
    }:
        raise HTTPException(
            status_code=409,
            detail="Application analysis is already running.",
        )
    reparse_cv = (
        parsed_cv.parse_status != "Success"
        or not parsed_cv.parsed_text
        or not parsed_cv.parsed_json
        or parsed_cv.parser_version != PARSER_VERSION
    )
    applications.reset_analysis(
        db,
        parsed_cv=parsed_cv,
        match=match,
        parser_version=PARSER_VERSION,
        reparse_cv=reparse_cv,
    )
    return ApplicationRetryResponse(
        application_id=application.application_id,
        analysis_status="Pending",
    )


def download(db: Session, *, application_id: int, account: Account) -> FileResponse:
    row = applications.download_context(db, application_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Application CV not found.")
    application, candidate, cv, job = row
    if not _can_access_application(account, candidate, job):
        raise HTTPException(status_code=403, detail="You cannot access this application CV.")
    path = _stored_path(cv.file_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Stored CV file not found.")
    return FileResponse(path, media_type="application/pdf", filename=cv.file_name)


def _can_access_application(account: Account, candidate, job) -> bool:
    is_owner = (
        account.role == AccountRole.student
        and candidate.account_id == account.account_id
    )
    is_manager = (
        account.role in MANAGER_ROLES
        and account.company_id is not None
        and job.company_id == account.company_id
    )
    return is_owner or is_manager

STALE_AFTER_DAYS = 30
ACTIVE_REMINDER_STATUSES = {
    ApplicationStatus.applied.value,
    ApplicationStatus.screening.value,
    ApplicationStatus.interview.value,
}


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive_utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _owned_or_404(db: Session, application_id: int, account_id: int) -> TrackedApplication:
    application = applications.get_owned_application(db, application_id, account_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    return application


def _reminder_fields(application: TrackedApplication, *, now: datetime) -> dict:
    days_since_update = max(0, (now.date() - application.last_activity_at.date()).days)
    if application.status not in ACTIVE_REMINDER_STATUSES:
        return {
            "reminder_due": False,
            "reminder_reason": None,
            "days_since_update": days_since_update,
        }
    if application.reminder_at is not None:
        due = application.reminder_at <= now
        return {
            "reminder_due": due,
            "reminder_reason": "Scheduled follow-up is due." if due else None,
            "days_since_update": days_since_update,
        }
    due = days_since_update >= STALE_AFTER_DAYS
    return {
        "reminder_due": due,
        "reminder_reason": f"No update in {days_since_update} days." if due else None,
        "days_since_update": days_since_update,
    }


def _summary(
    application: TrackedApplication,
    *,
    note_count: int,
    now: datetime,
) -> ApplicationSummaryResponse:
    return ApplicationSummaryResponse(
        application_id=application.tracked_application_id,
        company_name=application.company_name,
        position_title=application.position_title,
        applied_on=application.applied_on,
        source=application.source,
        status=ApplicationStatus(application.status),
        job_url=application.job_url,
        reminder_at=application.reminder_at,
        last_activity_at=application.last_activity_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
        note_count=note_count,
        **_reminder_fields(application, now=now),
    )


def create_application(
    db: Session,
    *,
    payload: ApplicationCreate,
    account: Account,
) -> ApplicationDetailResponse:
    values = payload.model_dump()
    values["status"] = payload.status.value
    values["reminder_at"] = _naive_utc(payload.reminder_at)
    application = applications.create_application(db, account_id=account.account_id, values=values)
    return get_application(db, application_id=application.tracked_application_id, account=account)


def list_applications(
    db: Session,
    *,
    account: Account,
    search: str | None,
    application_status: ApplicationStatus | None,
    source: str | None,
    reminders_only: bool,
    limit: int,
    offset: int,
) -> list[ApplicationSummaryResponse]:
    now = _utcnow_naive()
    rows = applications.list_owned_applications(
        db,
        account_id=account.account_id,
        search=search.strip() if search else None,
        status=application_status.value if application_status else None,
        source=source.strip() if source else None,
        limit=None if reminders_only else limit,
        offset=0 if reminders_only else offset,
    )
    summaries = [_summary(item, note_count=note_count, now=now) for item, note_count in rows]
    if reminders_only:
        summaries = [item for item in summaries if item.reminder_due][offset : offset + limit]
    return summaries


def get_application(
    db: Session,
    *,
    application_id: int,
    account: Account,
) -> ApplicationDetailResponse:
    application = _owned_or_404(db, application_id, account.account_id)
    summary = _summary(
        application,
        note_count=applications.count_notes(db, application_id),
        now=_utcnow_naive(),
    )
    return ApplicationDetailResponse(
        **summary.model_dump(),
        notes=applications.list_notes(db, application_id),
        status_history=applications.list_status_history(db, application_id),
    )


def update_application(
    db: Session,
    *,
    application_id: int,
    payload: ApplicationUpdate,
    account: Account,
) -> ApplicationDetailResponse:
    application = _owned_or_404(db, application_id, account.account_id)
    values = payload.model_dump(exclude_unset=True)
    if "status" in values and payload.status is not None:
        values["status"] = payload.status.value
    if "reminder_at" in values:
        values["reminder_at"] = _naive_utc(payload.reminder_at)
    applications.update_application(db, application, values=values, now=_utcnow_naive())
    return get_application(db, application_id=application_id, account=account)


def delete_application(db: Session, *, application_id: int, account: Account) -> None:
    application = _owned_or_404(db, application_id, account.account_id)
    applications.delete_application(db, application)


def get_stats(db: Session, *, account: Account) -> ApplicationStatsResponse:
    rows = applications.list_owned_applications(db, account_id=account.account_id, limit=None)
    now = _utcnow_naive()
    by_status = {item: 0 for item in ApplicationStatus}
    reminders_due = 0
    for application, _ in rows:
        by_status[ApplicationStatus(application.status)] += 1
        reminders_due += int(_reminder_fields(application, now=now)["reminder_due"])
    return ApplicationStatsResponse(total=len(rows), reminders_due=reminders_due, by_status=by_status)


def create_note(
    db: Session,
    *,
    application_id: int,
    payload: ApplicationNoteCreate,
    account: Account,
) -> ApplicationNoteResponse:
    application = _owned_or_404(db, application_id, account.account_id)
    return applications.create_note(db, application, content=payload.content, now=_utcnow_naive())


def update_note(
    db: Session,
    *,
    application_id: int,
    note_id: int,
    payload: ApplicationNoteUpdate,
    account: Account,
) -> ApplicationNoteResponse:
    application = _owned_or_404(db, application_id, account.account_id)
    note = applications.get_owned_note(
        db,
        application_id=application_id,
        note_id=note_id,
        account_id=account.account_id,
    )
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application note not found.")
    return applications.update_note(db, application, note, content=payload.content, now=_utcnow_naive())


def delete_note(
    db: Session,
    *,
    application_id: int,
    note_id: int,
    account: Account,
) -> None:
    application = _owned_or_404(db, application_id, account.account_id)
    note = applications.get_owned_note(
        db,
        application_id=application_id,
        note_id=note_id,
        account_id=account.account_id,
    )
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application note not found.")
    applications.delete_note(db, application, note, now=_utcnow_naive())
