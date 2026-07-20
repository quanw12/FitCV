from datetime import datetime

from pydantic import BaseModel, Field


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
    openings_count: int
    application_count: int
    created_at: datetime
    updated_at: datetime | None
    company: CompanyPublic

