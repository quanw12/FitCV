from datetime import datetime
from typing import Literal

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
    thread_id: int | None
    template_key: str
    message_kind: str
    candidate_name: str
    job_title: str
    recipient_email: EmailStr
    reply_to_email: EmailStr | None
    subject: str
    body: str
    status: str
    delivery_status: str | None
    ai_generated: bool
    in_reply_to: str | None
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


class SmartReplyGenerate(BaseModel):
    tone: Literal["professional", "warm", "concise"] = "professional"
    guidance: str | None = Field(default=None, max_length=1000)

    @field_validator("guidance")
    @classmethod
    def clean_guidance(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class EmailThreadMessageResponse(BaseModel):
    message_id: str
    direction: Literal["Inbound", "Outbound"]
    email_id: int | None
    inbound_id: int | None
    subject: str
    body: str
    status: str
    delivery_status: str | None
    ai_generated: bool
    provider_message_id: str | None
    occurred_at: datetime


class EmailThreadSummaryResponse(BaseModel):
    thread_id: int
    application_id: int
    candidate_name: str
    candidate_email: EmailStr
    job_title: str
    current_stage: str
    subject: str | None
    reply_to_email: EmailStr | None
    last_message_at: datetime
    last_inbound_at: datetime | None
    unread_count: int
    last_message_preview: str | None


class EmailThreadDetailResponse(EmailThreadSummaryResponse):
    messages: list[EmailThreadMessageResponse]


class EmailThreadReadResponse(BaseModel):
    thread_id: int
    unread_count: int


class EmailWebhookResponse(BaseModel):
    accepted: bool = True
    duplicate: bool = False
    ignored: bool = False
    detail: str | None = None
