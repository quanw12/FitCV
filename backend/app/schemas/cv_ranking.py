from pydantic import BaseModel, Field


class ScoreBreakdown(BaseModel):
    skills: int = Field(ge=0, le=100)
    experience: int = Field(ge=0, le=100)
    education: int = Field(ge=0, le=100)


class ParsedCandidateResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size_label: str
    name: str
    email: str
    phone: str
    location: str
    position: str
    skills: list[str]
    missing_skills: list[str]
    experience_years: int
    education: str
    score: int = Field(ge=0, le=100)
    score_breakdown: ScoreBreakdown
    status: str
    parse_notes: list[str]


class BatchParseResponse(BaseModel):
    required_skills: list[str]
    candidates: list[ParsedCandidateResponse]
    warnings: list[str] = Field(default_factory=list)
