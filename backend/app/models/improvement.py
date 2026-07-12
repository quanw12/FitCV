from datetime import datetime
from enum import Enum

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Index, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.account import enum_values

ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class SuggestionPriority(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"


class SuggestionCategory(str, Enum):
    skill = "Skill"
    experience = "Experience"
    education = "Education"
    keyword = "Keyword"
    format = "Format"
    other = "Other"


class SuggestionType(str, Enum):
    skill_gap = "SkillGap"
    section_feedback = "SectionFeedback"
    rewrite = "Rewrite"
    quick_win = "QuickWin"


class AiTaskStatus(str, Enum):
    pending = "Pending"
    processing = "Processing"
    success = "Success"
    failed = "Failed"


class Cv(Base):
    __tablename__ = "cv"

    cv_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True)
    account_id: Mapped[int | None] = mapped_column(ID_TYPE, ForeignKey("account.account_id"), nullable=True)
    candidate_id: Mapped[int | None] = mapped_column(ID_TYPE, nullable=True)
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(400))
    file_type: Mapped[str] = mapped_column(String(10))
    file_size_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_latest: Mapped[bool] = mapped_column(default=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CvParseResult(Base):
    __tablename__ = "cv_parse_result"

    cv_parse_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True)
    cv_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("cv.cv_id"))
    parsed_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    parse_status: Mapped[str] = mapped_column(String(20), default="Pending")
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


class MatchResult(Base):
    __tablename__ = "match_result"

    match_result_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True)
    cv_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("cv.cv_id"))
    job_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("job.job_id"))
    application_id: Mapped[int | None] = mapped_column(ID_TYPE, nullable=True)
    overall_score: Mapped[float] = mapped_column(Numeric(5, 2))
    skill_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    experience_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    education_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    soft_skill_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    match_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    weaknesses: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CvImprovementSuggestion(Base):
    __tablename__ = "cv_improvement_suggestion"
    __table_args__ = (
        Index("idx_suggestion_match_type_order", "match_result_id", "suggestion_type", "sort_order"),
    )

    suggestion_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    match_result_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("match_result.match_result_id", ondelete="CASCADE"))
    suggestion_type: Mapped[SuggestionType] = mapped_column(SqlEnum(SuggestionType, values_callable=enum_values))
    category: Mapped[SuggestionCategory] = mapped_column(SqlEnum(SuggestionCategory, values_callable=enum_values))
    section: Mapped[str | None] = mapped_column(String(50), nullable=True)
    original_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[SuggestionPriority] = mapped_column(SqlEnum(SuggestionPriority, values_callable=enum_values), default=SuggestionPriority.medium)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AiTask(Base):
    __tablename__ = "ai_task"
    __table_args__ = (Index("idx_ai_task_resource", "task_type", "resource_id", "created_at"),)

    ai_task_id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    task_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[int] = mapped_column(ID_TYPE)
    status: Mapped[AiTaskStatus] = mapped_column(SqlEnum(AiTaskStatus, values_callable=enum_values), default=AiTaskStatus.pending)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
