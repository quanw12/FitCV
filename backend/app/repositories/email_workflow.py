from datetime import datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Application,
    Candidate,
    CandidateEmail,
    CandidateEmailEvent,
    CandidateEmailInbound,
    CandidateEmailThread,
    Company,
    Job,
    MatchResult,
)


def application_context(
    db: Session, application_id: int, company_id: int
):
    latest_match = (
        select(func.max(MatchResult.match_result_id))
        .where(
            MatchResult.application_id == application_id,
            MatchResult.status == "Success",
        )
        .scalar_subquery()
    )
    return db.execute(
        select(Application, Candidate, Job, Company, MatchResult)
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .join(Company, Company.company_id == Job.company_id)
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match,
        )
        .where(
            Application.application_id == application_id,
            Job.company_id == company_id,
        )
    ).first()


def create_draft(
    db: Session,
    *,
    company_id: int,
    application_id: int,
    account_id: int,
    template_key: str,
    recipient_email: str,
    subject: str,
    body: str,
    thread_id: int | None = None,
    message_kind: str = "Initial",
    in_reply_to: str | None = None,
    references_json: list[str] | None = None,
) -> CandidateEmail:
    draft = CandidateEmail(
        company_id=company_id,
        application_id=application_id,
        thread_id=thread_id,
        template_key=template_key,
        message_kind=message_kind,
        recipient_email=recipient_email,
        subject=subject,
        body=body,
        status="Draft",
        ai_generated=True,
        in_reply_to=in_reply_to,
        references_json=references_json,
        created_by_account_id=account_id,
    )
    db.add(draft)
    if thread_id is not None:
        thread = db.get(CandidateEmailThread, thread_id)
        if thread is not None:
            thread.subject = thread.subject or subject
            thread.last_message_at = func.now()
    db.commit()
    db.refresh(draft)
    return draft


def get_owned(
    db: Session, email_id: int, company_id: int
) -> CandidateEmail | None:
    return db.scalar(
        select(CandidateEmail).where(
            CandidateEmail.email_id == email_id,
            CandidateEmail.company_id == company_id,
        )
    )


def rows(db: Session, company_id: int, job_id: int | None = None):
    statement = (
        select(CandidateEmail, Candidate, Job, CandidateEmailThread)
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .outerjoin(
            CandidateEmailThread,
            CandidateEmailThread.thread_id == CandidateEmail.thread_id,
        )
        .where(CandidateEmail.company_id == company_id)
        .order_by(CandidateEmail.created_at.desc(), CandidateEmail.email_id.desc())
    )
    if job_id is not None:
        statement = statement.where(Job.job_id == job_id)
    return db.execute(statement).all()


def row(db: Session, email_id: int, company_id: int):
    return db.execute(
        select(CandidateEmail, Candidate, Job, CandidateEmailThread)
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .outerjoin(
            CandidateEmailThread,
            CandidateEmailThread.thread_id == CandidateEmail.thread_id,
        )
        .where(
            CandidateEmail.email_id == email_id,
            CandidateEmail.company_id == company_id,
        )
    ).first()


def save(db: Session, draft: CandidateEmail, values: dict) -> CandidateEmail:
    for field, value in values.items():
        setattr(draft, field, value)
    if draft.thread_id is not None and values.get("status") == "Sent":
        thread = db.get(CandidateEmailThread, draft.thread_id)
        if thread is not None:
            thread.last_message_at = func.now()
    db.commit()
    db.refresh(draft)
    return draft


def ensure_thread(
    db: Session,
    *,
    company_id: int,
    application_id: int,
    subject: str | None = None,
) -> CandidateEmailThread:
    thread = db.scalar(
        select(CandidateEmailThread).where(
            CandidateEmailThread.company_id == company_id,
            CandidateEmailThread.application_id == application_id,
        )
    )
    if thread is not None:
        if subject and not thread.subject:
            thread.subject = subject
            db.commit()
            db.refresh(thread)
        return thread

    thread = CandidateEmailThread(
        company_id=company_id,
        application_id=application_id,
        reply_token=str(uuid4()),
        subject=subject,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def thread_contexts(db: Session, company_id: int):
    return db.execute(
        select(CandidateEmailThread, Application, Candidate, Job)
        .join(
            Application,
            Application.application_id == CandidateEmailThread.application_id,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .where(CandidateEmailThread.company_id == company_id)
        .order_by(
            CandidateEmailThread.last_message_at.desc(),
            CandidateEmailThread.thread_id.desc(),
        )
    ).all()


def thread_context(
    db: Session, thread_id: int, company_id: int
):
    return db.execute(
        select(CandidateEmailThread, Application, Candidate, Job)
        .join(
            Application,
            Application.application_id == CandidateEmailThread.application_id,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .where(
            CandidateEmailThread.thread_id == thread_id,
            CandidateEmailThread.company_id == company_id,
        )
    ).first()


def thread_by_reply_token(
    db: Session, reply_token: str
) -> CandidateEmailThread | None:
    return db.scalar(
        select(CandidateEmailThread).where(
            CandidateEmailThread.reply_token == reply_token
        )
    )


def inbound_by_provider_email(
    db: Session, provider_email_id: str
) -> CandidateEmailInbound | None:
    return db.scalar(
        select(CandidateEmailInbound).where(
            CandidateEmailInbound.provider_email_id == provider_email_id
        )
    )


def create_inbound(
    db: Session,
    *,
    thread: CandidateEmailThread,
    provider_email_id: str,
    provider_message_id: str | None,
    sender_email: str,
    recipient_email: str,
    subject: str,
    body_text: str,
    in_reply_to: str | None,
    references_text: str | None,
    attachments_json: list[dict] | None,
    received_at: datetime,
) -> CandidateEmailInbound:
    inbound = CandidateEmailInbound(
        thread_id=thread.thread_id,
        provider_email_id=provider_email_id,
        provider_message_id=provider_message_id,
        sender_email=sender_email,
        recipient_email=recipient_email,
        subject=subject,
        body_text=body_text,
        in_reply_to=in_reply_to,
        references_text=references_text,
        attachments_json=attachments_json,
        received_at=received_at,
    )
    db.add(inbound)
    thread.subject = thread.subject or subject
    thread.last_message_at = received_at
    thread.last_inbound_at = received_at
    db.commit()
    db.refresh(inbound)
    return inbound


def inbound_messages(
    db: Session, thread_id: int
) -> list[CandidateEmailInbound]:
    return list(
        db.scalars(
            select(CandidateEmailInbound)
            .where(CandidateEmailInbound.thread_id == thread_id)
            .order_by(
                CandidateEmailInbound.received_at.asc(),
                CandidateEmailInbound.inbound_id.asc(),
            )
        )
    )


def outbound_messages(
    db: Session, thread_id: int
) -> list[CandidateEmail]:
    return list(
        db.scalars(
            select(CandidateEmail)
            .where(CandidateEmail.thread_id == thread_id)
            .order_by(
                CandidateEmail.created_at.asc(),
                CandidateEmail.email_id.asc(),
            )
        )
    )


def unread_count(db: Session, thread_id: int) -> int:
    return int(
        db.scalar(
            select(func.count(CandidateEmailInbound.inbound_id)).where(
                CandidateEmailInbound.thread_id == thread_id,
                CandidateEmailInbound.is_read.is_(False),
            )
        )
        or 0
    )


def mark_thread_read(db: Session, thread_id: int) -> int:
    messages = list(
        db.scalars(
            select(CandidateEmailInbound).where(
                CandidateEmailInbound.thread_id == thread_id,
                CandidateEmailInbound.is_read.is_(False),
            )
        )
    )
    for message in messages:
        message.is_read = True
    db.commit()
    return 0


def pending_reply(
    db: Session, thread_id: int
) -> CandidateEmail | None:
    return db.scalar(
        select(CandidateEmail)
        .where(
            CandidateEmail.thread_id == thread_id,
            CandidateEmail.message_kind == "Reply",
            CandidateEmail.status.in_(("Draft", "Approved", "Failed")),
        )
        .order_by(CandidateEmail.created_at.desc(), CandidateEmail.email_id.desc())
    )


def candidate_email_by_provider_id(
    db: Session, provider_email_id: str
) -> CandidateEmail | None:
    return db.scalar(
        select(CandidateEmail).where(
            CandidateEmail.provider_message_id == provider_email_id
        )
    )


def event_by_provider_id(
    db: Session, provider_event_id: str
) -> CandidateEmailEvent | None:
    return db.scalar(
        select(CandidateEmailEvent).where(
            CandidateEmailEvent.provider_event_id == provider_event_id
        )
    )


def record_event(
    db: Session,
    *,
    provider_event_id: str,
    provider_email_id: str | None,
    event_type: str,
    occurred_at: datetime,
    event_data_json: dict | None,
    candidate_email: CandidateEmail | None,
    delivery_status: str | None = None,
) -> CandidateEmailEvent:
    latest_event_at = None
    if candidate_email is not None and delivery_status is not None:
        latest_event_at = db.scalar(
            select(func.max(CandidateEmailEvent.occurred_at)).where(
                CandidateEmailEvent.candidate_email_id == candidate_email.email_id
            )
        )
    event = CandidateEmailEvent(
        candidate_email_id=(
            candidate_email.email_id if candidate_email is not None else None
        ),
        provider_event_id=provider_event_id,
        provider_email_id=provider_email_id,
        event_type=event_type,
        occurred_at=occurred_at,
        event_data_json=event_data_json,
    )
    db.add(event)
    if (
        candidate_email is not None
        and delivery_status is not None
        and (latest_event_at is None or occurred_at >= latest_event_at)
    ):
        candidate_email.delivery_status = delivery_status
    db.commit()
    db.refresh(event)
    return event
