"""Grounding guard: reject numbers the entered form data does not state.

The AI is asked to paraphrase the build-form CV into more impressive wording.
This module keeps that paraphrasing honest: every number or metric in the AI
output must also appear in the entered form data. Contact fields (email,
phone, links) are excluded because their formatting legitimately differs
between source and output.
"""

import re

from app.schemas.cv_rebuild import CVData

_THOUSANDS_SEPARATOR_RE = re.compile(r"(?<=\d)[.,](?=\d{3}(?!\d))")
_DECIMAL_COMMA_RE = re.compile(r"(?<=\d),(?=\d)")
_NUMBER_RE = re.compile(r"\d+")


def _numeric_tokens(text: str) -> set[str]:
    """Return the digit runs in ``text``, tolerating formatting differences.

    "1,000" and "1000" both yield {"1000"}; "2,5" and "2.5" both yield
    {"2", "5"}.
    """
    if not text:
        return set()
    normalized = _THOUSANDS_SEPARATOR_RE.sub("", text)
    normalized = _DECIMAL_COMMA_RE.sub(".", normalized)
    return set(_NUMBER_RE.findall(normalized))


def _cv_number_parts(cv: CVData) -> list[str]:
    """Yield every number-bearing field of ``cv`` except contact data."""
    parts: list[str] = [cv.name or "", cv.summary or ""]
    parts.extend(cv.skills or [])
    for group in cv.skill_groups:
        parts.append(group.category or "")
        parts.extend(group.items or [])
    for item in cv.core_competencies:
        parts.append(item.name or "")
        parts.append(item.description or "")
    for item in cv.experience:
        parts.append(item.title or "")
        parts.append(item.company or "")
        parts.append(item.location or "")
        parts.append(item.date or "")
        parts.extend(item.bullets or [])
    for project in cv.projects:
        parts.append(project.name or "")
        parts.append(project.description or "")
    parts.extend(cv.certifications or [])
    for entry in cv.education:
        parts.append(entry.degree or "")
        parts.append(entry.institution or "")
        parts.append(entry.date or "")
    for item in cv.languages:
        parts.append(item.name or "")
        parts.append(item.proficiency or "")
    for publication in cv.publications:
        parts.append(publication.title or "")
        parts.append(publication.venue or "")
        parts.append(publication.date or "")
    parts.extend(cv.awards or [])
    return parts


def find_unfounded_numbers(source_text: str, cv: CVData) -> list[str]:
    """Return the numeric tokens of ``cv`` that ``source_text`` does not state.

    An empty list means the CV output is fully grounded in the source.
    """
    source_tokens = _numeric_tokens(source_text)
    output_tokens: set[str] = set()
    for part in _cv_number_parts(cv):
        output_tokens |= _numeric_tokens(part)
    return sorted(token for token in output_tokens if token not in source_tokens)


_SECTION_HAS_CONTENT = {
    "summary": lambda cv: bool(cv.summary),
    "experience": lambda cv: bool(cv.experience),
    "projects": lambda cv: bool(cv.projects),
    "education": lambda cv: bool(cv.education),
    "languages": lambda cv: bool(cv.languages),
    "skills": lambda cv: bool(cv.skills),
    "certifications": lambda cv: bool(cv.certifications),
    "publications": lambda cv: bool(cv.publications),
    "awards": lambda cv: bool(cv.awards),
}


def find_missing_sections(entered: CVData, output: CVData) -> list[str]:
    """Return sections present in ``entered`` but empty in ``output``.

    The polish step may drop a whole section; this guard catches that before
    the PDF is rendered. Sections derived from the input (core_competencies,
    skill_groups) are not checked.
    """
    missing: list[str] = []
    for name, has_content in _SECTION_HAS_CONTENT.items():
        if has_content(entered) and not has_content(output):
            missing.append(name)
    return missing
