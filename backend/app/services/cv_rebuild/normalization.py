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


def _dedupe_key(value: str) -> str:
    """Case/space-insensitive identity used to detect duplicate skills."""

    return _WHITESPACE_RE.sub(" ", value).strip().lower()


def _dedupe_skill_groups(groups):
    """Return groups with duplicate items removed within and across groups.

    Items already seen in a previous group are dropped so the same skill never
    repeats across category lines.  Repeated category labels are merged into the
    first occurrence (items appended, still de-duplicated) so no skill and no
    category heading is lost.
    """

    seen_items: set[str] = set()
    merged: dict[str, int] = {}
    cleaned = []
    for group in groups:
        category = _strip_symbols(group.category)
        if not category:
            continue
        cat_key = _dedupe_key(category)
        items = []
        for item in group.items:
            clean = _strip_symbols(item)
            if not clean:
                continue
            key = _dedupe_key(clean)
            if key in seen_items:
                continue
            seen_items.add(key)
            items.append(clean)
        if not items:
            continue
        if cat_key in merged:
            index = merged[cat_key]
            existing = cleaned[index]
            cleaned[index] = existing.model_copy(
                update={"items": list(existing.items) + items}
            )
            continue
        built = group.model_copy(update={"category": category, "items": items})
        merged[cat_key] = len(cleaned)
        cleaned.append(built)
    return cleaned


def _flat_skill_already_in_groups(skill_key: str, grouped_text: list[str]) -> bool:
    """True when ``skill_key`` already appears as a whole word inside a group
    item.  Group items often bundle several skills into one string (e.g.
    ``"Python (Pandas, NumPy, Matplotlib)"``), so a flat skill like ``"Python"``
    must not be re-listed on its own line just because it is not an exact match.
    """

    pattern = r"(?<![\w])" + re.escape(skill_key) + r"(?![\w])"
    return any(re.search(pattern, text) for text in grouped_text)


def _dedupe_flat_skills(skills, occupied: set[str], grouped_text: list[str]):
    """Return ``skills`` with duplicates removed and any already represented
    inside skill groups excluded (exact match *or* whole-word match inside a
    grouped item string)."""

    seen: set[str] = set()
    cleaned = []
    for skill in skills:
        clean = _strip_symbols(skill)
        if not clean:
            continue
        key = _dedupe_key(clean)
        if key in seen or key in occupied:
            continue
        if _flat_skill_already_in_groups(key, grouped_text):
            continue
        seen.add(key)
        cleaned.append(clean)
    return cleaned


def normalize_cv(cv: CVData) -> CVData:
    """Return a copy of ``cv`` with symbols removed and ratings spelled out.

    Skills are also de-duplicated: a skill never appears twice across the flat
    ``skills`` list and the ``skill_groups`` items, which prevents the
    Technical Skills section from rendering a repeated extra line.
    """
    language = detect_cv_language(cv)
    skill_groups = _dedupe_skill_groups(cv.skill_groups)
    grouped_keys = {
        _dedupe_key(item) for group in skill_groups for item in group.items
    }
    grouped_text = [
        _dedupe_key(item) for group in skill_groups for item in group.items
    ]
    return cv.model_copy(
        update={
            "name": _strip_symbols(cv.name),
            "email": _strip_symbols(cv.email),
            "phone": _strip_symbols(cv.phone),
            "summary": _strip_symbols(cv.summary),
            "skills": _dedupe_flat_skills(cv.skills, grouped_keys, grouped_text),
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
            "skill_groups": skill_groups,
        }
    )
