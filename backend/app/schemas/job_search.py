from pydantic import BaseModel, Field


class JobSearchRequest(BaseModel):
    cv_id: int
    query: str | None = None
    location: str = "Remote"
    remote: str | None = None
    jobage: int = 30
    limit: int = Field(default=12, ge=1, le=20)


class JobSearchHit(BaseModel):
    id: str
    title: str
    company: str | None = None
    location: str | None = None
    date: str | None = None
    url: str
    matched_keywords: list[str] = []


class JobSearchResponse(BaseModel):
    query: str
    location: str
    results: list[JobSearchHit]
    note: str
