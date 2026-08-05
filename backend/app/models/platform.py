from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.account import enum_values
from app.models.analyzer import ID_TYPE


class ScreeningBatchStatus(str, Enum):
    pending = "Pending"
    processing = "Processing"
    completed = "Completed"
    partial = "Partial"
    failed = "Failed"


class ScreeningCandidateStatus(str, Enum):
    pending = "Pending"
    ready = "Ready"
    failed = "Failed"


class HrScreeningBatch(Base):
    __tablename__ = "hr_screening_batch"
    __table_args__ = (
        Index("idx_screening_batch_company_created", "company_id", "created_at"),
        Index("idx_screening_batch_company_status", "company_id", "status"),
    )

    screening_batch_id: Mapped[int] = mapped_column(
        ID_TYPE, primary_key=True, autoincrement=True
    )
    company_id: Mapped[int] = mapped_column(
        ID_TYPE, ForeignKey("company.company_id", ondelete="CASCADE"), nullable=False
    )
    created_by_account_id: Mapped[int] = mapped_column(
        ID_TYPE, ForeignKey("account.account_id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ScreeningBatchStatus] = mapped_column(
        SqlEnum(ScreeningBatchStatus, values_callable=enum_values),
        default=ScreeningBatchStatus.pending,
        nullable=False,
    )
    required_skills_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    preferred_skills_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    warnings_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    total_files: Mapped[int] = mapped_column(Integer, nullable=False)
    processed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    selected_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, onupdate=func.now(), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class HrScreeningCandidate(Base):
    __tablename__ = "hr_screening_candidate"
    __table_args__ = (
        UniqueConstraint(
            "screening_batch_id", "source_index", name="uq_screening_candidate_source"
        ),
        Index(
            "idx_screening_candidate_batch_score",
            "screening_batch_id",
            "score",
        ),
        Index(
            "idx_screening_candidate_batch_selected",
            "screening_batch_id",
            "is_selected",
        ),
    )

    screening_candidate_id: Mapped[int] = mapped_column(
        ID_TYPE, primary_key=True, autoincrement=True
    )
    screening_batch_id: Mapped[int] = mapped_column(
        ID_TYPE,
        ForeignKey("hr_screening_batch.screening_batch_id", ondelete="CASCADE"),
        nullable=False,
    )
    source_index: Mapped[int] = mapped_column(Integer, nullable=False)
    candidate_key: Mapped[str] = mapped_column(String(64), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(400), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size_kb: Mapped[int] = mapped_column(Integer, nullable=False)
    file_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    position: Mapped[str | None] = mapped_column(String(150), nullable=True)
    parsed_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    skills_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    matched_skills_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    missing_skills_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    experience_years: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    education: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    match_label: Mapped[str | None] = mapped_column(String(30), nullable=True)
    score_breakdown_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    strengths_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    weaknesses_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    parse_notes_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ScreeningCandidateStatus] = mapped_column(
        SqlEnum(ScreeningCandidateStatus, values_callable=enum_values),
        default=ScreeningCandidateStatus.pending,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, onupdate=func.now(), nullable=True
    )


class AuthSessionRecord(Base):
    __tablename__ = "auth_session"
    __table_args__ = (
        UniqueConstraint("refresh_token_hash", name="uq_auth_session_refresh_hash"),
        Index("idx_auth_session_account_active", "account_id", "revoked_at", "expires_at"),
    )

    session_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ID_TYPE, ForeignKey("account.account_id", ondelete="CASCADE"), nullable=False
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)


class AuthRateLimit(Base):
    __tablename__ = "auth_rate_limit"

    key_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    window_started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
