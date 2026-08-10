from datetime import datetime

from pydantic import BaseModel, Field

from app.models.improvement import AiTaskAttemptOutcome, AiTaskStatus


class AiTaskAttemptResponse(BaseModel):
    attempt_number: int
    outcome: AiTaskAttemptOutcome
    error_message: str
    failed_at: datetime

    model_config = {"from_attributes": True}


class AiTaskResponse(BaseModel):
    ai_task_id: int
    task_type: str
    resource_id: int
    status: AiTaskStatus
    attempt_count: int
    max_attempts: int
    available_at: datetime
    error_message: str | None = None
    attempt_history: list[AiTaskAttemptResponse] = Field(default_factory=list)
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    heartbeat_at: datetime | None = None

    model_config = {"from_attributes": True}
