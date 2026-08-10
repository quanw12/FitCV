"""Deterministic ATS-safe post-processing of the LLM extraction output.

The prompt already asks for symbol-free text; this module is the second line
of defense so ATS parsers never have to read star ratings or decorative
symbols.
"""

import re

from app.schemas.cv_rebuild import (
    CVData,
    CvEducationItem,
    CvExperienceItem,
    CvLanguageItem,
    CvProjectItem,
    CvPublicationItem,
)
from app.services.cv_rebuild.language import detect_cv_language

_DECORATIVE_SYMBOLS = "★☆✦✧✪✫✬✭✮✯✰●○◐◑■□▲△▼▽◆◇►◄▪▫✔✓✕✖✗✘♥♦♣♠※†‡"
_SYMBOL_RE = re.compile(f"[{re.escape(_DECORATIVE_SYMBOLS)}]")
_WHITESPACE_RE = re.compile(r"\s+")

_FILLED_STARS = "★●■▲◆✔✓"
_EMPTY_STARS = "☆○□△◇"

_PROFICIENCY_EN = {
    5: "Native",
    4: "Fluent",
    3: "Intermediate",
    2: "Basic",
    1: "Beginner",
}
_PROFICIENCY_VI = {
    5: "Thành thạo",
    4: "Tốt",
    3: "Khá",
    2: "Cơ bản",
    1: "Sơ cấp",
}


def _strip_symbols(value: str) -> str:
    return _WHITESPACE_RE.sub(" ", _SYMBOL_RE.sub("", value)).strip()


def _count_filled_stars(value: str) -> int:
    return sum(1 for char in value if char in _FILLED_STARS)


def _normalize_proficiency(value: str, language: str) -> str:
    """Map a star/dot rating to a readable level.

    "★★★★☆" -> "Fluent" (en) / "Tốt" (vi)
    "★★★★☆ (IELTS 7.5)" -> "Fluent" (parenthetical detail is dropped)
    "Fluent" -> "Fluent" (no rating, left untouched)
    """
    value = value.strip()
    if not value:
        return ""
    has_rating = any(char in value for char in (_FILLED_STARS + _EMPTY_STARS))
    if not has_rating:
        return value
    filled = _count_filled_stars(value)
    table = _PROFICIENCY_VI if language == "vi" else _PROFICIENCY_EN
    level = table.get(min(filled, 5), "")
    if level:
        return level
    return _strip_symbols(value).strip("-():;,. ")


def _normalize_language(item: CvLanguageItem, language: str) -> CvLanguageItem:
    return item.model_copy(
        update={
            "name": _strip_symbols(item.name),
            "proficiency": _normalize_proficiency(item.proficiency, language),
        }
    )


def _normalize_experience(item: CvExperienceItem) -> CvExperienceItem:
    return item.model_copy(
        update={
            "title": _strip_symbols(item.title),
            "company": _strip_symbols(item.company),
            "location": _strip_symbols(item.location),
            "date": _strip_symbols(item.date),
            "bullets": [b for b in (_strip_symbols(b) for b in item.bullets) if b],
        }
    )


def _normalize_project(item: CvProjectItem) -> CvProjectItem:
    return item.model_copy(
        update={
            "name": _strip_symbols(item.name),
            "description": _strip_symbols(item.description),
            "bullets": [
                b for b in (_strip_symbols(b) for b in item.bullets) if b
            ],
            "links": [
                link.model_copy(
                    update={
                        "label": _strip_symbols(link.label),
                        "url": _WHITESPACE_RE.sub("", link.url or "").strip(),
                    }
                )
                for link in item.links
            ],
        }
    )


def _normalize_education(item: CvEducationItem) -> CvEducationItem:
    return item.model_copy(
        update={
            "degree": _strip_symbols(item.degree),
            "institution": _strip_symbols(item.institution),
            "date": _strip_symbols(item.date),
        }
    )


def _normalize_publication(item: CvPublicationItem) -> CvPublicationItem:
    return item.model_copy(
        update={
            "title": _strip_symbols(item.title),
            "venue": _strip_symbols(item.venue),
            "date": _strip_symbols(item.date),
        }
    )


def normalize_cv(cv: CVData) -> CVData:
    """Return a copy of ``cv`` with symbols removed and ratings spelled out."""
    language = detect_cv_language(cv)
    return cv.model_copy(
        update={
            "name": _strip_symbols(cv.name),
            "email": _strip_symbols(cv.email),
            "phone": _strip_symbols(cv.phone),
            "summary": _strip_symbols(cv.summary),
            "skills": [s for s in (_strip_symbols(s) for s in cv.skills) if s],
            "certifications": [
                c for c in (_strip_symbols(c) for c in cv.certifications) if c
            ],
            "awards": [a for a in (_strip_symbols(a) for a in cv.awards) if a],
            "languages": [
                _normalize_language(item, language) for item in cv.languages
            ],
            "experience": [
                _normalize_experience(item) for item in cv.experience
            ],
            "projects": [_normalize_project(item) for item in cv.projects],
            "education": [
                _normalize_education(item) for item in cv.education
            ],
            "publications": [
                _normalize_publication(item) for item in cv.publications
            ],
            "core_competencies": [
                item.model_copy(
                    update={
                        "name": _strip_symbols(item.name),
                        "description": _strip_symbols(item.description),
                    }
                )
                for item in cv.core_competencies
            ],
            "skill_groups": [
                group.model_copy(
                    update={
                        "category": _strip_symbols(group.category),
                        "items": [s for s in (_strip_symbols(s) for s in group.items) if s],
                    }
                )
                for group in cv.skill_groups
            ],
        }
    )
