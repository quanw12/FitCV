"""Stateless orchestrator for the AI Rebuild CV pipeline.

Never touches the database or long-lived storage. Upload bytes are written to
a TemporaryDirectory only while the source file is parsed, then deleted.
"""

import base64
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf.errors import PdfReadError

from app.schemas.cv_rebuild import CvRebuildResponse
from app.services.cv_rebuild.llm_extractor import CvExtractor
from app.services.cv_rebuild.pdf_renderer import render_pdf_with_thumbnail
from app.services.cv_rebuild.template_renderer import render_cv
from app.services.document_parser import extract_document_text, validate_cv_content


def rebuild_cv(
    content: bytes,
    filename: str,
    *,
    extractor: CvExtractor | None = None,
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

    cv = (extractor or CvExtractor()).extract(raw_text)
    html = render_cv(cv)
    pdf_bytes, thumbnail_bytes = render_pdf_with_thumbnail(html)

    return CvRebuildResponse(
        filename="rebuilt_cv.pdf",
        preview_json=cv,
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        thumbnail_base64=base64.b64encode(thumbnail_bytes).decode("ascii"),
    )
