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
from app.services.cv_rebuild.language import cv_is_mixed, detect_cv_language
from app.services.cv_rebuild.llm_extractor import CvExtractor
from app.services.cv_rebuild.normalization import normalize_cv
from app.services.cv_rebuild.pdf_renderer import count_pdf_pages, render_pdf_with_thumbnail
from app.services.cv_rebuild.template_renderer import render_cv
from app.services.document_parser import extract_document_text, validate_cv_content

logger = logging.getLogger(__name__)

_MAX_MIXED_ATTEMPTS = 3


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
    cv = normalize_cv(cv_extractor.extract(raw_text))
    name = cv.name
    language = detect_cv_language(cv)
    warnings: list[str] = []

    # cv_is_mixed retry loop
    for _ in range(_MAX_MIXED_ATTEMPTS):
        if not cv_is_mixed(cv):
            break
        cv, mixed_warnings = cv_extractor.polish(cv, language=language, jd_text=jd_text)
        cv = normalize_cv(cv)
        warnings.extend(mixed_warnings)
        language = detect_cv_language(cv)
    else:
        # Still mixed after max attempts — continue with what we have
        pass

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
    warnings: list[str] = []

    # cv_is_mixed retry loop
    polished = cv
    for _ in range(_MAX_MIXED_ATTEMPTS):
        polished, polish_warnings = cv_extractor.polish(
            polished, language=language, jd_text=jd_text
        )
        polished = normalize_cv(polished)
        warnings.extend(polish_warnings)
        language = detect_cv_language(polished)
        if not cv_is_mixed(polished):
            break

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
