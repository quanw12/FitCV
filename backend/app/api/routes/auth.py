from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.models.account import Account
from app.schemas.auth import (
    AccountPublic,
    AuthSession,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    OAuthLoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SelectRoleRequest,
)
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=AuthSession, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthSession:
    return auth_service.register(
        db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )


@router.post("/login", response_model=AuthSession)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthSession:
    return auth_service.login(db, email=payload.email, password=payload.password)


@router.post("/oauth/google", response_model=AuthSession)
def google_oauth_login(payload: OAuthLoginRequest, db: Session = Depends(get_db)) -> AuthSession:
    return auth_service.oauth_login(
        db,
        email=payload.email,
        full_name=payload.full_name,
        avatar_url=payload.avatar_url,
    )


@router.post("/select-role", response_model=AuthSession)
def select_role(
    payload: SelectRoleRequest,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AuthSession:
    return auth_service.select_role(db, account=account, role=payload.role)


@router.get("/me", response_model=AccountPublic)
def me(account: Account = Depends(get_current_account)) -> Account:
    return account


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    message, token = auth_service.start_password_reset(db, email=payload.email)
    return ForgotPasswordResponse(message=message, reset_token=token)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> None:
    auth_service.reset_password(db, token=payload.token, password=payload.password)
