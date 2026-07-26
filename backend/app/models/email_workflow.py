from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.analyzer import ID_TYPE


class CandidateEmail(Base):
    __tablename__ = "candidate_email"
    __table_args__ = (
        Index("idx_candidate_email_company_status", "company_id", "status"),
        Index(
            "idx_candidate_email_application_created",
            "application_id",
            "created_at",
        ),
    )

    email_id: Mapped[int] = mapped_column(
        ID_TYPE, primary_key=True, autoincrement=True
    )
    company_id: Mapped[int] = mapped_column(
        ID_TYPE,
        ForeignKey("company.company_id", ondelete="CASCADE"),
        nullable=False,
    )
    application_id: Mapped[int] = mapped_column(
        ID_TYPE,
        ForeignKey("application.application_id", ondelete="CASCADE"),
        nullable=False,
    )
    template_key: Mapped[str] = mapped_column(String(50), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(150), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Draft", nullable=False)
    ai_generated: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", nullable=False
    )
    created_by_account_id: Mapped[int | None] = mapped_column(
        ID_TYPE,
        ForeignKey("account.account_id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by_account_id: Mapped[int | None] = mapped_column(
        ID_TYPE,
        ForeignKey("account.account_id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, onupdate=func.now(), nullable=True
    )
