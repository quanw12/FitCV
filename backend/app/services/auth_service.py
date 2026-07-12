from datetime import datetime, timezone
from hashlib import sha256
from secrets import randbelow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.google_auth import verify_google_credential
from app.core.security import create_access_token, create_reset_token, hash_password, verify_password
from app.models.account import Account, AccountRole
from app.repositories.accounts import create_oauth_account, create_password_account, get_account_by_email
from app.schemas.auth import AuthSession
from app.services.email_service import send_password_reset_code


def _session_for(account: Account) -> AuthSession:
    return AuthSession(
        access_token=create_access_token(str(account.account_id)),
        user=account,
        requires_role_selection=account.role is None,
    )


def register(db: Session, *, email: str, password: str, full_name: str) -> AuthSession:
    existing = get_account_by_email(db, email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    account = create_password_account(
        db,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
    )
    return _session_for(account)


def login(db: Session, *, email: str, password: str) -> AuthSession:
    account = get_account_by_email(db, email)
    if not account or not account.password_hash or not verify_password(password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return _session_for(account)


def oauth_login(db: Session, *, credential: str) -> AuthSession:
    google_profile = verify_google_credential(credential)
    email = google_profile["email"]
    full_name = google_profile["full_name"] or email
    avatar_url = google_profile["avatar_url"]

    account = get_account_by_email(db, email)
    if not account:
        account = create_oauth_account(db, email=email, full_name=full_name, avatar_url=avatar_url)
    return _session_for(account)


def select_role(db: Session, *, account: Account, role: AccountRole) -> AuthSession:
    account.role = role
    db.add(account)
    db.commit()
    db.refresh(account)
    return _session_for(account)


def _hash_reset_code(email: str, code: str) -> str:
    return sha256(f"{email.strip().lower()}:{code.strip()}".encode("utf-8")).hexdigest()


def _now_for_expires_at(expires_at: datetime) -> datetime:
    if expires_at.tzinfo:
        return datetime.now(timezone.utc)
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_valid_reset_account(db: Session, *, email: str, code: str) -> Account:
    account = get_account_by_email(db, email)
    code_hash = _hash_reset_code(email, code)
    if not account or account.reset_token_hash != code_hash or not account.reset_token_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid or expired.")

    expires_at = account.reset_token_expires_at
    now = _now_for_expires_at(expires_at)
    if expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid or expired.")

    return account


def start_password_reset(db: Session, *, email: str) -> str:
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
