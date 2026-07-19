from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.analyzer import ID_TYPE


class Company(Base):
    __tablename__ = "company"

    company_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry_id: Mapped[int | None] = mapped_column(ID_TYPE, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class Position(Base):
    __tablename__ = "position"

    position_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    abbreviation: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)


class Level(Base):
    __tablename__ = "level"

    level_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    level_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class JobHr(Base):
    __tablename__ = "job_hr"

    job_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("job.job_id", ondelete="CASCADE"), primary_key=True)
    hr_account_id: Mapped[int] = mapped_column(
        ID_TYPE, ForeignKey("account.account_id", ondelete="CASCADE"), primary_key=True
    )
    role_type: Mapped[str | None] = mapped_column(String(50), nullable=True)


class Application(Base):
    __tablename__ = "application"

    application_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ID_TYPE, nullable=False)
    job_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("job.job_id", ondelete="CASCADE"), nullable=False)
    cv_id: Mapped[int] = mapped_column(ID_TYPE, nullable=False)
    current_stage: Mapped[str] = mapped_column(String(20), default="Applied", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Active", nullable=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=func.now(), nullable=True)
