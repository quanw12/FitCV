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
