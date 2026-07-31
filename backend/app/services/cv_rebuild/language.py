"""Language detection for the rebuilt CV.

Only Vietnamese and English are supported. Vietnamese is detected from
diacritics that no other European language uses (ă, ơ, ư, đ and tone-marked
vowels), so a French or Spanish CV will not false-positive.
"""

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
