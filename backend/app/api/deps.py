from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.datetime_utils import utc_now_naive
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.account import Account
from app.repositories.accounts import get_account_by_id
from app.repositories import auth_sessions

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_account(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Account:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    claims = decode_access_token(credentials.credentials)
    if claims is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    record = auth_sessions.get_active_by_id(
        db,
        claims.session_id,
        now=utc_now_naive(),
    )
    if record is None or record.account_id != int(claims.account_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or revoked.")
    request.state.auth_session_id = claims.session_id
    account = get_account_by_id(db, int(claims.account_id))
    if account is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found.")
    return account
