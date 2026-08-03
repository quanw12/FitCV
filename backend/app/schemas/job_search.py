from typing import Literal

from pydantic import BaseModel, Field


class JobSearchRequest(BaseModel):
    cv_id: int
    query: str | None = None
    location: str = "Remote"
    remote: str | None = None
    jobage: int = 30
    limit: int = Field(default=12, ge=1, le=20)
    level: str | None = None


class JobSearchHit(BaseModel):
    id: str
    title: str
    company: str | None = None
    location: str | None = None
    date: str | None = None
    url: str
    matched_keywords: list[str] = []
    seniority: str | None = None
    category: str | None = None
    source: Literal["linkedin", "freehire"]


class JobSearchResponse(BaseModel):
    query: str
    location: str
    results: list[JobSearchHit]
    note: str
    derived_by: Literal["ai", "deterministic"] = "deterministic"
    derived_level: str | None = None
