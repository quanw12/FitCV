from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account, AuthProvider


def get_account_by_email(db: Session, email: str) -> Account | None:
    return db.scalar(select(Account).where(Account.email == email.lower()))


def get_account_by_id(db: Session, account_id: int) -> Account | None:
    return db.get(Account, account_id)


def create_password_account(db: Session, *, email: str, password_hash: str, full_name: str) -> Account:
    account = Account(
        email=email.lower(),
        password_hash=password_hash,
        full_name=full_name.strip(),
        auth_provider=AuthProvider.password,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def create_oauth_account(db: Session, *, email: str, full_name: str, avatar_url: str | None) -> Account:
    account = Account(
        email=email.lower(),
        password_hash=None,
        full_name=full_name.strip(),
        avatar_url=avatar_url,
        auth_provider=AuthProvider.google,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account
