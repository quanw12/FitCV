from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from hashlib import sha256
from secrets import token_urlsafe
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


@dataclass(frozen=True)
class AccessTokenClaims:
    account_id: str
    session_id: str


def create_access_token(subject: str, session_id: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "sid": session_id,
        "exp": expires_at,
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> AccessTokenClaims | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    subject = payload.get("sub")
    session_id = payload.get("sid")
    if not isinstance(subject, str) or not isinstance(session_id, str):
        return None
    return AccessTokenClaims(account_id=subject, session_id=session_id)


def create_refresh_token() -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return token_urlsafe(48), expires_at


def hash_refresh_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def create_reset_token() -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.reset_token_expire_minutes)
    return str(uuid4()), expires_at
