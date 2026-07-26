from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Application,
    Candidate,
    CandidateEmail,
    Company,
    Job,
    MatchResult,
)


def application_context(
    db: Session, application_id: int, company_id: int
):
    latest_match = (
        select(func.max(MatchResult.match_result_id))
        .where(MatchResult.application_id == application_id)
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
) -> CandidateEmail:
    draft = CandidateEmail(
        company_id=company_id,
        application_id=application_id,
        template_key=template_key,
        recipient_email=recipient_email,
        subject=subject,
        body=body,
        status="Draft",
        ai_generated=True,
        created_by_account_id=account_id,
    )
    db.add(draft)
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
        select(CandidateEmail, Candidate, Job)
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .where(CandidateEmail.company_id == company_id)
        .order_by(CandidateEmail.created_at.desc(), CandidateEmail.email_id.desc())
    )
    if job_id is not None:
        statement = statement.where(Job.job_id == job_id)
    return db.execute(statement).all()


def row(db: Session, email_id: int, company_id: int):
    return db.execute(
        select(CandidateEmail, Candidate, Job)
        .join(
            Application,
            Application.application_id == CandidateEmail.application_id,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .where(
            CandidateEmail.email_id == email_id,
            CandidateEmail.company_id == company_id,
        )
    ).first()


def save(db: Session, draft: CandidateEmail, values: dict) -> CandidateEmail:
    for field, value in values.items():
        setattr(draft, field, value)
    db.commit()
    db.refresh(draft)
    return draft
