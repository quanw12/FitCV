from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.analyzer import ID_TYPE


class CandidateEmailThread(Base):
    __tablename__ = "candidate_email_thread"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "application_id",
            name="uq_candidate_email_thread_company_application",
        ),
        UniqueConstraint("reply_token", name="uq_candidate_email_thread_reply_token"),
        Index(
            "idx_candidate_email_thread_company_activity",
            "company_id",
            "last_message_at",
        ),
    )

    thread_id: Mapped[int] = mapped_column(
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
    reply_token: Mapped[str] = mapped_column(String(36), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(300), nullable=True)
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    last_inbound_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, onupdate=func.now(), nullable=True
    )


class CandidateEmail(Base):
    __tablename__ = "candidate_email"
    __table_args__ = (
        Index("idx_candidate_email_company_status", "company_id", "status"),
        Index(
            "idx_candidate_email_application_created",
            "application_id",
            "created_at",
        ),
        Index("idx_candidate_email_thread_created", "thread_id", "created_at"),
        Index("idx_candidate_email_provider", "provider_message_id"),
        UniqueConstraint(
            "idempotency_key", name="uq_candidate_email_idempotency_key"
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
    thread_id: Mapped[int | None] = mapped_column(
        ID_TYPE,
        ForeignKey("candidate_email_thread.thread_id", ondelete="SET NULL"),
        nullable=True,
    )
    template_key: Mapped[str] = mapped_column(String(50), nullable=False)
    message_kind: Mapped[str] = mapped_column(
        String(20), default="Initial", server_default="Initial", nullable=False
    )
    recipient_email: Mapped[str] = mapped_column(String(150), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Draft", nullable=False)
    delivery_status: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    ai_generated: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", nullable=False
    )
    in_reply_to: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    references_json: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        String(256), nullable=True
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


class CandidateEmailInbound(Base):
    __tablename__ = "candidate_email_inbound"
    __table_args__ = (
        UniqueConstraint(
            "provider_email_id",
            name="uq_candidate_email_inbound_provider_email",
        ),
        Index(
            "idx_candidate_email_inbound_thread_received",
            "thread_id",
            "received_at",
        ),
        Index(
            "idx_candidate_email_inbound_thread_unread",
            "thread_id",
            "is_read",
        ),
    )

    inbound_id: Mapped[int] = mapped_column(
        ID_TYPE, primary_key=True, autoincrement=True
    )
    thread_id: Mapped[int] = mapped_column(
        ID_TYPE,
        ForeignKey("candidate_email_thread.thread_id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_email_id: Mapped[str] = mapped_column(String(200), nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    sender_email: Mapped[str] = mapped_column(String(150), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(150), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    in_reply_to: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    references_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments_json: Mapped[list[dict] | None] = mapped_column(
        JSON, nullable=True
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class CandidateEmailEvent(Base):
    __tablename__ = "candidate_email_event"
    __table_args__ = (
        UniqueConstraint(
            "provider_event_id",
            name="uq_candidate_email_event_provider_event",
        ),
        Index(
            "idx_candidate_email_event_email_occurred",
            "candidate_email_id",
            "occurred_at",
        ),
        Index(
            "idx_candidate_email_event_provider_email",
            "provider_email_id",
        ),
    )

    email_event_id: Mapped[int] = mapped_column(
        ID_TYPE, primary_key=True, autoincrement=True
    )
    candidate_email_id: Mapped[int | None] = mapped_column(
        ID_TYPE,
        ForeignKey("candidate_email.email_id", ondelete="CASCADE"),
        nullable=True,
    )
    provider_event_id: Mapped[str] = mapped_column(String(200), nullable=False)
    provider_email_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_data_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
