"""Language detection for the rebuilt CV.

Only Vietnamese and English are supported. Vietnamese is detected from
diacritics that no other European language uses (ă, ơ, ư, đ and tone-marked
vowels), so a French or Spanish CV will not false-positive.
"""

from app.schemas.cv_rebuild import CVData

_VIETNAMESE_ONLY_CHARS = frozenset(
    "ăăắằẳẵặâấầẩẫậđơớờởỡợưứừửữự"
    "ạảẽịọụỵặậỉộỗớựỳỷỹ"
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
    for item in cv.experience:
        parts.extend(item.bullets or [])
    for project in cv.projects:
        if project.description:
            parts.append(project.description)
    parts.extend(cv.certifications or [])
    for entry in cv.education:
        parts.append(entry.degree or "")
    return detect_language(" ".join(parts))
