from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.improvement import AiTaskStatus, SuggestionPriority


class CvSection(str, Enum):
    summary = "Summary"
    work_experience = "WorkExperience"
    skills = "Skills"
    education = "Education"
    projects = "Projects"
    other = "Other"


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SkillGap(StrictSchema):
    skill: str = Field(min_length=1, max_length=100)
    priority: SuggestionPriority
    reason: str = Field(min_length=1)
    jd_evidence: str = Field(min_length=1)


class SectionFeedback(StrictSchema):
    section: CvSection
    issue: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    priority: SuggestionPriority
    suggested_action: str = Field(min_length=1)

    @field_validator("section", mode="before")
    @classmethod
    def normalize_section(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        compact = value.replace(" ", "").lower()
        return next((section.value for section in CvSection if section.value.lower() == compact), CvSection.other.value)


class RewriteSuggestion(StrictSchema):
    section: CvSection
    original_text: str = Field(min_length=1)
    issue: str = Field(min_length=1)
    suggested_text: str = Field(min_length=1)
    framework: str = Field(default="Problem → Action → Result", min_length=1, max_length=100)

    @field_validator("section", mode="before")
    @classmethod
    def normalize_section(cls, value: object) -> object:
        return SectionFeedback.normalize_section(value)


class QuickWin(StrictSchema):
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=50)
    priority: SuggestionPriority
    explanation: str = Field(min_length=1)


class ImprovementReportData(StrictSchema):
    skill_gaps: list[SkillGap] = Field(default_factory=list)
    section_feedback: list[SectionFeedback] = Field(default_factory=list)
    rewrite_suggestions: list[RewriteSuggestion] = Field(default_factory=list)
    quick_wins: list[QuickWin] = Field(default_factory=list)


class ImprovementReportResponse(BaseModel):
    match_result_id: int
    status: AiTaskStatus
    generated_at: datetime | None = None
    error_message: str | None = None
    overall_score: float | None = None
    stale: bool = False
    report: ImprovementReportData | None = None


class GenerateImprovementResponse(BaseModel):
    match_result_id: int
    status: AiTaskStatus
    task_id: int | None = None
