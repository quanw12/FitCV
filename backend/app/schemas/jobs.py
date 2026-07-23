from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


def scoring_weight(default: None = None):
    return Field(
        default=default,
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    )


class JobWrite(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    about_job: str | None = None
    responsibilities: str | None = None
    requirements: str | None = None
    we_offer: str | None = None
    life_at_company: str | None = None
    hiring_process: str | None = None
    location: str | None = Field(default=None, max_length=150)
    employment_type: str | None = Field(default=None, max_length=50)
    deadline: datetime | None = None
    openings_count: int | None = Field(default=None, ge=1)
    skill_weight: Decimal | None = scoring_weight()
    experience_weight: Decimal | None = scoring_weight()
    education_weight: Decimal | None = scoring_weight()
    soft_skill_weight: Decimal | None = scoring_weight()


class JobCreate(JobWrite):
    title: str = Field(min_length=1, max_length=200)


class JobUpdate(JobWrite):
    pass


class CompanyPublic(BaseModel):
    name: str
    logo_url: str | None = None
    website_url: str | None = None


class JobResponse(BaseModel):
    job_id: int
    title: str
    description: str | None
    about_job: str | None
    responsibilities: str | None
    requirements: str | None
    we_offer: str | None
    life_at_company: str | None
    hiring_process: str | None
    location: str | None
    employment_type: str | None
    status: str
    deadline: datetime | None
    archived_at: datetime | None
    skill_weight: float
    experience_weight: float
    education_weight: float
    soft_skill_weight: float
    openings_count: int
    application_count: int
    created_at: datetime
    updated_at: datetime | None
    company: CompanyPublic

