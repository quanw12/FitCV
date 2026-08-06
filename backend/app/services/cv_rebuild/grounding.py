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
_TOKEN_RE = re.compile(r"[\w.#+]+")

_STOPWORDS = {
    "and", "or", "of", "for", "with", "the", "a", "an", "to", "in", "on", "at",
    "by", "is", "are", "va", "và", "hoặc", "các", "cùng", "với",
}

_SUFFIXES = ("tion", "ment", "ness", "ible", "able", "ing", "ful", "ous", "ive", "ly", "er", "ed", "es", "s")


def _normalize_token(token: str) -> str:
    """Strip common English suffixes for singular/plural tolerance."""
    lower = token.lower().rstrip(".#")
    for suffix in _SUFFIXES:
        if lower.endswith(suffix) and len(lower) - len(suffix) >= 3:
            return lower[: -len(suffix)]
    return lower


def _tokenize(text: str) -> list[str]:
    if not text:
        return []
    return [
        token
        for token in _TOKEN_RE.findall(text.lower())
        if len(token) >= 2 and token not in _STOPWORDS
    ]


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
        parts.extend(project.bullets or [])
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


def _skill_terms(cv: CVData) -> list[str]:
    """Yield every skill/competency label of ``cv``."""
    terms: list[str] = list(cv.skills or [])
    for group in cv.skill_groups:
        terms.extend(group.items or [])
    for item in cv.core_competencies:
        if item.name:
            terms.append(item.name)
    return terms


def find_unfounded_skills(source_text: str, cv: CVData) -> list[str]:
    """Return skills/competencies in ``cv`` that ``source_text`` does not mention.

    Uses word-boundary tokenization (no substring matching — "React" is NOT
    grounded just because "React Native" appears).  Case-insensitive with
    singular/plural tolerance via suffix stripping.  A skill token is grounded
    if the normalised form appears in *any* field of the source text.
    """
    source_keys: set[str] = set()
    for token in _tokenize(source_text):
        source_keys.add(_normalize_token(token))
    unfounded: set[str] = set()
    for term in _skill_terms(cv):
        tokens = _tokenize(term)
        if not tokens:
            continue
        if not any(_normalize_token(token) in source_keys for token in tokens):
            unfounded.add(term)
    return sorted(unfounded)


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


def find_title_inflation(entered: CVData, polished: CVData) -> list[str]:
    """Detect experience titles that were inflated or fabricated.

    Matches entered and polished entries by company name (case-insensitive),
    then compares titles.  This is robust against LLM reordering entries.

    Two cases are flagged:
    1. Inflation: entered has a title, polished changed it to something else.
    2. Fabrication: entered title is empty, polished invented a professional
       title (Researcher, Contributor, Engineer, etc.) — this must not happen.
    """
    # Common professional role words that should NOT be fabricated.
    _FABRICATED_TITLE_WORDS = frozenset({
        "researcher", "contributor", "collaborator", "specialist",
        "analyst", "engineer", "lead", "developer", "intern",
        "assistant", "associate", "consultant", "manager", "director",
        "scientist", "architect", "coordinator", "supervisor",
        "member", "participant", "volunteer",
    })

    # Build a lookup from entered: company_lower -> list of orig titles
    entered_by_company: dict[str, list[str]] = {}
    for item in entered.experience:
        company_key = (item.company or "").strip().lower()
        if company_key:
            entered_by_company.setdefault(company_key, []).append(
                (item.title or "").strip()
            )

    inflated: list[str] = []
    for new_item in polished.experience:
        company_key = (new_item.company or "").strip().lower()
        if not company_key or company_key not in entered_by_company:
            continue
        new_title = (new_item.title or "").strip()
        # Pop the first matching orig title (handles duplicate companies)
        orig_titles = entered_by_company[company_key]
        if not orig_titles:
            continue
        orig_title = orig_titles.pop(0)

        # --- CASE 1: Fabrication — entered title is empty but LLM invented one
        if not orig_title and new_title:
            # Check if the fabricated title contains a common role word
            words_in_title = set(new_title.lower().replace("-", " ").split())
            if words_in_title & _FABRICATED_TITLE_WORDS:
                inflated.append(
                    f"\"\" -> \"{new_title}\" (company: {new_item.company}) "
                    f"[fabricated title from empty input]"
                )
                continue

        # --- CASE 2: Inflation — entered title was changed
        if orig_title and orig_title != new_title:
            if orig_title.lower() != new_title.lower():
                inflated.append(
                    f"\"{orig_title}\" -> \"{new_title}\" "
                    f"(company: {new_item.company})"
                )
    return inflated


_ENTRY_COUNT_SECTIONS = frozenset({"experience", "projects", "education"})


def find_missing_sections(entered: CVData, output: CVData) -> list[str]:
    """Return sections/fields present in ``entered`` but missing in ``output``.

    Checks section-level drops, entry-count merges, field-level bullet drops,
    and education numeric-detail loss.  Sections derived from the input
    (core_competencies, skill_groups) are not checked.
    """
    missing: list[str] = []
    for name, has_content in _SECTION_HAS_CONTENT.items():
        if has_content(entered) and not has_content(output):
            missing.append(name)
    counts = _SECTION_COUNTS(entered)
    output_counts = _SECTION_COUNTS(output)
    for name, entered_count in counts.items():
        if name not in missing and entered_count and output_counts[name] < entered_count:
            missing.append(name)

    # Entry-count merge detection: flag when output has fewer entries than
    # entered for list-of-objects sections (experience, projects, education).
    # Remove the generic section label when the more specific merged_* label
    # is added, so the LLM receives the actionable count message instead.
    for section in _ENTRY_COUNT_SECTIONS:
        e_count = len(getattr(entered, section) or [])
        o_count = len(getattr(output, section) or [])
        if e_count and o_count and o_count < e_count:
            label = f"merged_{section}"
            if section in missing:
                missing.remove(section)
            if label not in missing:
                missing.append(label)

    # Entry-level bullet count comparison for experience
    for i, (e_item, o_item) in enumerate(
        zip(entered.experience, output.experience)
    ):
        e_bullets = len(e_item.bullets or [])
        o_bullets = len(o_item.bullets or [])
        if e_bullets and o_bullets < e_bullets:
            label = f"experience[{i}].bullets"
            if label not in missing:
                missing.append(label)

    # Entry-level bullet count comparison for projects
    for i, (e_proj, o_proj) in enumerate(
        zip(entered.projects, output.projects)
    ):
        e_bullets = len(e_proj.bullets or [])
        o_bullets = len(o_proj.bullets or [])
        if e_bullets and o_bullets < e_bullets:
            label = f"projects[{i}].bullets"
            if label not in missing:
                missing.append(label)

    # Education: detect lost numeric content (GPA, test scores)
    for i, (e_edu, o_edu) in enumerate(
        zip(entered.education, output.education)
    ):
        e_text = f"{e_edu.degree} {e_edu.institution} {e_edu.date}"
        o_text = f"{o_edu.degree} {o_edu.institution} {o_edu.date}"
        e_nums = set(_NUMBER_RE.findall(e_text))
        o_nums = set(_NUMBER_RE.findall(o_text))
        lost = e_nums - o_nums
        if lost and not o_nums:
            label = f"education[{i}].numeric"
            if label not in missing:
                missing.append(label)

    return missing


def _SECTION_COUNTS(cv: CVData) -> dict[str, int]:
    return {
        "summary": len(cv.summary or ""),
        "experience": len(cv.experience or []),
        "experience bullets": sum(len(e.bullets or []) for e in cv.experience),
        "projects": len(cv.projects or []),
        "project bullets": sum(len(p.bullets or []) for p in cv.projects),
        "education": len(cv.education or []),
        "languages": len(cv.languages or []),
        "skills": len(cv.skills or []),
        "certifications": len(cv.certifications or []),
        "publications": len(cv.publications or []),
        "awards": len(cv.awards or []),
    }


# Common action verbs in present tense (base form) — used by verb tense guard.
# If a bullet or description line starts with one of these, it's likely
# present tense and should be past tense for completed work.
_PRESENT_TENSE_VERBS = frozenset({
    "build", "design", "implement", "engineer", "develop", "deliver",
    "deploy", "lead", "manage", "create", "optimize", "architect",
    "contribute", "collaborate", "participate", "establish", "launch",
    "architect", "automate", "integrate", "migrate", "refactor",
    "configure", "debug", "test", "analyze", "research", "mentor",
    "coordinate", "present", "author", "earn", "combine", "reduce",
    "increase", "improve", "enhance", "streamline", "standardize",
    "supervise", "facilitate", "negotiate", "acquire", "spearhead",
    "champion", "pioneer", "initiate", "execute", "produce",
})


def find_verb_tense_issues(cv: CVData) -> list[str]:
    """Detect present-tense verbs at the start of bullets/descriptions.

    Returns a list of strings like "experience[0].bullets[1]: 'Build a ...'"
    for each line that starts with a present-tense verb.  Empty list means
    no tense issues found.
    """
    issues: list[str] = []

    def _check_line(text: str, location: str) -> None:
        text = text.strip()
        if not text:
            return
        # Extract the first word (strip leading special chars like bullets markers)
        first_word = ""
        for ch in text:
            if ch.isalpha():
                break
            # skip bullet markers like "-", "•", "*", numbers + "."
        # Get first alphabetic word
        words = text.split()
        if not words:
            return
        # Skip non-alpha leading tokens (e.g. "1.", "-", "•")
        for w in words:
            cleaned = re.sub(r"[^a-zA-Z]", "", w).lower()
            if cleaned:
                first_word = cleaned
                break
        if first_word in _PRESENT_TENSE_VERBS:
            issues.append(f"{location}: '{text[:80]}'")

    # Check experience bullets and descriptions
    for i, item in enumerate(cv.experience):
        for j, bullet in enumerate(item.bullets or []):
            _check_line(bullet, f"experience[{i}].bullets[{j}]")
        # Check title line (rare, but possible)

    # Check project descriptions and bullets
    for i, proj in enumerate(cv.projects):
        _check_line(proj.description, f"projects[{i}].description")
        for j, bullet in enumerate(proj.bullets or []):
            _check_line(bullet, f"projects[{i}].bullets[{j}]")

    # Check core_competency descriptions
    for i, comp in enumerate(cv.core_competencies):
        _check_line(comp.description, f"core_competencies[{i}].description")

    # Check summary
    if cv.summary:
        _check_line(cv.summary, "summary")

    return issues


# ---------------------------------------------------------------------------
# Project description / bullet overlap guard
# ---------------------------------------------------------------------------

def _normalize_words(text: str) -> set[str]:
    """Lowercase, strip punctuation, return set of words (min length 2)."""
    import re
    words = re.findall(r"[a-z0-9]{2,}", text.lower())
    return set(words)


def find_project_description_overlap(
    cv: CVData,
    threshold: float = 0.60,
) -> list[str]:
    """Detect when a project's first bullet is nearly identical to its description.

    Uses Jaccard similarity on word sets.  When the first bullet reuses ≥
    *threshold* fraction of the description words the LLM has likely just
    "expanded" the description into a bullet instead of writing a distinct
    line.  Returns a list of diagnostic labels such as
    ``"projects[0].bullets[0] ~78% overlap with description"``.
    """
    issues: list[str] = []
    for i, proj in enumerate(cv.projects):
        desc = (proj.description or "").strip()
        bullets = proj.bullets or []
        if not desc or not bullets:
            continue
        desc_words = _normalize_words(desc)
        if len(desc_words) < 4:
            continue
        bullet_words = _normalize_words(bullets[0])
        if not bullet_words:
            continue
        intersection = desc_words & bullet_words
        union = desc_words | bullet_words
        jaccard = len(intersection) / len(union) if union else 0.0
        if jaccard >= threshold:
            issues.append(
                f"projects[{i}].bullets[0] ~{int(jaccard * 100)}% "
                f"overlap with description"
            )
    return issues
