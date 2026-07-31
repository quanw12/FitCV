"""Pydantic schemas for the stateless AI Rebuild CV pipeline."""

from pydantic import BaseModel, Field


class CvExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    date: str = ""
    bullets: list[str] = Field(default_factory=list)


class CvProjectItem(BaseModel):
    name: str = ""
    description: str = ""


class CvEducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    date: str = ""


class CVData(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    summary: str = ""
    experience: list[CvExperienceItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    projects: list[CvProjectItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    education: list[CvEducationItem] = Field(default_factory=list)


class CvRebuildResponse(BaseModel):
    filename: str = "rebuilt_cv.pdf"
    preview_json: CVData
    pdf_base64: str
    thumbnail_base64: str
