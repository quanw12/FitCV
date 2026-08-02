"""Language detection for the rebuilt CV.

Only Vietnamese and English are supported. Vietnamese is detected from
tone-marked vowels and consonants that no other European language uses
(ă, ơ, ư, đ and the Vietnamese-only tone forms such as ế, ố, ừ, ạ), so a
French or Spanish CV will not false-positive.
"""

from app.schemas.cv_rebuild import CVData

_VIETNAMESE_ONLY_CHARS = frozenset(
    "ạảã"
    "ăắằẳẵặ"
    "âấầẩẫậ"
    "ẻẽẹ"
    "ếềểễệ"
    "ỉĩị"
    "ỏọ"
    "ốồổỗộ"
    "ơớờởỡợ"
    "ủũụ"
    "ưứừửữự"
    "ỳỷỹỵ"
    "đ"
)

_VIETNAMESE_HITS_REQUIRED = 3


def detect_language(text: str) -> str:
    """Return ``"vi"`` when ``text`` is clearly Vietnamese, else ``"en"``."""
    if not text:
        return "en"
    lower = text.lower()
    hits = sum(1 for char in lower if char in _VIETNAMESE_ONLY_CHARS)
    return "vi" if hits >= _VIETNAMESE_HITS_REQUIRED else "en"


def detect_cv_language(cv: CVData) -> str:
    """Detect the dominant language of the extracted CV content.

    Runs on the LLM output (already unified into one language), not on the raw
    source text, so section headings always match the body language even when
    the original document mixed languages or carried a Vietnamese name or
    address inside an otherwise English CV.
    """
    parts: list[str] = []
    if cv.summary:
        parts.append(cv.summary)
    parts.extend(cv.skills or [])
    for group in cv.skill_groups:
        parts.extend(group.items or [])
    for item in cv.core_competencies:
        parts.append(item.name or "")
        parts.append(item.description or "")
    for item in cv.experience:
        parts.extend(item.bullets or [])
    for project in cv.projects:
        if project.description:
            parts.append(project.description)
    parts.extend(cv.certifications or [])
    for entry in cv.education:
        parts.append(entry.degree or "")
    return detect_language(" ".join(parts))


def _language_bearing_fields(cv: CVData):
    """Yield the prose fields that carry language evidence.

    Skills, tool names, company names, locations, and proper nouns stay in
    their original form even on a fully translated CV, so they are excluded.
    """
    if cv.summary:
        yield cv.summary
    for item in cv.experience:
        yield item.title or ""
        yield from item.bullets or []
    for project in cv.projects:
        yield project.description or ""
    for item in cv.core_competencies:
        yield item.description or ""
    for entry in cv.education:
        yield entry.degree or ""


def cv_is_mixed(cv: CVData) -> bool:
    """Return ``True`` when the CV mixes clearly Vietnamese and English prose.

    Used after the LLM step: a mixed result means the model did not unify the
    language, so the pipeline asks it to polish the CV once more into the
    dominant language.
    """
    has_vietnamese = False
    has_english = False
    for field in _language_bearing_fields(cv):
        if not field.strip():
            continue
        if detect_language(field) == "vi":
            has_vietnamese = True
        else:
            has_english = True
        if has_vietnamese and has_english:
            return True
    return False
