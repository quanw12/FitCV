from datetime import datetime, timezone
from decimal import Decimal
import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Job
from app.models.account import Account
from app.repositories import jobs
from app.schemas.jobs import CompanyPublic, JobCreate, JobResponse, JobUpdate

PUBLISH_FIELDS = (
    "title", "about_job", "responsibilities", "requirements", "we_offer",
    "life_at_company", "hiring_process", "location", "employment_type",
)
DESCRIPTION_MARKER = "FITCV_JOB_DESCRIPTION::v1::"
DESCRIPTION_FIELDS = (
    "description", "about_job", "responsibilities", "we_offer",
    "life_at_company", "hiring_process",
)
VIRTUAL_FIELDS = (*DESCRIPTION_FIELDS, "openings_count")
DEFAULT_OPENINGS_COUNT = 1
WEIGHT_FIELDS = (
    "skill_weight",
    "experience_weight",
    "education_weight",
    "soft_skill_weight",
)
DEFAULT_WEIGHTS = {
    "skill_weight": Decimal("45.00"),
    "experience_weight": Decimal("30.00"),
    "education_weight": Decimal("15.00"),
    "soft_skill_weight": Decimal("10.00"),
}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _clean(values: dict) -> dict:
    return {
        key: value.strip() if isinstance(value, str) else _utc_naive(value) if isinstance(value, datetime) else value
        for key, value in values.items()
    }


def _validate_weight_total(values: dict, job: Job | None = None) -> None:
    provided = [name for name in WEIGHT_FIELDS if name in values]
    if not provided and job is not None:
        return
    if any(values[name] is None for name in provided):
        raise HTTPException(
            status_code=422,
            detail="Scoring weights cannot be null.",
        )

    effective = {
        name: (
            Decimal(str(getattr(job, name)))
            if job is not None
            else default
        )
        for name, default in DEFAULT_WEIGHTS.items()
    }
    effective.update({
        name: Decimal(str(values[name]))
        for name in provided
    })
    if sum(effective.values(), Decimal("0")) != Decimal("100"):
        raise HTTPException(
            status_code=422,
            detail="Scoring weights must total 100.",
        )


def _require_not_archived(job: Job, action: str) -> None:
    if job.archived_at is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Unarchive the job before {action}.",
        )


def _legacy_description(raw: str | None) -> dict:
    return {
        "description": raw,
        "about_job": raw,
        "responsibilities": None,
        "we_offer": None,
        "life_at_company": None,
        "hiring_process": None,
        "openings_count": DEFAULT_OPENINGS_COUNT,
    }


def _decode_description(raw: str | None) -> dict:
    if not raw or not raw.startswith(DESCRIPTION_MARKER):
        return _legacy_description(raw)

    try:
        payload = json.loads(raw[len(DESCRIPTION_MARKER):])
    except (json.JSONDecodeError, TypeError):
        return _legacy_description(raw)
    if not isinstance(payload, dict):
        return _legacy_description(raw)

    decoded = {
        name: value if isinstance((value := payload.get(name)), str) or value is None else None
        for name in DESCRIPTION_FIELDS
    }
    openings_count = payload.get("openings_count", DEFAULT_OPENINGS_COUNT)
    decoded["openings_count"] = (
        openings_count
        if isinstance(openings_count, int) and not isinstance(openings_count, bool) and openings_count >= 1
        else DEFAULT_OPENINGS_COUNT
    )
    return decoded


def _encode_description(values: dict) -> str:
    payload = {
        name: values.get(name)
        for name in DESCRIPTION_FIELDS
    }
    payload["openings_count"] = values.get("openings_count", DEFAULT_OPENINGS_COUNT)
    return DESCRIPTION_MARKER + json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _response(row) -> JobResponse:
    job, company, count = row
    virtual = _decode_description(job.description)
    return JobResponse(
        job_id=job.job_id,
        title=job.title,
        requirements=job.requirements,
        location=job.location,
        employment_type=job.employment_type,
        status=job.status,
        deadline=job.deadline,
        archived_at=job.archived_at,
        skill_weight=float(job.skill_weight),
        experience_weight=float(job.experience_weight),
        education_weight=float(job.education_weight),
        soft_skill_weight=float(job.soft_skill_weight),
        created_at=job.created_at,
        updated_at=job.updated_at,
        **virtual,
        application_count=count,
        company=CompanyPublic(name=company.company_name, logo_url=company.logo_url, website_url=company.website_url),
    )


def list_public(db: Session) -> list[JobResponse]:
    return [_response(row) for row in jobs.public_jobs(db, _now())]


def get_public(db: Session, job_id: int) -> JobResponse:
    row = jobs.public_job(db, job_id, _now())
    if row is None:
        raise HTTPException(status_code=404, detail="Published job not found.")
    return _response(row)


def _company(account: Account) -> int:
    if account.company_id is None:
        raise HTTPException(status_code=400, detail="A company must be assigned to manage jobs.")
    return account.company_id


def list_managed(
    db: Session,
    account: Account,
    archived: bool | None = False,
) -> list[JobResponse]:
    return [
        _response(row)
        for row in jobs.managed_jobs(db, _company(account), archived)
    ]


def _managed_response(
    db: Session,
    account: Account,
    job_id: int,
) -> JobResponse:
    return next(
        item
        for item in list_managed(db, account, archived=None)
        if item.job_id == job_id
    )


def create(db: Session, account: Account, payload: JobCreate) -> JobResponse:
    company_id = _company(account)
    values = _clean(payload.model_dump(exclude_none=True))
    if not values.get("title"):
        raise HTTPException(status_code=422, detail="Title cannot be empty.")
    _validate_weight_total(values)
    virtual = {
        name: values.pop(name, DEFAULT_OPENINGS_COUNT if name == "openings_count" else None)
        for name in VIRTUAL_FIELDS
    }
    values["description"] = _encode_description(virtual)
    job = jobs.create_job(db, company_id=company_id, account_id=account.account_id, values=values)
    return _managed_response(db, account, job.job_id)


def update(db: Session, account: Account, job_id: int, payload: JobUpdate) -> JobResponse:
    job = _managed(db, account, job_id)
    _require_not_archived(job, "editing it")
    if job.status == "Published":
        raise HTTPException(status_code=409, detail="Close the job before editing it.")
    values = _clean(payload.model_dump(exclude_unset=True))
    if "title" in values and not values["title"]:
        raise HTTPException(status_code=422, detail="Title cannot be empty.")
    _validate_weight_total(values, job)
    virtual_updates = {name: values.pop(name) for name in VIRTUAL_FIELDS if name in values}
    if virtual_updates:
        virtual = _decode_description(job.description)
        virtual.update(virtual_updates)
        values["description"] = _encode_description(virtual)
    jobs.update_job(db, job, values)
    return _managed_response(db, account, job_id)


def publish(db: Session, account: Account, job_id: int) -> JobResponse:
    job = _managed(db, account, job_id)
    _require_not_archived(job, "publishing it")
    if job.status == "Published":
        raise HTTPException(status_code=409, detail="Job is already published.")
    virtual = _decode_description(job.description)
    publish_values = {
        **virtual,
        **{name: getattr(job, name, None) for name in PUBLISH_FIELDS if name not in virtual},
    }
    missing = [name for name in PUBLISH_FIELDS if not str(publish_values.get(name) or "").strip()]
    if job.deadline is None or _utc_naive(job.deadline) <= _now():
        missing.append("future deadline")
    if virtual["openings_count"] < 1:
        missing.append("openings_count")
    if missing:
        raise HTTPException(status_code=422, detail=f"Cannot publish; missing or invalid: {', '.join(missing)}.")
    jobs.update_job(db, job, {"status": "Published"})
    return _managed_response(db, account, job_id)


def close(db: Session, account: Account, job_id: int) -> JobResponse:
    job = _managed(db, account, job_id)
    _require_not_archived(job, "closing it")
    if job.status != "Published":
        raise HTTPException(status_code=409, detail="Only a published job can be closed.")
    jobs.update_job(db, job, {"status": "Closed"})
    return _managed_response(db, account, job_id)


def archive(
    db: Session,
    account: Account,
    job_id: int,
) -> JobResponse:
    job = _managed(db, account, job_id)
    if job.archived_at is not None:
        raise HTTPException(status_code=409, detail="Job is already archived.")
    jobs.update_job(db, job, {"archived_at": _now()})
    return _managed_response(db, account, job_id)


def unarchive(
    db: Session,
    account: Account,
    job_id: int,
) -> JobResponse:
    job = _managed(db, account, job_id)
    if job.archived_at is None:
        raise HTTPException(status_code=409, detail="Job is not archived.")
    jobs.update_job(db, job, {"archived_at": None})
    return _managed_response(db, account, job_id)


def _managed(db: Session, account: Account, job_id: int) -> Job:
    job = jobs.managed_job(db, job_id, _company(account))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found for this company.")
    return job
