from datetime import datetime, timezone
from dataclasses import dataclass
from hashlib import sha256
from secrets import compare_digest, randbelow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.datetime_utils import utc_now_naive
from app.core.google_auth import verify_google_credential
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.account import Account, AccountRole
from app.repositories.accounts import (
    create_oauth_account,
    create_password_account,
    get_account_by_email,
    set_role_if_unset,
)
from app.repositories import auth_sessions
from app.schemas.auth import AuthSession, SelectableRole
from app.services.email_service import (
    ensure_password_reset_email_configured,
    send_password_reset_code,
)


@dataclass(frozen=True)
class IssuedAuthSession:
    session: AuthSession
    refresh_token: str


def _auth_payload(account: Account, session_id: str) -> AuthSession:
    return AuthSession(
        access_token=create_access_token(str(account.account_id), session_id),
        user=account,
        requires_role_selection=account.role is None,
    )


def _issue_new_session(db: Session, account: Account) -> IssuedAuthSession:
    now = utc_now_naive()
    refresh_token, expires_at = create_refresh_token()
    record = auth_sessions.create(
        db,
        account_id=account.account_id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=expires_at,
        now=now,
    )
    return IssuedAuthSession(
        session=_auth_payload(account, record.session_id),
        refresh_token=refresh_token,
    )


def register(db: Session, *, email: str, password: str, full_name: str) -> IssuedAuthSession:
    existing = get_account_by_email(db, email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    account = create_password_account(
        db,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
    )
    return _issue_new_session(db, account)


def login(db: Session, *, email: str, password: str) -> IssuedAuthSession:
    account = get_account_by_email(db, email)
    if not account or not account.password_hash or not verify_password(password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return _issue_new_session(db, account)


def oauth_login(db: Session, *, credential: str) -> IssuedAuthSession:
    google_profile = verify_google_credential(credential)
    email = google_profile["email"]
    full_name = google_profile["full_name"] or email
    avatar_url = google_profile["avatar_url"]

    account = get_account_by_email(db, email)
    if not account:
        account = create_oauth_account(db, email=email, full_name=full_name, avatar_url=avatar_url)
    return _issue_new_session(db, account)


def select_role(
    db: Session, *, account: Account, role: SelectableRole, session_id: str
) -> AuthSession:
    try:
        selected_role = AccountRole(SelectableRole(role).value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role must be Student or HR.",
        ) from exc

    selected_account = set_role_if_unset(
        db,
        account_id=account.account_id,
        role=selected_role,
    )
    if selected_account is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role has already been selected for this account.",
        )

    return _auth_payload(selected_account, session_id)


def refresh(db: Session, *, refresh_token: str) -> IssuedAuthSession:
    now = utc_now_naive()
    record = auth_sessions.get_active_by_refresh_hash(
        db,
        hash_refresh_token(refresh_token),
        now=now,
        for_update=True,
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session is invalid or expired.",
        )
    account = db.get(Account, record.account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found.")
    next_token, _ = create_refresh_token()
    auth_sessions.rotate(
        db,
        record,
        refresh_token_hash=hash_refresh_token(next_token),
    )
    return IssuedAuthSession(
        session=_auth_payload(account, record.session_id),
        refresh_token=next_token,
    )


def logout(db: Session, *, session_id: str) -> None:
    auth_sessions.revoke(
        db,
        session_id,
        reason="Logout",
        now=utc_now_naive(),
    )


def logout_by_refresh_token(db: Session, *, refresh_token: str) -> None:
    auth_sessions.revoke_by_refresh_hash(
        db,
        hash_refresh_token(refresh_token),
        reason="Logout",
        now=utc_now_naive(),
    )


def record_activity(db: Session, *, session_id: str) -> None:
    """Gia hạn cửa sổ idle chỉ từ tín hiệu tương tác người dùng đã xác thực."""

    auth_sessions.touch_activity(db, session_id, now=utc_now_naive())


def _hash_reset_code(email: str, code: str) -> str:
    return sha256(f"{email.strip().lower()}:{code.strip()}".encode("utf-8")).hexdigest()


def _now_for_expires_at(expires_at: datetime) -> datetime:
    if expires_at.tzinfo:
        return datetime.now(timezone.utc)
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_valid_reset_account(db: Session, *, email: str, code: str) -> Account:
    account = get_account_by_email(db, email)
    code_hash = _hash_reset_code(email, code)
    if (
        account is None
        or account.reset_token_hash is None
        or not compare_digest(account.reset_token_hash, code_hash)
        or account.reset_token_expires_at is None
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid or expired.")

    expires_at = account.reset_token_expires_at
    now = _now_for_expires_at(expires_at)
    if expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid or expired.")

    return account


def start_password_reset(db: Session, *, email: str) -> str:
    ensure_password_reset_email_configured()
    account = get_account_by_email(db, email)
    if not account:
        return "If the email exists, a verification code will be sent."

    code = f"{randbelow(1_000_000):06d}"
    _, expires_at = create_reset_token()
    account.reset_token_hash = _hash_reset_code(account.email, code)
    account.reset_token_expires_at = expires_at
    db.add(account)
    db.commit()

    send_password_reset_code(to_email=account.email, code=code)
    return "If the email exists, a verification code will be sent."


def verify_password_reset_code(db: Session, *, email: str, code: str) -> str:
    _get_valid_reset_account(db, email=email, code=code)
    return "Verification code accepted. Choose a new password."


def reset_password(db: Session, *, email: str, code: str, password: str) -> None:
    account = _get_valid_reset_account(db, email=email, code=code)
    account.password_hash = hash_password(password)
    account.reset_token_hash = None
    account.reset_token_expires_at = None
    db.add(account)
    db.commit()
    auth_sessions.revoke_all(
        db,
        account.account_id,
        reason="PasswordReset",
        now=utc_now_naive(),
    )
