from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.application import TrackedApplication
from app.repositories import applications
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
