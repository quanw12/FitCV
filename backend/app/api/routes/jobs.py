from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.applications import ApplicationCreatedResponse
from app.schemas.jobs import (
    JobCreate,
    JobExtractionRequest,
    JobExtractionResponse,
    JobResponse,
    JobUpdate,
)
from app.services import application_service, job_extraction_service, jobs_service

router = APIRouter()
student = require_role(AccountRole.student)
manager = require_role(AccountRole.hr, AccountRole.hiring_manager, AccountRole.admin)


@router.get("/public", response_model=list[JobResponse])
def list_public(db: Session = Depends(get_db)):
    return jobs_service.list_public(db)


@router.get("/public/{job_id}", response_model=JobResponse)
def get_public(job_id: int, db: Session = Depends(get_db)):
    return jobs_service.get_public(db, job_id)


@router.post("/extract", response_model=JobExtractionResponse)
def extract_job_description(
    payload: JobExtractionRequest,
    account: Account = Depends(manager),
):
    return job_extraction_service.extract(payload.jd_text)


@router.post(
    "/{job_id}/apply",
    response_model=ApplicationCreatedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def apply_to_job(
    job_id: int,
    background_tasks: BackgroundTasks,
    full_name: str = Form(..., min_length=1, max_length=150),
    email: EmailStr = Form(..., max_length=150),
    phone: str = Form(..., min_length=1, max_length=30),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    account: Account = Depends(student),
):
    response = await application_service.apply(
        db,
        job_id=job_id,
        full_name=full_name,
        email=str(email),
        phone=phone,
        file=file,
        account=account,
    )
    background_tasks.add_task(application_service.run_analysis, response.application_id)
    return response


@router.get("/manage", response_model=list[JobResponse])
def list_manage(
    archived: bool = False,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return jobs_service.list_managed(db, account, archived=archived)


@router.post("", response_model=JobResponse, status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db), account: Account = Depends(manager)):
    return jobs_service.create(db, account, payload)


@router.patch("/{job_id}", response_model=JobResponse)
def update_job(job_id: int, payload: JobUpdate, db: Session = Depends(get_db), account: Account = Depends(manager)):
    return jobs_service.update(db, account, job_id, payload)


@router.post("/{job_id}/publish", response_model=JobResponse)
def publish_job(job_id: int, db: Session = Depends(get_db), account: Account = Depends(manager)):
    return jobs_service.publish(db, account, job_id)


@router.post("/{job_id}/close", response_model=JobResponse)
def close_job(job_id: int, db: Session = Depends(get_db), account: Account = Depends(manager)):
    return jobs_service.close(db, account, job_id)


@router.post("/{job_id}/archive", response_model=JobResponse)
def archive_job(
    job_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return jobs_service.archive(db, account, job_id)


@router.post("/{job_id}/unarchive", response_model=JobResponse)
def unarchive_job(
    job_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return jobs_service.unarchive(db, account, job_id)

