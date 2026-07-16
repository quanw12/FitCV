from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.models.account import Account
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.services import profile_service

router = APIRouter()


@router.get("", response_model=ProfileResponse)
def get_profile(account: Account = Depends(get_current_account), db: Session = Depends(get_db)) -> ProfileResponse:
    return profile_service.get_profile(db, account)


@router.patch("", response_model=ProfileResponse)
def update_profile(payload: ProfileUpdate, account: Account = Depends(get_current_account), db: Session = Depends(get_db)) -> ProfileResponse:
    return profile_service.update_profile(db, account, payload)


@router.post("/avatar", response_model=ProfileResponse)
async def upload_avatar(request: Request, file: UploadFile = File(...), account: Account = Depends(get_current_account), db: Session = Depends(get_db)) -> ProfileResponse:
    data = await file.read(5 * 1024 * 1024 + 1)
    return profile_service.upload_avatar(db, account, data, file.content_type, str(request.base_url))


@router.delete("/avatar", response_model=ProfileResponse)
def delete_avatar(account: Account = Depends(get_current_account), db: Session = Depends(get_db)) -> ProfileResponse:
    return profile_service.delete_avatar(db, account)
