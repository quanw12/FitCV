from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ApplicationCreatedResponse(BaseModel):
    application_id: int
    cv_id: int
    match_result_id: int
    analysis_status: str


class ApplicationRetryResponse(BaseModel):
    application_id: int
    analysis_status: str


class RankedCandidateResponse(BaseModel):
    full_name: str
    email: str
    phone: str


class RankedCvResponse(BaseModel):
    file_name: str
    file_type: str
    file_size_kb: int


class RankedApplicationResponse(BaseModel):
    application_id: int
    job_id: int
    current_stage: str
    status: str
    applied_at: datetime
    candidate: RankedCandidateResponse
    cv: RankedCvResponse
    parse_status: str
    parse_error: str | None
    parsed_cv: dict[str, Any] | None
    analysis_status: str
    analysis_error: str | None
    overall_score: float | None
    pass_probability: float | None
    algorithm_version: str | None
    match_label: str | None
    breakdown: dict[str, float | None]


class TrackedCompanyResponse(BaseModel):
    name: str
    logo_url: str | None
    website_url: str | None


class TrackedJobResponse(BaseModel):
    title: str
    location: str | None
    employment_type: str | None
    job_status: str
    company: TrackedCompanyResponse


class TrackedCvResponse(BaseModel):
    file_name: str
    file_type: str
    file_size_kb: int


class TrackedApplicationResponse(BaseModel):
    application_id: int
    job_id: int
    current_stage: str
    status: str
    applied_at: datetime
    updated_at: datetime | None
    job: TrackedJobResponse
    cv: TrackedCvResponse
    parse_status: str
    analysis_status: str
    analysis_error: str | None
