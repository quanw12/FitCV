from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class TrackedApplication(Base):
    __tablename__ = "tracked_application"
    __table_args__ = (
        Index("idx_tracked_application_account_date", "account_id", "applied_on"),
        Index("idx_tracked_application_account_status", "account_id", "status"),
        Index("idx_tracked_application_reminder", "account_id", "reminder_at"),
    )

    tracked_application_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("account.account_id", ondelete="CASCADE"), nullable=False)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    position_title: Mapped[str] = mapped_column(String(200), nullable=False)
    applied_on: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Applied", nullable=False)
    job_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reminder_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=func.now(), nullable=True)


class TrackedApplicationNote(Base):
    __tablename__ = "tracked_application_note"
    __table_args__ = (Index("idx_tracked_application_note_application", "tracked_application_id", "created_at"),)

    note_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    tracked_application_id: Mapped[int] = mapped_column(
        ID_TYPE,
        ForeignKey("tracked_application.tracked_application_id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=func.now(), nullable=True)


class TrackedApplicationStatusHistory(Base):
    __tablename__ = "tracked_application_status_history"
    __table_args__ = (Index("idx_tracked_application_history_application", "tracked_application_id", "changed_at"),)

    status_history_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    tracked_application_id: Mapped[int] = mapped_column(
        ID_TYPE,
        ForeignKey("tracked_application.tracked_application_id", ondelete="CASCADE"),
        nullable=False,
    )
    previous_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
