"""Deterministic completeness backfill for the CV rebuild pipeline.

The LLM step can occasionally drop a contact detail, a whole section, or a
single skill even when the source clearly contains it.  The grounding guards
in :mod:`grounding` retry the LLM when this happens, but as a hard, fully
deterministic safety net this module re-injects any content the polished
output lost relative to the original input.

All merges are **additive only**: raw input is never used to overwrite
LLM-polished wording, so this cannot invent or distort facts.
"""

import re

from app.schemas.cv_rebuild import CVData

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_URL_RE = re.compile(r"https?://[^\s)>\]]+")
_SECTION_HEADERS = {
    "experience": ("experience", "work", "employment", "professional background"),
    "projects": ("projects", "project", "personal project"),
    "education": ("education", "academic", "university", "school"),
    "skills": ("skills", "technical skills", "competencies", "tech stack"),
    "certifications": ("certification", "certificate", "credential"),
    "publications": ("publication", "research", "paper"),
    "awards": ("award", "honor", "achievement", "scholarship"),
    "languages": ("languages", "language", "fluency"),
}


def detect_sections_in_text(raw_text: str) -> set[str]:
    """Detect which CV sections the raw text clearly signals via headers.

    Used to catch extraction-level drops: if a section the source obviously
    contains is missing from the extracted CV, the pipeline can re-extract with
    a targeted remediation prompt instead of silently losing the content.
    """
    text = (raw_text or "").lower()
    found = set()
    for section, keywords in _SECTION_HEADERS.items():
        for kw in keywords:
            pattern = (
                r"(?:^|[\n\r]|(?<=\s))"
                + re.escape(kw)
                + r"(?=[\s:.(\-]|$)"
            )
            if re.search(pattern, text):
                found.add(section)
                break
    return found


def _norm_url(url: str) -> str:
    return (url or "").strip().lower().rstrip("/")


def _skill_count(cv: CVData) -> int:
    return len(cv.skills or []) + sum(
        len(group.items or []) for group in cv.skill_groups
    )


def derive_baseline_from_text(raw_text: str) -> CVData:
    """Best-effort baseline of contact details parsed directly from raw text.

    Only contact fields that survive simple regex extraction are populated;
    every other field is left empty.  The structured sections come from the
    LLM extraction step instead (see :func:`backfill_cv`).  Parsing straight
    from the source means a contact detail the LLM dropped during extraction
    is still recovered deterministically.
    """
    text = raw_text or ""
    email = ""
    match = _EMAIL_RE.search(text)
    if match:
        email = match.group(0)
    phone = ""
    phone_match = re.search(r"(?:\+?\d[\d\s().\-]{7,}\d)", text)
    if phone_match:
        candidate = phone_match.group(0).strip()
        # Ignore numbers that are clearly years / dates.
        digits = re.sub(r"\D", "", candidate)
        if 7 <= len(digits) <= 15:
            phone = candidate
    links = []
    seen_urls: set[str] = set()
    for url in _URL_RE.findall(text):
        norm = _norm_url(url)
        if norm in seen_urls:
            continue
        seen_urls.add(norm)
        label = "Link"
        low = url.lower()
        if "linkedin" in low:
            label = "LinkedIn"
        elif "github" in low:
            label = "GitHub"
        elif "portfolio" in low or "personal" in low:
            label = "Portfolio"
        links.append({"label": label, "url": url})
    return CVData(
        email=email,
        phone=phone,
        links=links,  # type: ignore[arg-type]
    )


def _cv_dropped_content(original: CVData, built: CVData) -> bool:
    """Return ``True`` when ``built`` is missing content ``original`` has."""
    if original.email and not built.email:
        return True
    if original.phone and not built.phone:
        return True
    if original.links and not built.links:
        return True
    if original.summary and not built.summary:
        return True
    if len(original.experience) > len(built.experience):
        return True
    if len(original.projects) > len(built.projects):
        return True
    if len(original.education) > len(built.education):
        return True
    if len(original.languages) > len(built.languages):
        return True
    if len(original.publications) > len(built.publications):
        return True
    if len(original.awards) > len(built.awards):
        return True
    if len(original.certifications) > len(built.certifications):
        return True
    if len(original.skill_groups) > len(built.skill_groups):
        return True
    if _skill_count(original) > _skill_count(built):
        return True
    return False


def backfill_cv(original: CVData, built: CVData) -> tuple[CVData, list[str]]:
    """Re-inject content ``built`` dropped relative to ``original``.

    Returns the merged :class:`CVData` and a list of human-readable warnings
    describing what was restored, so the UI review banner can explain it.
    Every change is additive: polished wording is never overwritten with raw
    input.
    """
    warnings: list[str] = []
    updated = built.model_copy(deep=True)

    # --- Scalars (contacts / name / summary) -------------------------------
    if original.email and not updated.email:
        updated.email = original.email
        warnings.append(f"Restored email from your input: {original.email}")
    if original.phone and not updated.phone:
        updated.phone = original.phone
        warnings.append(f"Restored phone from your input: {original.phone}")
    if original.name and not updated.name:
        updated.name = original.name

    # --- Links -------------------------------------------------------------
    existing_urls = {_norm_url(link.url) for link in updated.links}
    for link in original.links:
        norm = _norm_url(link.url)
        if norm and norm not in existing_urls:
            updated.links.append(link.model_copy())
            existing_urls.add(norm)
            warnings.append(f"Restored link: {link.label or link.url}")

    # --- List-of-object sections (re-append missing identities) ------------
    def _reappend(attr: str, identity, label: str) -> None:
        nonlocal updated
        orig_items = list(getattr(original, attr) or [])
        if not orig_items:
            return
        built_items = list(getattr(updated, attr) or [])
        built_identities = {identity(item) for item in built_items}
        added = False
        for item in orig_items:
            ident = identity(item)
            if ident and ident not in built_identities:
                built_items.append(item.model_copy())
                built_identities.add(ident)
                added = True
        if added:
            updated = updated.model_copy(
                update={attr: built_items}  # type: ignore[arg-type]
            )
            warnings.append(f"Restored missing entries in {label}.")

    _reappend(
        "experience",
        lambda i: f"{(i.company or '').strip().lower()}|{(i.title or '').strip().lower()}",
        "experience",
    )
    _reappend(
        "projects",
        lambda i: (i.name or "").strip().lower(),
        "projects",
    )
    _reappend(
        "education",
        lambda i: f"{(i.institution or '').strip().lower()}|{(i.degree or '').strip().lower()}",
        "education",
    )
    _reappend(
        "languages",
        lambda i: (i.name or "").strip().lower(),
        "languages",
    )
    _reappend(
        "publications",
        lambda i: f"{(i.title or '').strip().lower()}|{(i.venue or '').strip().lower()}",
        "publications",
    )
    _reappend(
        "awards",
        lambda i: (i or "").strip().lower(),
        "awards",
    )
    _reappend(
        "certifications",
        lambda i: (i or "").strip().lower(),
        "certifications",
    )

    # --- Skills (flat list + groups) ---------------------------------------
    built_skill_set = {s.lower() for s in updated.skills}
    for group in updated.skill_groups:
        built_skill_set |= {s.lower() for s in group.items}
    for skill in original.skills:
        if skill and skill.lower() not in built_skill_set:
            updated.skills.append(skill)
            built_skill_set.add(skill.lower())
            warnings.append(f"Restored skill: {skill}")
    existing_groups = {
        g.category.strip().lower() for g in updated.skill_groups
    }
    for group in original.skill_groups:
        if group.category and group.category.strip().lower() not in existing_groups:
            updated.skill_groups.append(group.model_copy())
            existing_groups.add(group.category.strip().lower())
            warnings.append(f"Restored skill group: {group.category}")

    # --- Summary ------------------------------------------------------------
    if not updated.summary and original.summary:
        updated.summary = original.summary
        warnings.append("Restored professional summary.")

    return updated, warnings
