from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.applications import RankedApplicationResponse
from app.schemas.cv_ranking import BatchParseResponse
from app.services import application_service, cv_ranking_service

router = APIRouter()
manager = require_role(AccountRole.hr, AccountRole.hiring_manager, AccountRole.admin)


@router.post("/parse", response_model=BatchParseResponse)
async def parse_cv_batch(
    job_description: str = Form(..., min_length=1),
    files: list[UploadFile] = File(...),
    account: Account = Depends(manager),
) -> BatchParseResponse:
    return await cv_ranking_service.parse_batch(files, job_description)


@router.get("/jobs/{job_id}/applications", response_model=list[RankedApplicationResponse])
def list_ranked_applications(
    job_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return application_service.ranked(db, job_id=job_id, account=account)


@router.get("/applications/{application_id}/cv", response_class=FileResponse)
def download_ranked_application_cv(
    application_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return application_service.download(
        db,
        application_id=application_id,
        account=account,
    )
