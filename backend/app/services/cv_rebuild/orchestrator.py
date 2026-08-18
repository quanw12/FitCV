"""Stateless orchestrator for the AI Rebuild CV pipeline.

Never touches the database or long-lived storage. Upload bytes are written to
a TemporaryDirectory only while the source file is parsed, then deleted.
"""

import base64
import logging
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf.errors import PdfReadError

from app.schemas.cv_rebuild import CVData, CvRebuildResponse
from app.services.cv_rebuild.avatar import maybe_downscale_avatar
from app.services.cv_rebuild.completeness import (
    backfill_cv,
    derive_baseline_from_text,
    detect_sections_in_text,
    _cv_dropped_content,
)
from app.services.cv_rebuild.language import cv_is_mixed, detect_cv_language
from app.services.cv_rebuild.llm_extractor import CvExtractor
from app.services.cv_rebuild.normalization import normalize_cv
from app.services.cv_rebuild.pdf_renderer import count_pdf_pages, render_pdf_with_thumbnail
from app.services.cv_rebuild.template_renderer import render_cv
from app.services.document_parser import extract_document_text, validate_cv_content

logger = logging.getLogger(__name__)

_MAX_MIXED_ATTEMPTS = 3

# Sections whose total loss during extraction is most damaging and worth a
# targeted re-extraction. Order matters only for the remediation message.
_SECTION_SAFETY_CHECKS = ("experience", "education", "projects")


def _extract_with_section_safety(
    cv_extractor: CvExtractor, raw_text: str
) -> CVData:
    """Extract a CV, then re-extract if a clearly-present section was dropped.

    The grounding/backfill safety net downstream compares the polished CV
    against the *extracted* baseline, so it cannot recover content the
    extraction step itself lost.  This catches that gap: if the raw text
    obviously signals a section (via a header) but the extracted CV has no
    entries for it, we re-extract once with an explicit remediation prompt.
    """
    extracted = normalize_cv(cv_extractor.extract(raw_text))
    present = detect_sections_in_text(raw_text)
    for _ in range(2):
        missing = [
            section
            for section in _SECTION_SAFETY_CHECKS
            if section in present and not getattr(extracted, section)
        ]
        if not missing:
            break
        extracted = normalize_cv(
            cv_extractor.extract(raw_text, missing_sections=missing)
        )
    return extracted


async def rebuild_cv(
    content: bytes,
    filename: str,
    *,
    extractor: CvExtractor | None = None,
    avatar: str | None = None,
    jd_text: str | None = None,
) -> CvRebuildResponse:
    file_type = validate_cv_content(filename, content)
    suffix = Path(filename).suffix.lower() or (
        ".pdf" if file_type == "PDF" else ".docx"
    )

    with TemporaryDirectory(prefix="fitcv-rebuild-") as directory:
        source_path = Path(directory) / f"uploaded{suffix}"
        source_path.write_bytes(content)
        try:
            raw_text = extract_document_text(source_path, file_type)
        except ValueError:
            raise
        except PdfReadError as exc:
            raise ValueError("The uploaded file is not a valid PDF.") from exc
        except Exception as exc:
            raise ValueError(f"Unable to read the CV file: {exc}") from exc

    cv_extractor = extractor or CvExtractor()
    extracted = _extract_with_section_safety(cv_extractor, raw_text)
    name = extracted.name
    language = detect_cv_language(extracted)
    warnings: list[str] = []

    # Baseline = original input. Enrich contact details by parsing the raw
    # text directly so a contact the LLM dropped during extraction is still
    # recovered deterministically.
    baseline = derive_baseline_from_text(raw_text)
    baseline_cv = extracted.model_copy(deep=True)
    if not baseline_cv.email and baseline.email:
        baseline_cv = baseline_cv.model_copy(update={"email": baseline.email})
    if not baseline_cv.phone and baseline.phone:
        baseline_cv = baseline_cv.model_copy(update={"phone": baseline.phone})
    if not baseline_cv.links and baseline.links:
        baseline_cv = baseline_cv.model_copy(update={"links": baseline.links})

    cv = extracted

    # Completeness guarantee: re-polish while the output drops content the
    # original clearly had. Bounded by _MAX_MIXED_ATTEMPTS; the deterministic
    # backfill below is the final hard safety net.
    for _ in range(_MAX_MIXED_ATTEMPTS):
        if not _cv_dropped_content(baseline_cv, cv):
            break
        cv, completeness_warnings = cv_extractor.polish(
            cv, language=language, jd_text=jd_text, baseline=baseline_cv
        )
        cv = normalize_cv(cv)
        warnings.extend(completeness_warnings)
        language = detect_cv_language(cv)
    else:
        # Still dropping content after max attempts — continue with backfill.
        pass

    # Mixed-language unification loop (gated on cv_is_mixed)
    for _ in range(_MAX_MIXED_ATTEMPTS):
        if not cv_is_mixed(cv):
            break
        cv, mixed_warnings = cv_extractor.polish(
            cv, language=language, jd_text=jd_text, baseline=baseline_cv
        )
        cv = normalize_cv(cv)
        warnings.extend(mixed_warnings)
        language = detect_cv_language(cv)
    else:
        # Still mixed after max attempts — continue with what we have
        pass

    # Deterministic backfill: re-inject any field the polished output lost.
    cv, backfill_warnings = backfill_cv(baseline_cv, cv)
    warnings.extend(backfill_warnings)

    # Backfill can re-add a skill already present in a group; re-normalize so
    # the Technical Skills section never renders a duplicate line.
    cv = normalize_cv(cv)

    cv = cv.model_copy(update={"name": name})
    avatar_data = maybe_downscale_avatar(avatar, warnings)
    html = render_cv(cv, language=language, avatar=avatar_data)
    pdf_bytes, thumbnail_bytes = await render_pdf_with_thumbnail(html)

    # Page count warning (A7)
    page_count = count_pdf_pages(pdf_bytes)
    if page_count > 1:
        warnings.append(
            f"The generated CV has {page_count} pages. "
            "Review the content to ensure nothing was unexpectedly split."
        )

    return CvRebuildResponse(
        filename="rebuilt_cv.pdf",
        preview_json=cv,
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        thumbnail_base64=base64.b64encode(thumbnail_bytes).decode("ascii"),
        warnings=warnings,
    )


async def rebuild_with_improvements(
    parsed_text: str,
    *,
    applied_improvements: str,
    jd_text: str | None = None,
    language: str | None = None,
    avatar: str | None = None,
    extractor: CvExtractor | None = None,
    allowed_new_skills: list[str] | None = None,
) -> CvRebuildResponse:
    """Rebuild a saved parsed CV after the owner chooses improvements.

    The saved parse is deliberately re-extracted and polished server-side.  This
    avoids trusting browser-provided CV data and keeps the existing grounding
    checks in :class:`CvExtractor` as the final guard against invented facts.
    ``allowed_new_skills`` lists candidate-approved skill-gap additions that the
    grounding check must not reject.
    """
    if not parsed_text or not parsed_text.strip():
        raise ValueError("CV parse text unavailable. Re-upload the CV and analyse again.")
    if not applied_improvements or not applied_improvements.strip():
        raise ValueError("Select at least one improvement before rebuilding the CV.")

    cv_extractor = extractor or CvExtractor()
    cv = _extract_with_section_safety(cv_extractor, parsed_text)
    name = cv.name
    original_cv = cv.model_copy(deep=True)
    output_language = language or detect_cv_language(cv)
    warnings: list[str] = []

    # Apply the approved instructions once even when the CV language is already
    # uniform. Any follow-up mixed-language pass receives the same instructions.
    # The baseline is the original parsed CV so grounding/polish never drifts
    # away from the source during retries.
    cv, polish_warnings = cv_extractor.polish(
        cv,
        language=output_language,
        jd_text=jd_text,
        applied_improvements=applied_improvements,
        baseline=original_cv,
        allowed_new_skills=allowed_new_skills,
    )
    cv = normalize_cv(cv)
    warnings.extend(polish_warnings)
    output_language = detect_cv_language(cv)

    for _ in range(_MAX_MIXED_ATTEMPTS):
        if not cv_is_mixed(cv):
            break
        cv, mixed_warnings = cv_extractor.polish(
            cv,
            language=output_language,
            jd_text=jd_text,
            applied_improvements=applied_improvements,
            baseline=original_cv,
            allowed_new_skills=allowed_new_skills,
        )
        cv = normalize_cv(cv)
        warnings.extend(mixed_warnings)
        output_language = detect_cv_language(cv)

    # Deterministic backfill of anything the polished output still lost.
    cv, backfill_warnings = backfill_cv(original_cv, cv)
    warnings.extend(backfill_warnings)

    # Backfill can re-add a skill already present in a group; re-normalize so
    # the Technical Skills section never renders a duplicate line.
    cv = normalize_cv(cv)

    cv = cv.model_copy(update={"name": name})
    avatar_data = maybe_downscale_avatar(avatar, warnings)
    html = render_cv(cv, language=output_language, avatar=avatar_data)
    pdf_bytes, thumbnail_bytes = await render_pdf_with_thumbnail(html)
    page_count = count_pdf_pages(pdf_bytes)
    if page_count > 1:
        warnings.append(
            f"The generated CV has {page_count} pages. "
            "Review the content to ensure nothing was unexpectedly split."
        )

    return CvRebuildResponse(
        filename="improved_cv.pdf",
        preview_json=cv,
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        thumbnail_base64=base64.b64encode(thumbnail_bytes).decode("ascii"),
        warnings=warnings,
    )


async def build_cv(
    cv: CVData,
    *,
    language: str = "en",
    avatar: str | None = None,
    extractor: CvExtractor | None = None,
    jd_text: str | None = None,
) -> CvRebuildResponse:
    """Build a CV from form data: AI-polish, then render as a PDF."""
    cv_extractor = extractor or CvExtractor()
    name = cv.name
    original_cv = cv.model_copy(deep=True)
    warnings: list[str] = []

    # cv_is_mixed retry loop. The user's selected language is the fixed authoring
    # target; we only use language detection to decide whether the mixed-language
    # loop should continue (never to override the user's chosen language).
    polished = cv
    for _ in range(_MAX_MIXED_ATTEMPTS):
        polished, polish_warnings = cv_extractor.polish(
            polished, language=language, jd_text=jd_text, baseline=original_cv
        )
        polished = normalize_cv(polished)
        warnings.extend(polish_warnings)
        if not cv_is_mixed(polished):
            break

    # Deterministic backfill of anything the polished output lost.
    polished, backfill_warnings = backfill_cv(original_cv, polished)
    warnings.extend(backfill_warnings)

    # Backfill can re-add a skill already present in a group; re-normalize so
    # the Technical Skills section never renders a duplicate line.
    polished = normalize_cv(polished)

    polished = polished.model_copy(update={"name": name})
    avatar_data = maybe_downscale_avatar(avatar, warnings)
    html = render_cv(polished, language=language, avatar=avatar_data)
    pdf_bytes, thumbnail_bytes = await render_pdf_with_thumbnail(html)

    # Page count warning (A7)
    page_count = count_pdf_pages(pdf_bytes)
    if page_count > 1:
        warnings.append(
            f"The generated CV has {page_count} pages. "
            "Review the content to ensure nothing was unexpectedly split."
        )

    return CvRebuildResponse(
        filename="built_cv.pdf",
        preview_json=polished,
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        thumbnail_base64=base64.b64encode(thumbnail_bytes).decode("ascii"),
        warnings=warnings,
    )
