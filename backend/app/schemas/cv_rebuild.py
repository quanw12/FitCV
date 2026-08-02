"""Pydantic schemas for the stateless AI Rebuild CV pipeline."""

from typing import Literal

from pydantic import BaseModel, Field

_MAX_AVATAR_CHARS = 7_000_000


def validate_avatar_data_url(avatar: str | None) -> str | None:
    """Validate an avatar data URL and return it (``None`` stays ``None``).

    Raises ``ValueError`` when the value is present but not an embeddable
    base64 image data URL.
    """
    if avatar is None:
        return None
    value = avatar.strip()
    if not value:
        return None
    if not (value.startswith("data:image/") and ";base64," in value):
        raise ValueError(
            "avatar must be a base64 image data URL (data:image/...;base64,...)."
        )
    if len(value) > _MAX_AVATAR_CHARS:
        raise ValueError("avatar image is too large.")
    return value


class CvExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    location: str = ""
    date: str = ""
    bullets: list[str] = Field(default_factory=list)


class CvLinkItem(BaseModel):
    label: str = ""
    url: str = ""


class CvProjectItem(BaseModel):
    name: str = ""
    description: str = ""
    links: list[CvLinkItem] = Field(default_factory=list)


class CvEducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    date: str = ""


class CvLanguageItem(BaseModel):
    name: str = ""
    proficiency: str = ""


class CvCompetencyItem(BaseModel):
    name: str = ""
    description: str = ""


class CvSkillGroup(BaseModel):
    category: str = ""
    items: list[str] = Field(default_factory=list)


class CvPublicationItem(BaseModel):
    title: str = ""
    venue: str = ""
    date: str = ""


class CVData(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    links: list[CvLinkItem] = Field(default_factory=list)
    summary: str = ""
    experience: list[CvExperienceItem] = Field(default_factory=list)
    core_competencies: list[CvCompetencyItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    skill_groups: list[CvSkillGroup] = Field(default_factory=list)
    projects: list[CvProjectItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    education: list[CvEducationItem] = Field(default_factory=list)
    languages: list[CvLanguageItem] = Field(default_factory=list)
    publications: list[CvPublicationItem] = Field(default_factory=list)
    awards: list[str] = Field(default_factory=list)


class CvRebuildResponse(BaseModel):
    filename: str = "rebuilt_cv.pdf"
    preview_json: CVData
    pdf_base64: str
    thumbnail_base64: str


class CvBuildRequest(BaseModel):
    cv: CVData = Field(default_factory=CVData)
    language: Literal["en", "vi"] = "en"
    avatar: str | None = Field(default=None, max_length=_MAX_AVATAR_CHARS)
