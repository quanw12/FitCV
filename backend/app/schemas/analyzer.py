from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class CvVersionResponse(BaseModel):
    cv_id: int
    file_name: str
    file_type: str
    file_size_kb: int | None
    version_number: int
    is_latest: bool
    uploaded_at: datetime
    parse_status: str
    parser_version: str | None = None
    error_message: str | None = None


class AnalyzeCvRequest(BaseModel):
    cv_id: int = Field(gt=0)
    job_description: str = Field(min_length=50, max_length=100_000)
    title: str = Field(default="Pasted job description", min_length=1, max_length=200)

    @field_validator("job_description", "title")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class CategoryEvidence(BaseModel):
    score: float
    matched: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    detail: str


class MatchResultResponse(BaseModel):
    match_result_id: int
    status: str
    cv_id: int
    job_description_id: int | None = None
    title: str
    overall_score: float | None = None
    match_label: str | None = None
    pass_probability: float | None = None
    breakdown: dict[str, CategoryEvidence] = Field(default_factory=dict)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    algorithm_version: str
    error_message: str | None = None
    generated_at: datetime
    completed_at: datetime | None = None
    disclaimer: str = (
        "This score and screening probability are decision-support estimates, "
        "not guarantees or automatic hiring decisions."
    )


class CvScorePointResponse(BaseModel):
    cv_id: int
    version_number: int
    file_name: str
    uploaded_at: datetime
    match_result_id: int
    overall_score: float
    skill_score: float | None = None
    experience_score: float | None = None
    education_score: float | None = None
    soft_skill_score: float | None = None
    match_label: str | None = None
    completed_at: datetime | None = None
    delta_from_previous: float | None = None


class CvComparisonSeriesResponse(BaseModel):
    job_description_id: int
    title: str
    created_at: datetime
    best_score: float
    latest_score: float
    latest_delta: float | None = None
    versions: list[CvScorePointResponse] = Field(default_factory=list)


class JdLibraryItemResponse(BaseModel):
    job_description_id: int
    title: str
    source_type: str
    raw_text: str
    created_at: datetime
    parse_status: str
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    experience_years: float | None = None
    education: str | None = None
    match_count: int = 0
    latest_score: float | None = None
    latest_match_label: str | None = None


class SkillFrequencyResponse(BaseModel):
    skill: str
    count: int
    percentage: float


class JdLibraryInsightsResponse(BaseModel):
    total_job_descriptions: int
    total_matches: int
    average_match_score: float | None = None
    required_skills: list[SkillFrequencyResponse] = Field(default_factory=list)
    preferred_skills: list[SkillFrequencyResponse] = Field(default_factory=list)
    missing_skills: list[SkillFrequencyResponse] = Field(default_factory=list)
