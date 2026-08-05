from datetime import datetime

from pydantic import BaseModel

from app.models.improvement import AiTaskStatus


class AiTaskResponse(BaseModel):
    ai_task_id: int
    task_type: str
    resource_id: int
    status: AiTaskStatus
    attempt_count: int
    max_attempts: int
    available_at: datetime
    error_message: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    heartbeat_at: datetime | None = None

    model_config = {"from_attributes": True}
