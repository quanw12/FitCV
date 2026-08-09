from datetime import date, datetime
import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


EmailStage = Literal[
    "Applied",
    "Screening",
    "Interview",
    "Offer",
    "Hired",
    "Rejected",
]
SmartReplyTone = Literal["professional", "warm", "concise"]
SmartReplyIntent = Literal[
    "general",
    "answer_question",
    "interview_details",
    "application_update",
    "rejection_follow_up",
]

EMAIL_TEMPLATE_PLACEHOLDERS: frozenset[str] = frozenset(
    {
        "candidate_name",
        "job_title",
        "company_name",
        "hr_name",
        "interview_date",
        "interview_window",
        "application_stage",
        "reply_hint",
    }
)
_PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*([^{}]+?)\s*\}\}")
_SENTENCE_END_PATTERN = re.compile(r"[.!?](?:[\"')\]]*)?(?=\s|$)")


class EmailTemplateResponse(BaseModel):
    key: str
    name: str
    description: str
    allowed_stages: list[str] | None
    default_stage: str | None


class EmailDraftGenerate(BaseModel):
    application_id: int
    template_key: str = Field(min_length=1, max_length=50)
    guidance: str | None = Field(default=None, max_length=2000)

    @field_validator("guidance")
    @classmethod
    def clean_guidance(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


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
    campaign_id: int | None
    template_key: str
    message_kind: str
    stage_at_generation: str | None
    current_stage: str
    stage_changed_since_generation: bool
    candidate_name: str
    job_title: str
    recipient_email: str
    recipient_email_valid: bool
    reply_to_email: EmailStr | None
    subject: str
    body: str
    status: str
    delivery_status: str | None
    retryable: bool
    retry_count: int
    last_attempt_at: datetime | None
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

    @field_validator("email_ids")
    @classmethod
    def validate_email_ids(cls, value: list[int]) -> list[int]:
        if any(email_id <= 0 for email_id in value):
            raise ValueError("Email IDs must be positive integers.")
        return list(dict.fromkeys(value))


class BulkEmailSendItem(BaseModel):
    email_id: int
    status: str
    error_message: str | None = None


class BulkEmailSendResponse(BaseModel):
    sent_count: int
    failed_count: int
    results: list[BulkEmailSendItem]


class GeneratedEmailTemplate(BaseModel):
    subject_template: str = Field(min_length=10, max_length=200)
    greeting_template: str = Field(min_length=3, max_length=200)
    paragraphs: list[str] = Field(min_length=3, max_length=5)
    next_steps: list[str] = Field(min_length=1, max_length=3)
    closing: str = Field(min_length=10, max_length=400)
    signature_lines: list[str] = Field(min_length=2, max_length=4)

    @field_validator("subject_template", "greeting_template", "closing")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("closing")
    @classmethod
    def validate_closing_sentences(cls, value: str) -> str:
        sentence_count = len(_SENTENCE_END_PATTERN.findall(value))
        if not 1 <= sentence_count <= 2:
            raise ValueError("Email closing must contain 1 to 2 full sentences.")
        return value

    @field_validator("paragraphs")
    @classmethod
    def validate_paragraphs(cls, value: list[str]) -> list[str]:
        normalized = [" ".join(paragraph.split()) for paragraph in value]
        for paragraph in normalized:
            if len(paragraph) < 180:
                raise ValueError(
                    "Each email paragraph must contain at least 180 characters."
                )
            sentence_count = len(_SENTENCE_END_PATTERN.findall(paragraph))
            if not 2 <= sentence_count <= 4:
                raise ValueError(
                    "Each email paragraph must contain 2 to 4 full sentences."
                )
        return normalized

    @field_validator("next_steps", "signature_lines")
    @classmethod
    def normalize_lines(cls, value: list[str]) -> list[str]:
        normalized = [" ".join(line.split()) for line in value]
        if any(not line for line in normalized):
            raise ValueError("Email template lines cannot be empty.")
        return normalized

    @model_validator(mode="after")
    def validate_placeholders(self) -> "GeneratedEmailTemplate":
        parts = [
            self.subject_template,
            self.greeting_template,
            *self.paragraphs,
            *self.next_steps,
            self.closing,
            *self.signature_lines,
        ]
        placeholders = {
            match.group(1).strip()
            for part in parts
            for match in _PLACEHOLDER_PATTERN.finditer(part)
        }
        unknown = sorted(placeholders - EMAIL_TEMPLATE_PLACEHOLDERS)
        if unknown:
            raise ValueError(
                "Unsupported email template placeholder(s): "
                + ", ".join(unknown)
                + "."
            )
        if "job_title" not in {
            match.group(1).strip()
            for match in _PLACEHOLDER_PATTERN.finditer(self.subject_template)
        }:
            raise ValueError(
                "subject_template must contain the {{job_title}} placeholder."
            )
        if "candidate_name" not in {
            match.group(1).strip()
            for match in _PLACEHOLDER_PATTERN.finditer(self.greeting_template)
        }:
            raise ValueError(
                "greeting_template must contain the {{candidate_name}} placeholder."
            )
        signature_placeholders = {
            match.group(1).strip()
            for line in self.signature_lines
            for match in _PLACEHOLDER_PATTERN.finditer(line)
        }
        if "company_name" not in signature_placeholders:
            raise ValueError(
                "signature_lines must contain the {{company_name}} placeholder."
            )
        return self


class EmailAudienceItem(BaseModel):
    application_id: int
    candidate_name: str
    candidate_email: str
    job_id: int
    job_title: str
    current_stage: EmailStage
    applied_at: datetime
    overall_score: float | None
    match_label: str | None
    has_email_address: bool
    last_email_template_key: str | None
    last_email_sent_at: datetime | None
    already_emailed_for_stage: bool
    pending_draft_email_id: int | None
    blocked_reason: str | None


class EmailAudienceResponse(BaseModel):
    stage: EmailStage
    template_key: str
    job_id: int | None
    eligible: list[EmailAudienceItem]
    blocked: list[EmailAudienceItem]


class CampaignGenerateRequest(BaseModel):
    application_ids: list[int] = Field(min_length=1, max_length=50)
    template_key: str = Field(min_length=1, max_length=50)
    allow_resend: bool = False
    guidance: str | None = Field(default=None, max_length=2000)
    interview_lead_days: int = Field(default=3, ge=1, le=30)
    interview_window: str | None = Field(default=None, max_length=120)

    @field_validator("application_ids")
    @classmethod
    def validate_application_ids(cls, value: list[int]) -> list[int]:
        if any(application_id <= 0 for application_id in value):
            raise ValueError("Application IDs must be positive integers.")
        return list(dict.fromkeys(value))

    @field_validator("guidance", "interview_window")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CampaignPreviewResponse(BaseModel):
    campaign_id: int
    template_key: str
    target_stage: str
    interview_date: date | None
    ai_generated: bool
    recipient_count: int
    shared_body_skeleton: str
    drafts: list[EmailDraftResponse]
    skipped: list[EmailAudienceItem]


class SmartReplyGenerate(BaseModel):
    tone: SmartReplyTone = "professional"
    intent: SmartReplyIntent = "general"
    guidance: str | None = Field(default=None, max_length=1000)

    @field_validator("guidance")
    @classmethod
    def clean_guidance(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class SmartReplyBatchRequest(BaseModel):
    thread_ids: list[int] = Field(min_length=1, max_length=30)
    tone: SmartReplyTone = "professional"
    intent: SmartReplyIntent = "general"
    guidance: str | None = Field(default=None, max_length=1000)
    interview_lead_days: int = Field(default=3, ge=1, le=30)

    @field_validator("thread_ids")
    @classmethod
    def validate_thread_ids(cls, value: list[int]) -> list[int]:
        if any(thread_id <= 0 for thread_id in value):
            raise ValueError("Thread IDs must be positive integers.")
        return list(dict.fromkeys(value))

    @field_validator("guidance")
    @classmethod
    def clean_guidance(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class SmartReplyBatchResponse(BaseModel):
    drafts: list[EmailDraftResponse]
    skipped: list[dict]


class EmailThreadMessageResponse(BaseModel):
    message_id: str
    direction: Literal["Inbound", "Outbound"]
    email_id: int | None
    inbound_id: int | None
    subject: str
    body: str
    status: str
    delivery_status: str | None
    retryable: bool
    ai_generated: bool
    provider_message_id: str | None
    occurred_at: datetime


class EmailThreadSummaryResponse(BaseModel):
    thread_id: int
    application_id: int
    candidate_name: str
    candidate_email: str
    recipient_email_valid: bool
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
