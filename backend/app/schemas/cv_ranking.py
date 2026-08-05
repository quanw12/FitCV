from datetime import datetime

from pydantic import BaseModel, Field

from app.models.platform import ScreeningBatchStatus


class ScoreBreakdown(BaseModel):
    skills: int = Field(ge=0, le=100)
    experience: int = Field(ge=0, le=100)
    education: int = Field(ge=0, le=100)
    soft_skills: int = Field(ge=0, le=100)


class ParsedCandidateResponse(BaseModel):
    id: str
    source_index: int = Field(ge=0)
    file_name: str
    file_type: str
    file_size_label: str
    name: str
    email: str
    phone: str
    location: str
    position: str
    skills: list[str]
    matched_skills: list[str]
    missing_skills: list[str]
    experience_years: float
    education: str
    score: int = Field(ge=0, le=100)
    match_label: str
    score_breakdown: ScoreBreakdown
    status: str
    strengths: list[str]
    weaknesses: list[str]
    parse_notes: list[str]
    screening_candidate_id: int | None = None
    is_selected: bool = False
    is_confirmed: bool = False


class BatchParseResponse(BaseModel):
    required_skills: list[str]
    preferred_skills: list[str]
    candidates: list[ParsedCandidateResponse]
    warnings: list[str] = Field(default_factory=list)
    screening_batch_id: int | None = None
    ai_task_id: int | None = None
    status: ScreeningBatchStatus | None = None
    title: str | None = None
    created_at: datetime | None = None
    total_files: int | None = None
    processed_count: int | None = None


class ScreeningBatchSummary(BaseModel):
    screening_batch_id: int
    title: str
    status: ScreeningBatchStatus
    total_files: int
    processed_count: int
    selected_count: int
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScreeningSelectionRequest(BaseModel):
    selected_candidate_keys: list[str] = Field(default_factory=list)
    confirmed_candidate_keys: list[str] = Field(default_factory=list)
