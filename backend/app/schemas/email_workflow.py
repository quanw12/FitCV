from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class EmailTemplateResponse(BaseModel):
    key: str
    name: str
    description: str


class EmailDraftGenerate(BaseModel):
    application_id: int
    template_key: str = Field(min_length=1, max_length=50)


class EmailDraftUpdate(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=30_000)

    @field_validator("subject", "body")
    @classmethod
    def clean_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Email content cannot be empty.")
        return cleaned


class EmailDraftResponse(BaseModel):
    email_id: int
    application_id: int
    template_key: str
    candidate_name: str
    job_title: str
    recipient_email: EmailStr
    subject: str
    body: str
    status: str
    ai_generated: bool
    approved_at: datetime | None
    sent_at: datetime | None
    provider_message_id: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime | None


class BulkEmailSendRequest(BaseModel):
    email_ids: list[int] = Field(min_length=1, max_length=50)


class BulkEmailSendItem(BaseModel):
    email_id: int
    status: str
    error_message: str | None = None


class BulkEmailSendResponse(BaseModel):
    sent_count: int
    failed_count: int
    results: list[BulkEmailSendItem]


class GeneratedCandidateEmail(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=30_000)
