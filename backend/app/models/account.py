from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AccountRole(str, Enum):
    student = "Student"
    hr = "HR"
    hiring_manager = "HiringManager"
    admin = "Admin"


class AuthProvider(str, Enum):
    password = "Password"
    google = "Google"


class Account(Base):
    __tablename__ = "account"

    account_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[AccountRole | None] = mapped_column(SqlEnum(AccountRole), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    company_id: Mapped[int | None] = mapped_column(nullable=True)
    auth_provider: Mapped[AuthProvider] = mapped_column(SqlEnum(AuthProvider), default=AuthProvider.password, nullable=False)
    reset_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
