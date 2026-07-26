from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

PipelineStage = Literal[
    "Applied",
    "Screening",
    "Interview",
    "Offer",
    "Hired",
    "Rejected",
]


class PipelineApplicationResponse(BaseModel):
    application_id: int
    job_id: int
    job_title: str
    candidate_name: str
    candidate_email: str
    candidate_phone: str
    current_stage: PipelineStage
    status: str
    applied_at: datetime
    overall_score: float | None
    match_label: str | None
    note_count: int


class PipelineStageUpdate(BaseModel):
    stage: PipelineStage


class PipelineNoteCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5_000)

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Note cannot be empty.")
        return cleaned


class PipelineNoteResponse(BaseModel):
    note_id: int
    application_id: int
    author_name: str
    content: str
    created_at: datetime
    updated_at: datetime | None


class PipelineStageHistoryResponse(BaseModel):
    stage_history_id: int
    previous_stage: str | None
    new_stage: str
    changed_by_name: str
    changed_at: datetime
