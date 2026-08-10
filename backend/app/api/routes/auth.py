from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
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
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
)
from app.services import auth_service
from app.services import auth_rate_limit
from app.core.config import settings

router = APIRouter()


def _cookie_samesite() -> str:
    return "none" if settings.refresh_cookie_secure else "lax"


def _require_allowed_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        if settings.environment == "prod":
            raise HTTPException(status_code=403, detail="Request origin is not allowed.")
        return

    if origin.rstrip("/") not in {
        allowed.rstrip("/") for allowed in settings.cors_origins
    }:
        raise HTTPException(status_code=403, detail="Request origin is not allowed.")


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=_cookie_samesite(),
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=_cookie_samesite(),
        path="/api/auth",
    )


@router.post("/register", response_model=AuthSession, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSession:
    _require_allowed_origin(request)
    key = auth_rate_limit.consume(
        db, action="register", request=request, identifier=str(payload.email)
    )
    issued = auth_service.register(
        db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    auth_rate_limit.clear(db, key)
    _set_refresh_cookie(response, issued.refresh_token)
    return issued.session


@router.post("/login", response_model=AuthSession)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSession:
    _require_allowed_origin(request)
    key = auth_rate_limit.consume(
        db, action="login", request=request, identifier=str(payload.email)
    )
    issued = auth_service.login(db, email=payload.email, password=payload.password)
    auth_rate_limit.clear(db, key)
    _set_refresh_cookie(response, issued.refresh_token)
    return issued.session


@router.post("/oauth/google", response_model=AuthSession)
def google_oauth_login(
    payload: OAuthLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSession:
    _require_allowed_origin(request)
    key = auth_rate_limit.consume(
        db, action="google", request=request, identifier="google"
    )
    issued = auth_service.oauth_login(db, credential=payload.credential)
    auth_rate_limit.clear(db, key)
    _set_refresh_cookie(response, issued.refresh_token)
    return issued.session


@router.post("/select-role", response_model=AuthSession)
def select_role(
    payload: SelectRoleRequest,
    request: Request,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> AuthSession:
    _require_allowed_origin(request)
    session_id = getattr(request.state, "auth_session_id", None)
    if not session_id:
        raise HTTPException(status_code=401, detail="Authenticated session is missing.")
    auth_rate_limit.consume(
        db,
        action="select_role",
        request=request,
        identifier=str(account.account_id),
    )
    return auth_service.select_role(
        db, account=account, role=payload.role, session_id=session_id
    )


@router.post("/refresh", response_model=AuthSession)
def refresh_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSession:
    _require_allowed_origin(request)
    token = request.cookies.get(settings.refresh_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Refresh session is missing.")
    auth_rate_limit.consume(
        db, action="refresh", request=request, identifier="refresh"
    )
    try:
        issued = auth_service.refresh(db, refresh_token=token)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            _clear_refresh_cookie(response)
        raise
    _set_refresh_cookie(response, issued.refresh_token)
    return issued.session


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> None:
    _require_allowed_origin(request)
    token = request.cookies.get(settings.refresh_cookie_name)
    if token:
        auth_service.logout_by_refresh_token(db, refresh_token=token)
    _clear_refresh_cookie(response)


@router.post("/activity", status_code=status.HTTP_204_NO_CONTENT)
def record_activity(
    request: Request,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> None:
    _require_allowed_origin(request)
    session_id = getattr(request.state, "auth_session_id", None)
    if not session_id:
        raise HTTPException(status_code=401, detail="Authenticated session is missing.")
    auth_service.record_activity(db, session_id=session_id)


@router.get("/me", response_model=AccountPublic)
def me(account: Account = Depends(get_current_account)) -> Account:
    return account


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    _require_allowed_origin(request)
    auth_rate_limit.consume(
        db, action="forgot-password", request=request, identifier=str(payload.email)
    )
    message = auth_service.start_password_reset(db, email=payload.email)
    return ForgotPasswordResponse(message=message)


@router.post("/verify-reset-code", response_model=VerifyResetCodeResponse)
def verify_reset_code(
    payload: VerifyResetCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> VerifyResetCodeResponse:
    _require_allowed_origin(request)
    auth_rate_limit.consume(
        db, action="verify-reset", request=request, identifier=str(payload.email)
    )
    message = auth_service.verify_password_reset_code(db, email=payload.email, code=payload.code)
    return VerifyResetCodeResponse(message=message)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> None:
    _require_allowed_origin(request)
    auth_rate_limit.consume(
        db, action="reset-password", request=request, identifier=str(payload.email)
    )
    auth_service.reset_password(db, email=payload.email, code=payload.code, password=payload.password)
    _clear_refresh_cookie(response)
