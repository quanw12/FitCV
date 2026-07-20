from datetime import date, datetime
from enum import Enum
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator


class ApplicationStatus(str, Enum):
    applied = "Applied"
    screening = "Screening"
    interview = "Interview"
    offer = "Offer"
    rejected = "Rejected"


class ApplicationCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    position_title: str = Field(min_length=1, max_length=200)
    applied_on: date
    source: str = Field(min_length=1, max_length=50)
    status: ApplicationStatus = ApplicationStatus.applied
    job_url: str | None = Field(default=None, max_length=500)
    reminder_at: datetime | None = None

    @field_validator("company_name", "position_title", "source")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("applied_on")
    @classmethod
    def reject_future_application_date(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Application date cannot be in the future.")
        return value

    @field_validator("job_url")
    @classmethod
    def validate_job_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Job URL must be a valid HTTP or HTTPS URL.")
        return value


class ApplicationUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=200)
    position_title: str | None = Field(default=None, min_length=1, max_length=200)
    applied_on: date | None = None
    source: str | None = Field(default=None, min_length=1, max_length=50)
    status: ApplicationStatus | None = None
    job_url: str | None = Field(default=None, max_length=500)
    reminder_at: datetime | None = None

    @model_validator(mode="after")
    def require_a_real_update(self):
        if not self.model_fields_set:
            raise ValueError("At least one application field must be provided.")
        for field in ("company_name", "position_title", "applied_on", "source", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null.")
        return self

    @field_validator("company_name", "position_title", "source")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("applied_on")
    @classmethod
    def reject_future_application_date(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Application date cannot be in the future.")
        return value

    @field_validator("job_url")
    @classmethod
    def validate_job_url(cls, value: str | None) -> str | None:
        return ApplicationCreate.validate_job_url(value)


class ApplicationNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Note must not be blank.")
        return value


class ApplicationNoteUpdate(ApplicationNoteCreate):
    pass


class ApplicationNoteResponse(BaseModel):
    note_id: int
    content: str
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class ApplicationStatusHistoryResponse(BaseModel):
    status_history_id: int
    previous_status: ApplicationStatus | None
    new_status: ApplicationStatus
    changed_at: datetime

    model_config = {"from_attributes": True}


class ApplicationSummaryResponse(BaseModel):
    application_id: int
    company_name: str
    position_title: str
    applied_on: date
    source: str
    status: ApplicationStatus
    job_url: str | None
    reminder_at: datetime | None
    last_activity_at: datetime
    created_at: datetime
    updated_at: datetime | None
    note_count: int
    reminder_due: bool
    reminder_reason: str | None
    days_since_update: int


class ApplicationDetailResponse(ApplicationSummaryResponse):
    notes: list[ApplicationNoteResponse]
    status_history: list[ApplicationStatusHistoryResponse]


class ApplicationStatsResponse(BaseModel):
    total: int
    reminders_due: int
    by_status: dict[ApplicationStatus, int]
