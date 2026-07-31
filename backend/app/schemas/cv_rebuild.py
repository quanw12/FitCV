"""Pydantic schemas for the stateless AI Rebuild CV pipeline."""

from pydantic import BaseModel, Field


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
    skills: list[str] = Field(default_factory=list)
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
