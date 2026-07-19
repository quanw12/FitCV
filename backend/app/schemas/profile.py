from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.models.account import AccountRole, AuthProvider


class CompanySummary(BaseModel):
    company_id: int
    company_name: str
    industry_id: int | None = None
    industry_name: str | None = None
    website_url: str | None = None
    logo_url: str | None = None


class ProfileResponse(BaseModel):
    account_id: int
    email: str
    full_name: str
    role: AccountRole | None
    avatar_url: str | None
    auth_provider: AuthProvider
    created_at: datetime
    updated_at: datetime | None
    phone: str | None = None
    company: CompanySummary | None = None


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    avatar_url: HttpUrl | None = Field(default=None, max_length=400)
    phone: str | None = Field(default=None, max_length=30)
    company_name: str | None = Field(default=None, max_length=200)
    industry_name: str | None = Field(default=None, max_length=100)
    company_website_url: HttpUrl | None = Field(default=None, max_length=300)
    company_logo_url: HttpUrl | None = Field(default=None, max_length=400)

    @field_validator("full_name", "phone", "company_name", "industry_name", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("avatar_url", "company_website_url", "company_logo_url", mode="before")
    @classmethod
    def clean_url(cls, value: object) -> object:
        return value.strip() or None if isinstance(value, str) else value
