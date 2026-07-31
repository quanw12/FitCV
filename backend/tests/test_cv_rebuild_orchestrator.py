import tempfile
from pathlib import Path

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.orchestrator import rebuild_cv
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.gemini_client import GeminiClientError

_MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    b"4 0 obj<</Length 90>>stream\n"
    b"BT /F1 12 Tf 72 720 Td (Backend engineer with skills in Python and FastAPI) Tj ET\n"
    b"endstream endobj\n"
    b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    b"xref\n"
    b"0 6\n"
    b"0000000000 65535 f \n"
    b"0000000009 00000 n \n"
    b"0000000058 00000 n \n"
    b"0000000115 00000 n \n"
    b"0000000255 00000 n \n"
    b"0000000405 00000 n \n"
    b"trailer<</Size 6/Root 1 0 R>>\n"
    b"startxref\n"
    b"456\n"
    b"%%EOF"
)


class FakeExtractor:
    def __init__(self, result: CVData) -> None:
        self.result = result

    def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
        assert "Backend engineer" in raw_text
        return self.result


class TestRebuildCv:
    def test_rejects_unknown_style(self) -> None:
        try:
            rebuild_cv(
                _MINIMAL_PDF,
                "cv.pdf",
                style="fancy",
                extractor=FakeExtractor(CVData()),
            )
        except ValueError as exc:
            assert "Unknown template style" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_rejects_invalid_file_format(self) -> None:
        try:
            rebuild_cv(b"plain text", "cv.txt", extractor=FakeExtractor(CVData()))
        except ValueError as exc:
            assert "Only PDF and DOCX" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_rejects_corrupt_pdf_bytes(self) -> None:
        try:
            rebuild_cv(
                b"%PDF-1.4 not really a pdf",
                "cv.pdf",
                extractor=FakeExtractor(CVData()),
            )
        except ValueError as exc:
            assert "not a valid PDF" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_returns_expected_response_shape(self) -> None:
        cv = CVData(
            name="Nguyen Van A",
            summary="Backend engineer with 3 years of experience.",
        )
        result = rebuild_cv(
            _MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(cv)
        )
        assert result.filename == "rebuilt_cv.pdf"
        assert result.preview_json.name == "Nguyen Van A"
        assert result.pdf_base64
        assert result.thumbnail_base64

    def test_leaves_no_temp_dirs_and_no_upload_files(self, monkeypatch) -> None:
        cv = CVData(name="A")
        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", lambda html: (b"pdf", b"thumb")
        )
        temp_root = Path(tempfile.gettempdir())
        before = set(temp_root.glob("fitcv-rebuild-*"))
        rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(cv))
        after = set(temp_root.glob("fitcv-rebuild-*"))
        assert before == after

    def test_propagates_extraction_error(self, monkeypatch) -> None:
        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", lambda html: (b"pdf", b"thumb")
        )

        class BrokenExtractor:
            def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
                raise CvExtractionError("invalid structure")

        try:
            rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=BrokenExtractor())
        except CvExtractionError as exc:
            assert "invalid structure" in str(exc)
        else:
            raise AssertionError("expected CvExtractionError")

    def test_propagates_gemini_error(self, monkeypatch) -> None:
        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", lambda html: (b"pdf", b"thumb")
        )

        class BrokenExtractor:
            def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
                raise GeminiClientError("busy")

        try:
            rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=BrokenExtractor())
        except GeminiClientError as exc:
            assert "busy" in str(exc)
        else:
            raise AssertionError("expected GeminiClientError")

    def test_propagates_render_error(self, monkeypatch) -> None:
        def raise_render_error(html: str) -> tuple[bytes, bytes]:
            raise PdfRenderError("no chromium")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", raise_render_error
        )
        try:
            rebuild_cv(
                _MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(CVData())
            )
        except PdfRenderError as exc:
            assert "no chromium" in str(exc)
        else:
            raise AssertionError("expected PdfRenderError")
