from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import and_, case, func, insert, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.datetime_utils import utc_now_naive
from app.models import (
    Application,
    Candidate,
    CandidateEmail,
    CandidateEmailCampaign,
    CandidateEmailEvent,
    CandidateEmailInbound,
    CandidateEmailThread,
    Company,
    Job,
    MatchResult,
)


def _latest_successful_match_ids():
    return (
        select(
            MatchResult.application_id.label("application_id"),
            func.max(MatchResult.match_result_id).label("match_result_id"),
        )
        .where(
            MatchResult.application_id.is_not(None),
            MatchResult.status == "Success",
        )
        .group_by(MatchResult.application_id)
        .subquery()
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


def audience_rows(
    db: Session,
    company_id: int,
    *,
    stage: str,
    template_key: str,
    job_id: int | None = None,
):
    """Return a stage audience with latest match and last sent email in one query."""
    latest_match = _latest_successful_match_ids()
    latest_sent = (
        select(
            CandidateEmail.application_id.label("application_id"),
            func.max(CandidateEmail.email_id).label("email_id"),
        )
        .where(
            CandidateEmail.company_id == company_id,
            CandidateEmail.status == "Sent",
            CandidateEmail.template_key == template_key,
            or_(
                CandidateEmail.stage_at_generation.is_(None),
                CandidateEmail.stage_at_generation == stage,
            ),
        )
        .group_by(CandidateEmail.application_id)
        .subquery()
    )
    last_sent_email = aliased(CandidateEmail)
    statement = (
        select(Application, Candidate, Job, MatchResult, last_sent_email)
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .outerjoin(
            latest_match,
            latest_match.c.application_id == Application.application_id,
        )
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match.c.match_result_id,
        )
        .outerjoin(
            latest_sent,
            latest_sent.c.application_id == Application.application_id,
        )
        .outerjoin(
            last_sent_email,
            last_sent_email.email_id == latest_sent.c.email_id,
        )
        .where(
            Job.company_id == company_id,
            Application.current_stage == stage,
            Application.status != "Withdrawn",
        )
        .order_by(Application.applied_at.desc(), Application.application_id.desc())
    )
    if job_id is not None:
        statement = statement.where(Job.job_id == job_id)
    return db.execute(statement).all()


def applications_for_campaign(
    db: Session,
    application_ids: list[int],
    company_id: int,
):
    """Load all campaign recipient contexts with a constant query count."""
    ids = list(dict.fromkeys(application_ids))
    if not ids:
        return []
    latest_match = _latest_successful_match_ids()
    return db.execute(
        select(Application, Candidate, Job, Company, MatchResult)
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .join(Company, Company.company_id == Job.company_id)
        .outerjoin(
            latest_match,
            latest_match.c.application_id == Application.application_id,
        )
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match.c.match_result_id,
        )
        .where(
            Application.application_id.in_(ids),
            Job.company_id == company_id,
        )
        .order_by(Application.application_id.asc())
    ).all()


def create_campaign(
    db: Session,
    *,
    company_id: int,
    job_id: int | None,
    account_id: int | None,
    template_key: str,
    target_stage: str,
    recipient_count: int,
    interview_date: date | None,
    template_json: dict,
    ai_generated: bool,
    commit: bool = True,
) -> CandidateEmailCampaign:
    campaign = CandidateEmailCampaign(
        company_id=company_id,
        job_id=job_id,
        created_by_account_id=account_id,
        template_key=template_key,
        target_stage=target_stage,
        recipient_count=recipient_count,
        interview_date=interview_date,
        template_json=template_json,
        ai_generated=ai_generated,
    )
    db.add(campaign)
    if commit:
        db.commit()
        db.refresh(campaign)
    else:
        # Allocate the id without releasing application row locks. The caller
        # then persists the campaign and every draft in one transaction.
        db.flush()
    return campaign


def create_drafts(
    db: Session,
    campaign_id: int,
    items: list[dict],
) -> list[CandidateEmail]:
    """Create every campaign draft atomically with one commit.

    Each item may provide ``account_id`` as the public repository convention;
    it is normalized to the model's ``created_by_account_id`` field.
    """
    if not items:
        return []
    campaign = db.get(CandidateEmailCampaign, campaign_id)
    if campaign is None:
        raise ValueError("Email campaign not found.")

    draft_values: list[dict] = []
    subjects_by_thread: dict[int, str] = {}
    try:
        application_ids = {
            int(item["application_id"])
            for item in items
            if item.get("application_id") is not None
        }
        owned_application_ids = set(
            db.scalars(
                select(Application.application_id)
                .join(Job, Job.job_id == Application.job_id)
                .where(
                    Application.application_id.in_(application_ids),
                    Job.company_id == campaign.company_id,
                )
            )
        )
        if application_ids != owned_application_ids:
            raise ValueError("One or more campaign applications are not company-owned.")

        for item in items:
            values = dict(item)
            account_id = values.pop("account_id", None)
            values.pop("campaign_id", None)
            values["company_id"] = campaign.company_id
            values["template_key"] = campaign.template_key
            values["ai_generated"] = campaign.ai_generated
            values.setdefault("message_kind", "Initial")
            values["status"] = "Draft"
            if "created_by_account_id" not in values:
                values["created_by_account_id"] = account_id
            values["campaign_id"] = campaign_id
            values.setdefault("thread_id", None)
            values.setdefault("stage_at_generation", None)
            values.setdefault("in_reply_to", None)
            values.setdefault("references_json", None)
            draft_values.append(values)
            if values["thread_id"] is not None:
                subjects_by_thread.setdefault(values["thread_id"], values["subject"])

        if subjects_by_thread:
            threads = list(
                db.scalars(
                    select(CandidateEmailThread).where(
                        CandidateEmailThread.thread_id.in_(subjects_by_thread),
                        CandidateEmailThread.company_id == campaign.company_id,
                    )
                )
            )
            thread_by_id = {thread.thread_id: thread for thread in threads}
            for values in draft_values:
                thread_id = values["thread_id"]
                if thread_id is None:
                    continue
                thread = thread_by_id.get(thread_id)
                if (
                    thread is None
                    or thread.application_id != values["application_id"]
                ):
                    raise ValueError(
                        "One or more campaign threads do not match their application."
                    )
            next_subject = case(
                subjects_by_thread,
                value=CandidateEmailThread.thread_id,
            )
            db.execute(
                update(CandidateEmailThread)
                .where(
                    CandidateEmailThread.thread_id.in_(subjects_by_thread),
                    CandidateEmailThread.company_id == campaign.company_id,
                )
                .values(
                    subject=case(
                        (
                            CandidateEmailThread.subject.is_(None),
                            next_subject,
                        ),
                        else_=CandidateEmailThread.subject,
                    ),
                    last_message_at=utc_now_naive(),
                )
            )
        db.execute(insert(CandidateEmail), draft_values)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return list(
        db.scalars(
            select(CandidateEmail)
            .where(CandidateEmail.campaign_id == campaign_id)
            .order_by(CandidateEmail.email_id.asc())
        )
    )


def ensure_threads(
    db: Session,
    *,
    company_id: int,
    application_ids: list[int],
) -> dict[int, CandidateEmailThread]:
    """Ensure one canonical thread per owned application without N+1 queries."""
    requested_ids = list(dict.fromkeys(application_ids))
    if not requested_ids:
        return {}
    owned_ids = list(
        db.scalars(
            select(Application.application_id)
            .join(Job, Job.job_id == Application.job_id)
            .where(
                Application.application_id.in_(requested_ids),
                Job.company_id == company_id,
            )
        )
    )
    if not owned_ids:
        return {}

    for attempt in range(2):
        threads = list(
            db.scalars(
                select(CandidateEmailThread).where(
                    CandidateEmailThread.company_id == company_id,
                    CandidateEmailThread.application_id.in_(owned_ids),
                )
            )
        )
        by_application = {thread.application_id: thread for thread in threads}
        missing_ids = [
            application_id
            for application_id in owned_ids
            if application_id not in by_application
        ]
        if not missing_ids:
            return by_application

        try:
            db.execute(
                insert(CandidateEmailThread),
                [
                    {
                        "company_id": company_id,
                        "application_id": application_id,
                        "reply_token": str(uuid4()),
                    }
                    for application_id in missing_ids
                ],
            )
            db.commit()
        except IntegrityError:
            # Another request may have created one of the unique
            # company/application rows. Roll back the batch and load the
            # canonical winners before retrying any still-missing rows.
            db.rollback()
            if attempt == 1:
                raise

    threads = list(
        db.scalars(
            select(CandidateEmailThread).where(
                CandidateEmailThread.company_id == company_id,
                CandidateEmailThread.application_id.in_(owned_ids),
            )
        )
    )
    return {thread.application_id: thread for thread in threads}


def lock_applications_for_email(
    db: Session,
    *,
    company_id: int,
    application_ids: list[int],
) -> list[tuple[int, str, str]]:
    """Serialize pending-draft rechecks for selected applications."""

    ids = sorted(set(application_ids))
    if not ids:
        return []
    return [
        (application_id, current_stage, status)
        for application_id, current_stage, status in db.execute(
            select(
                Application.application_id,
                Application.current_stage,
                Application.status,
            )
            .join(Job, Job.job_id == Application.job_id)
            .where(
                Application.application_id.in_(ids),
                Job.company_id == company_id,
            )
            .order_by(Application.application_id.asc())
            .with_for_update()
        ).all()
    ]


def pending_initial_drafts(
    db: Session,
    *,
    company_id: int,
    application_ids: list[int],
    template_key: str,
) -> dict[int, CandidateEmail]:
    ids = list(dict.fromkeys(application_ids))
    if not ids:
        return {}
    latest_pending = (
        select(
            CandidateEmail.application_id.label("application_id"),
            func.max(CandidateEmail.email_id).label("email_id"),
        )
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .where(
            CandidateEmail.company_id == company_id,
            CandidateEmail.application_id.in_(ids),
            CandidateEmail.template_key == template_key,
            CandidateEmail.message_kind == "Initial",
            CandidateEmail.status.in_(("Draft", "Approved", "Failed")),
            or_(
                CandidateEmail.stage_at_generation.is_(None),
                CandidateEmail.stage_at_generation == Application.current_stage,
            ),
        )
        .group_by(CandidateEmail.application_id)
        .subquery()
    )
    drafts = list(
        db.scalars(
            select(CandidateEmail).join(
                latest_pending,
                latest_pending.c.email_id == CandidateEmail.email_id,
            )
        )
    )
    return {draft.application_id: draft for draft in drafts}


def sent_email_summary(
    db: Session,
    company_id: int,
    application_ids: list[int],
    *,
    template_key: str,
    stage: str,
) -> dict[int, CandidateEmail]:
    ids = list(dict.fromkeys(application_ids))
    if not ids:
        return {}
    latest_sent = (
        select(
            CandidateEmail.application_id.label("application_id"),
            func.max(CandidateEmail.email_id).label("email_id"),
        )
        .where(
            CandidateEmail.company_id == company_id,
            CandidateEmail.application_id.in_(ids),
            CandidateEmail.status == "Sent",
            CandidateEmail.template_key == template_key,
            or_(
                CandidateEmail.stage_at_generation.is_(None),
                CandidateEmail.stage_at_generation == stage,
            ),
        )
        .group_by(CandidateEmail.application_id)
        .subquery()
    )
    messages = list(
        db.scalars(
            select(CandidateEmail).join(
                latest_sent,
                latest_sent.c.email_id == CandidateEmail.email_id,
            )
        )
    )
    return {message.application_id: message for message in messages}


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
    campaign_id: int | None = None,
    message_kind: str = "Initial",
    stage_at_generation: str | None = None,
    ai_generated: bool = True,
    in_reply_to: str | None = None,
    references_json: list[str] | None = None,
) -> CandidateEmail:
    draft = CandidateEmail(
        company_id=company_id,
        application_id=application_id,
        thread_id=thread_id,
        campaign_id=campaign_id,
        template_key=template_key,
        message_kind=message_kind,
        stage_at_generation=stage_at_generation,
        recipient_email=recipient_email,
        subject=subject,
        body=body,
        status="Draft",
        ai_generated=ai_generated,
        in_reply_to=in_reply_to,
        references_json=references_json,
        created_by_account_id=account_id,
    )
    db.add(draft)
    if thread_id is not None:
        thread = db.get(CandidateEmailThread, thread_id)
        if thread is not None:
            thread.subject = thread.subject or subject
            thread.last_message_at = utc_now_naive()
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


def pending_initial_draft(
    db: Session,
    *,
    company_id: int,
    application_id: int,
    template_key: str,
) -> CandidateEmail | None:
    """Return the latest unsent initial draft for an application/template.

    Generating twice from a double-click should not create two independent
    messages that HR might accidentally approve and send.
    """
    return db.scalar(
        select(CandidateEmail)
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .where(
            CandidateEmail.company_id == company_id,
            CandidateEmail.application_id == application_id,
            CandidateEmail.template_key == template_key,
            CandidateEmail.message_kind == "Initial",
            CandidateEmail.status.in_(("Draft", "Approved", "Failed")),
            or_(
                CandidateEmail.stage_at_generation.is_(None),
                CandidateEmail.stage_at_generation == Application.current_stage,
            ),
        )
        .order_by(CandidateEmail.created_at.desc(), CandidateEmail.email_id.desc())
    )


def rows(db: Session, company_id: int, job_id: int | None = None):
    statement = (
        select(CandidateEmail, Application, Candidate, Job, CandidateEmailThread)
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
            CandidateEmail.company_id == company_id,
            Job.company_id == company_id,
        )
        .order_by(CandidateEmail.created_at.desc(), CandidateEmail.email_id.desc())
    )
    if job_id is not None:
        statement = statement.where(Job.job_id == job_id)
    return db.execute(statement).all()


def row(db: Session, email_id: int, company_id: int):
    return db.execute(
        select(CandidateEmail, Application, Candidate, Job, CandidateEmailThread)
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
            Job.company_id == company_id,
        )
    ).first()


def save(db: Session, draft: CandidateEmail, values: dict) -> CandidateEmail:
    for field, value in values.items():
        setattr(draft, field, value)
    if draft.thread_id is not None and values.get("status") == "Sent":
        thread = db.get(CandidateEmailThread, draft.thread_id)
        if thread is not None:
            thread.last_message_at = values.get("sent_at") or utc_now_naive()
    db.commit()
    db.refresh(draft)
    return draft


def compare_and_set_status(
    db: Session,
    *,
    email_id: int,
    company_id: int,
    expected_status: str,
    values: dict,
    require_not_queued: bool = False,
) -> bool:
    """Apply an HR review transition only if its source state is unchanged."""

    conditions = [
        CandidateEmail.email_id == email_id,
        CandidateEmail.company_id == company_id,
        CandidateEmail.status == expected_status,
    ]
    if require_not_queued:
        conditions.append(
            or_(
                CandidateEmail.delivery_status.is_(None),
                CandidateEmail.delivery_status != "Queued",
            )
        )
    result = db.execute(
        update(CandidateEmail).where(*conditions).values(**values)
    )
    db.commit()
    return result.rowcount == 1


def claim_send(
    db: Session,
    *,
    email_id: int,
    company_id: int,
    idempotency_key: str,
    attempt_at: datetime,
    stale_before: datetime,
    retry_count: int,
    stage_at_generation: str | None = None,
    block_withdrawn: bool = False,
) -> bool:
    """Atomically claim a provider attempt for this draft.

    A double-click or two browser tabs can otherwise both pass the approval
    check before either one calls Resend. ``Queued`` is a short-lived lease;
    a crashed worker can be reclaimed after ``stale_before``.
    """
    claim_conditions = [
        CandidateEmail.email_id == email_id,
        CandidateEmail.company_id == company_id,
        or_(
            and_(
                CandidateEmail.status == "Approved",
                CandidateEmail.approved_at.is_not(None),
            ),
            and_(
                CandidateEmail.status == "Failed",
                CandidateEmail.approved_at.is_not(None),
                CandidateEmail.retryable.is_(True),
            ),
        ),
        or_(
            CandidateEmail.delivery_status.is_(None),
            CandidateEmail.delivery_status != "Queued",
            and_(
                CandidateEmail.delivery_status == "Queued",
                or_(
                    CandidateEmail.last_attempt_at.is_(None),
                    CandidateEmail.last_attempt_at <= stale_before,
                ),
            ),
        ),
    ]
    if stage_at_generation is not None or block_withdrawn:
        valid_application = (
            select(Application.application_id)
            .join(Job, Job.job_id == Application.job_id)
            .where(
                Application.application_id == CandidateEmail.application_id,
                Job.company_id == company_id,
            )
        )
        if stage_at_generation is not None:
            valid_application = valid_application.where(
                Application.current_stage == stage_at_generation
            )
        if block_withdrawn:
            valid_application = valid_application.where(
                Application.status != "Withdrawn"
            )
        claim_conditions.append(
            CandidateEmail.application_id.in_(valid_application)
        )

    result = db.execute(
        update(CandidateEmail)
        .where(*claim_conditions)
        .values(
            idempotency_key=idempotency_key,
            delivery_status="Queued",
            last_attempt_at=attempt_at,
            retry_count=retry_count,
            error_message=None,
        )
    )
    db.commit()
    return result.rowcount == 1


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
    try:
        db.commit()
    except IntegrityError:
        # Two generate/reply requests can race on the company/application
        # unique key. The winner is the canonical thread; reuse it instead of
        # leaking a 500 to the recruiter.
        db.rollback()
        thread = db.scalar(
            select(CandidateEmailThread).where(
                CandidateEmailThread.company_id == company_id,
                CandidateEmailThread.application_id == application_id,
            )
        )
        if thread is None:
            raise
    db.refresh(thread)
    return thread


def _thread_context_statement(company_id: int):
    latest_match = _latest_successful_match_ids()
    return (
        select(
            CandidateEmailThread,
            Application,
            Candidate,
            Job,
            Company,
            MatchResult,
        )
        .join(
            Application,
            Application.application_id == CandidateEmailThread.application_id,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .join(Company, Company.company_id == Job.company_id)
        .outerjoin(
            latest_match,
            latest_match.c.application_id == Application.application_id,
        )
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match.c.match_result_id,
        )
        .where(
            CandidateEmailThread.company_id == company_id,
            Job.company_id == company_id,
        )
    )


def employer_name(db: Session, company_id: int) -> str | None:
    return db.scalar(
        select(Company.company_name).where(Company.company_id == company_id)
    )


def thread_contexts(db: Session, company_id: int):
    return db.execute(
        _thread_context_statement(company_id)
        .order_by(
            CandidateEmailThread.last_message_at.desc(),
            CandidateEmailThread.thread_id.desc(),
        )
    ).all()


def thread_contexts_by_ids(
    db: Session,
    thread_ids: list[int],
    company_id: int,
):
    ids = list(dict.fromkeys(thread_ids))
    if not ids:
        return []
    return db.execute(
        _thread_context_statement(company_id)
        .where(CandidateEmailThread.thread_id.in_(ids))
        .order_by(CandidateEmailThread.thread_id.asc())
    ).all()


def thread_context(
    db: Session, thread_id: int, company_id: int
):
    return db.execute(
        _thread_context_statement(company_id)
        .where(
            CandidateEmailThread.thread_id == thread_id,
        )
    ).first()


def rows_by_email_ids(
    db: Session,
    email_ids: list[int],
    company_id: int,
):
    ids = list(dict.fromkeys(email_ids))
    if not ids:
        return []
    return db.execute(
        select(CandidateEmail, Application, Candidate, Job, CandidateEmailThread)
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
            CandidateEmail.email_id.in_(ids),
            CandidateEmail.company_id == company_id,
            Job.company_id == company_id,
        )
        .order_by(CandidateEmail.email_id.asc())
    ).all()


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


def inbound_messages_for_threads(
    db: Session,
    thread_ids: list[int],
) -> dict[int, list[CandidateEmailInbound]]:
    ids = list(dict.fromkeys(thread_ids))
    grouped: dict[int, list[CandidateEmailInbound]] = {thread_id: [] for thread_id in ids}
    if not ids:
        return grouped
    messages = db.scalars(
        select(CandidateEmailInbound)
        .where(CandidateEmailInbound.thread_id.in_(ids))
        .order_by(
            CandidateEmailInbound.thread_id.asc(),
            CandidateEmailInbound.received_at.asc(),
            CandidateEmailInbound.inbound_id.asc(),
        )
    )
    for message in messages:
        grouped[message.thread_id].append(message)
    return grouped


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


def outbound_messages_for_threads(
    db: Session,
    thread_ids: list[int],
) -> dict[int, list[CandidateEmail]]:
    ids = list(dict.fromkeys(thread_ids))
    grouped: dict[int, list[CandidateEmail]] = {thread_id: [] for thread_id in ids}
    if not ids:
        return grouped
    messages = db.scalars(
        select(CandidateEmail)
        .where(CandidateEmail.thread_id.in_(ids))
        .order_by(
            CandidateEmail.thread_id.asc(),
            CandidateEmail.created_at.asc(),
            CandidateEmail.email_id.asc(),
        )
    )
    for message in messages:
        if message.thread_id is not None:
            grouped[message.thread_id].append(message)
    return grouped


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
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .where(
            CandidateEmail.thread_id == thread_id,
            CandidateEmail.message_kind == "Reply",
            CandidateEmail.status.in_(("Draft", "Approved", "Failed")),
            or_(
                CandidateEmail.stage_at_generation.is_(None),
                CandidateEmail.stage_at_generation == Application.current_stage,
            ),
        )
        .order_by(CandidateEmail.created_at.desc(), CandidateEmail.email_id.desc())
    )


def unread_counts(db: Session, thread_ids: list[int]) -> dict[int, int]:
    ids = list(dict.fromkeys(thread_ids))
    counts = {thread_id: 0 for thread_id in ids}
    if not ids:
        return counts
    rows = db.execute(
        select(
            CandidateEmailInbound.thread_id,
            func.count(CandidateEmailInbound.inbound_id),
        )
        .where(
            CandidateEmailInbound.thread_id.in_(ids),
            CandidateEmailInbound.is_read.is_(False),
        )
        .group_by(CandidateEmailInbound.thread_id)
    ).all()
    counts.update({thread_id: int(count) for thread_id, count in rows})
    return counts


def pending_replies(
    db: Session,
    thread_ids: list[int],
) -> dict[int, CandidateEmail]:
    ids = list(dict.fromkeys(thread_ids))
    if not ids:
        return {}
    latest_pending = (
        select(
            CandidateEmail.thread_id.label("thread_id"),
            func.max(CandidateEmail.email_id).label("email_id"),
        )
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .where(
            CandidateEmail.thread_id.in_(ids),
            CandidateEmail.message_kind == "Reply",
            CandidateEmail.status.in_(("Draft", "Approved", "Failed")),
            or_(
                CandidateEmail.stage_at_generation.is_(None),
                CandidateEmail.stage_at_generation == Application.current_stage,
            ),
        )
        .group_by(CandidateEmail.thread_id)
        .subquery()
    )
    messages = db.scalars(
        select(CandidateEmail).join(
            latest_pending,
            latest_pending.c.email_id == CandidateEmail.email_id,
        )
    )
    return {
        message.thread_id: message
        for message in messages
        if message.thread_id is not None
    }


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
        # Serialize delivery-state transitions per email so an older webhook
        # cannot overwrite a newer status when Resend retries concurrently.
        locked_email = db.scalar(
            select(CandidateEmail)
            .where(CandidateEmail.email_id == candidate_email.email_id)
            .with_for_update()
        )
        if locked_email is not None:
            candidate_email = locked_email
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
