from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Application, Company, Job, JobHr

WRITABLE_JOB_COLUMNS = {
    "title", "description", "requirements", "location", "employment_type",
    "deadline", "status", "archived_at", "skill_weight", "experience_weight",
    "education_weight", "soft_skill_weight",
}


def _real_job_values(values: dict) -> dict:
    return {key: value for key, value in values.items() if key in WRITABLE_JOB_COLUMNS}


def _job_rows(statement, db: Session):
    return db.execute(
        statement.outerjoin(Application, Application.job_id == Job.job_id)
        .join(Company, Company.company_id == Job.company_id)
        .group_by(Job.job_id, Company.company_id)
    ).all()


def public_jobs(db: Session, now: datetime):
    return _job_rows(
        select(Job, Company, func.count(Application.application_id))
        .where(
            Job.status == "Published",
            Job.archived_at.is_(None),
            or_(Job.deadline.is_(None), Job.deadline > now),
        )
        .order_by(Job.created_at.desc()),
        db,
    )


def public_job(db: Session, job_id: int, now: datetime):
    rows = _job_rows(
        select(Job, Company, func.count(Application.application_id)).where(
            Job.job_id == job_id,
            Job.status == "Published",
            Job.archived_at.is_(None),
            or_(Job.deadline.is_(None), Job.deadline > now),
        ),
        db,
    )
    return rows[0] if rows else None


def managed_jobs(
    db: Session,
    company_id: int,
    archived: bool | None = False,
):
    statement = select(
        Job,
        Company,
        func.count(Application.application_id),
    ).where(Job.company_id == company_id)
    if archived is not None:
        statement = statement.where(
            Job.archived_at.is_not(None)
            if archived
            else Job.archived_at.is_(None)
        )
    return _job_rows(statement.order_by(Job.created_at.desc()), db)


def managed_job(db: Session, job_id: int, company_id: int) -> Job | None:
    return db.scalar(select(Job).where(Job.job_id == job_id, Job.company_id == company_id))


def create_job(db: Session, *, company_id: int, account_id: int, values: dict) -> Job:
    job = Job(
        company_id=company_id,
        created_by_account_id=account_id,
        status="Draft",
        **_real_job_values(values),
    )
    db.add(job)
    db.flush()
    db.add(JobHr(job_id=job.job_id, hr_account_id=account_id, role_type="Creator"))
    db.commit()
    db.refresh(job)
    return job


def update_job(db: Session, job: Job, values: dict) -> Job:
    for key, value in _real_job_values(values).items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job
