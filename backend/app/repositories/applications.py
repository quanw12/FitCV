from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.application import TrackedApplication, TrackedApplicationNote, TrackedApplicationStatusHistory


def create_application(db: Session, *, account_id: int, values: dict) -> TrackedApplication:
    application = TrackedApplication(account_id=account_id, **values)
    db.add(application)
    db.flush()
    db.add(
        TrackedApplicationStatusHistory(
            tracked_application_id=application.tracked_application_id,
            previous_status=None,
            new_status=application.status,
        )
    )
    db.commit()
    db.refresh(application)
    return application


def get_owned_application(db: Session, application_id: int, account_id: int) -> TrackedApplication | None:
    return db.scalar(
        select(TrackedApplication).where(
            TrackedApplication.tracked_application_id == application_id,
            TrackedApplication.account_id == account_id,
        )
    )


def list_owned_applications(
    db: Session,
    *,
    account_id: int,
    search: str | None = None,
    status: str | None = None,
    source: str | None = None,
    limit: int | None = 100,
    offset: int = 0,
) -> list[tuple[TrackedApplication, int]]:
    note_counts = (
        select(
            TrackedApplicationNote.tracked_application_id,
            func.count(TrackedApplicationNote.note_id).label("note_count"),
        )
        .group_by(TrackedApplicationNote.tracked_application_id)
        .subquery()
    )
    statement = (
        select(TrackedApplication, func.coalesce(note_counts.c.note_count, 0))
        .outerjoin(
            note_counts,
            note_counts.c.tracked_application_id == TrackedApplication.tracked_application_id,
        )
        .where(TrackedApplication.account_id == account_id)
        .order_by(TrackedApplication.applied_on.desc(), TrackedApplication.tracked_application_id.desc())
        .offset(offset)
    )
    if search:
        pattern = f"%{search.casefold()}%"
        statement = statement.where(
            or_(
                func.lower(TrackedApplication.company_name).like(pattern),
                func.lower(TrackedApplication.position_title).like(pattern),
            )
        )
    if status:
        statement = statement.where(TrackedApplication.status == status)
    if source:
        statement = statement.where(func.lower(TrackedApplication.source) == source.casefold())
    if limit is not None:
        statement = statement.limit(limit)
    return [(row[0], int(row[1])) for row in db.execute(statement).all()]


def count_notes(db: Session, application_id: int) -> int:
    return int(
        db.scalar(
            select(func.count(TrackedApplicationNote.note_id)).where(
                TrackedApplicationNote.tracked_application_id == application_id
            )
        )
        or 0
    )


def list_notes(db: Session, application_id: int) -> list[TrackedApplicationNote]:
    return list(
        db.scalars(
            select(TrackedApplicationNote)
            .where(TrackedApplicationNote.tracked_application_id == application_id)
            .order_by(TrackedApplicationNote.created_at.desc(), TrackedApplicationNote.note_id.desc())
        )
    )


def list_status_history(db: Session, application_id: int) -> list[TrackedApplicationStatusHistory]:
    return list(
        db.scalars(
            select(TrackedApplicationStatusHistory)
            .where(TrackedApplicationStatusHistory.tracked_application_id == application_id)
            .order_by(TrackedApplicationStatusHistory.changed_at.desc(), TrackedApplicationStatusHistory.status_history_id.desc())
        )
    )


def update_application(
    db: Session,
    application: TrackedApplication,
    *,
    values: dict,
    now: datetime,
) -> TrackedApplication:
    previous_status = application.status
    for field, value in values.items():
        setattr(application, field, value)
    application.last_activity_at = now
    if "status" in values and values["status"] != previous_status:
        db.add(
            TrackedApplicationStatusHistory(
                tracked_application_id=application.tracked_application_id,
                previous_status=previous_status,
                new_status=values["status"],
                changed_at=now,
            )
        )
    db.commit()
    db.refresh(application)
    return application


def delete_application(db: Session, application: TrackedApplication) -> None:
    db.delete(application)
    db.commit()


def create_note(
    db: Session,
    application: TrackedApplication,
    *,
    content: str,
    now: datetime,
) -> TrackedApplicationNote:
    note = TrackedApplicationNote(
        tracked_application_id=application.tracked_application_id,
        content=content,
        created_at=now,
    )
    application.last_activity_at = now
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def get_owned_note(
    db: Session,
    *,
    application_id: int,
    note_id: int,
    account_id: int,
) -> TrackedApplicationNote | None:
    return db.scalar(
        select(TrackedApplicationNote)
        .join(
            TrackedApplication,
            TrackedApplication.tracked_application_id == TrackedApplicationNote.tracked_application_id,
        )
        .where(
            TrackedApplicationNote.note_id == note_id,
            TrackedApplicationNote.tracked_application_id == application_id,
            TrackedApplication.account_id == account_id,
        )
    )


def update_note(
    db: Session,
    application: TrackedApplication,
    note: TrackedApplicationNote,
    *,
    content: str,
    now: datetime,
) -> TrackedApplicationNote:
    note.content = content
    note.updated_at = now
    application.last_activity_at = now
    db.commit()
    db.refresh(note)
    return note


def delete_note(
    db: Session,
    application: TrackedApplication,
    note: TrackedApplicationNote,
    *,
    now: datetime,
) -> None:
    db.delete(note)
    application.last_activity_at = now
    db.commit()
