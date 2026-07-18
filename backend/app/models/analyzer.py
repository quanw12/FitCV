from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class Cv(Base):
    __tablename__ = "cv"
    __table_args__ = (
        UniqueConstraint("account_id", "version_number", name="uq_cv_account_version"),
        Index("idx_cv_account_latest", "account_id", "is_latest", "uploaded_at"),
    )

    cv_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    account_id: Mapped[int | None] = mapped_column(ID_TYPE, ForeignKey("account.account_id"), nullable=True)
    candidate_id: Mapped[int | None] = mapped_column(ID_TYPE, nullable=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(400), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_latest: Mapped[bool] = mapped_column(default=True, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class CvParseResult(Base):
    __tablename__ = "cv_parse_result"

    cv_parse_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    cv_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("cv.cv_id", ondelete="CASCADE"), nullable=False)
    parsed_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    parse_status: Mapped[str] = mapped_column(String(20), default="Pending", nullable=False)
    parser_version: Mapped[str] = mapped_column(String(50), default="fitcv-parser-v1", nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    parsed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Job(Base):
    __tablename__ = "job"

    job_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True)
    company_id: Mapped[int] = mapped_column(ID_TYPE)
    created_by_account_id: Mapped[int] = mapped_column(ID_TYPE)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class JobDescription(Base):
    __tablename__ = "job_description"
    __table_args__ = (
        Index("idx_job_description_account_created", "account_id", "created_at"),
        Index("idx_job_description_account_hash", "account_id", "content_sha256"),
    )

    job_description_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("account.account_id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[int | None] = mapped_column(ID_TYPE, ForeignKey("job.job_id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), default="Pasted job description", nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), default="PastedText", nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class JdParseResult(Base):
    __tablename__ = "jd_parse_result"

    jd_parse_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    job_description_id: Mapped[int] = mapped_column(
        ID_TYPE, ForeignKey("job_description.job_description_id", ondelete="CASCADE"), nullable=False
    )
    parsed_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    parse_status: Mapped[str] = mapped_column(String(20), default="Pending", nullable=False)
    parser_version: Mapped[str] = mapped_column(String(50), default="fitcv-parser-v1", nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    parsed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class MatchResult(Base):
    __tablename__ = "match_result"
    __table_args__ = (
        UniqueConstraint("cv_parse_id", "jd_parse_id", "algorithm_version", name="uq_match_exact_versions"),
        Index("idx_match_cv_generated", "cv_id", "generated_at"),
    )

    match_result_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    cv_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("cv.cv_id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[int | None] = mapped_column(ID_TYPE, ForeignKey("job.job_id", ondelete="CASCADE"), nullable=True)
    job_description_id: Mapped[int | None] = mapped_column(
        ID_TYPE, ForeignKey("job_description.job_description_id", ondelete="CASCADE"), nullable=True
    )
    cv_parse_id: Mapped[int | None] = mapped_column(
        ID_TYPE, ForeignKey("cv_parse_result.cv_parse_id", ondelete="CASCADE"), nullable=True
    )
    jd_parse_id: Mapped[int | None] = mapped_column(
        ID_TYPE, ForeignKey("jd_parse_result.jd_parse_id", ondelete="CASCADE"), nullable=True
    )
    application_id: Mapped[int | None] = mapped_column(ID_TYPE, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="Pending", nullable=False)
    overall_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    skill_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    experience_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    education_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    soft_skill_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    pass_probability: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    match_label: Mapped[str | None] = mapped_column(String(30), nullable=True)
    evidence_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    match_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    weaknesses: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    algorithm_version: Mapped[str] = mapped_column(String(50), default="fitcv-deterministic-v1", nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
