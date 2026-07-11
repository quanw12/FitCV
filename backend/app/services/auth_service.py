from datetime import datetime, timezone
from hashlib import sha256

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, create_reset_token, hash_password, verify_password
from app.models.account import Account, AccountRole
from app.repositories.accounts import create_oauth_account, create_password_account, get_account_by_email
from app.schemas.auth import AuthSession


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


def oauth_login(db: Session, *, email: str, full_name: str, avatar_url: str | None) -> AuthSession:
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


def start_password_reset(db: Session, *, email: str) -> tuple[str, str | None]:
    account = get_account_by_email(db, email)
    if not account:
        return "If the email exists, a reset link will be sent.", None

    token, expires_at = create_reset_token()
    account.reset_token_hash = sha256(token.encode("utf-8")).hexdigest()
    account.reset_token_expires_at = expires_at
    db.add(account)
    db.commit()
    return "Password reset has been prepared.", token


def reset_password(db: Session, *, token: str, password: str) -> None:
    token_hash = sha256(token.encode("utf-8")).hexdigest()
    account = db.query(Account).filter(Account.reset_token_hash == token_hash).first()
    if not account or not account.reset_token_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token is invalid or expired.")

    expires_at = account.reset_token_expires_at
    now = datetime.now(timezone.utc) if expires_at.tzinfo else datetime.now()
    if expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token is invalid or expired.")

    account.password_hash = hash_password(password)
    account.reset_token_hash = None
    account.reset_token_expires_at = None
    db.add(account)
    db.commit()
