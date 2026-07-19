from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.jobs import JobCreate, JobResponse, JobUpdate
from app.services import jobs_service

router = APIRouter()
student = require_role(AccountRole.student)
manager = require_role(AccountRole.hr, AccountRole.hiring_manager, AccountRole.admin)


@router.get("/public", response_model=list[JobResponse])
def list_public(db: Session = Depends(get_db), account: Account = Depends(student)):
    return jobs_service.list_public(db)


@router.get("/public/{job_id}", response_model=JobResponse)
def get_public(job_id: int, db: Session = Depends(get_db), account: Account = Depends(student)):
    return jobs_service.get_public(db, job_id)


@router.get("/manage", response_model=list[JobResponse])
def list_manage(db: Session = Depends(get_db), account: Account = Depends(manager)):
    return jobs_service.list_managed(db, account)


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

