import asyncio
import tempfile
from pathlib import Path

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.orchestrator import (
    build_cv,
    rebuild_cv,
    rebuild_with_improvements,
)
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.gemini_client import GeminiClientError

async def _fake_render(html: str) -> tuple[bytes, bytes]:
    return (b"pdf", b"thumb")


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
    def __init__(
        self,
        result: CVData,
        *,
        polish_result: CVData | None = None,
        polish_warnings: list[str] | None = None,
    ) -> None:
        self.result = result
        self.polish_result = polish_result if polish_result is not None else result
        self.polish_warnings = polish_warnings or []
        self.last_polish_language: str | None = None
        self.last_applied_improvements: str | None = None
        self.polish_calls = 0

    def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
        assert "Backend engineer" in raw_text
        return self.result

    def polish(
        self,
        cv: CVData,
        *,
        language: str = "en",
        max_attempts: int = 3,
        jd_text: str | None = None,
        applied_improvements: str | None = None,
    ) -> tuple[CVData, list[str]]:
        self.last_polish_language = language
        self.last_applied_improvements = applied_improvements
        self.polish_calls += 1
        return self.polish_result, self.polish_warnings


class TestRebuildCv:
    def test_rejects_invalid_file_format(self) -> None:
        try:
            asyncio.run(
                rebuild_cv(b"plain text", "cv.txt", extractor=FakeExtractor(CVData()))
            )
        except ValueError as exc:
            assert "Only PDF and DOCX" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_rejects_corrupt_pdf_bytes(self) -> None:
        try:
            asyncio.run(
                rebuild_cv(
                    b"%PDF-1.4 not really a pdf",
                    "cv.pdf",
                    extractor=FakeExtractor(CVData()),
                )
            )
        except ValueError as exc:
            assert "not a valid PDF" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_returns_expected_response_shape(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        cv = CVData(
            name="Nguyen Van A",
            summary="Backend engineer with 3 years of experience.",
        )
        result = asyncio.run(
            rebuild_cv(
                _MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(cv)
            )
        )
        assert result.filename == "rebuilt_cv.pdf"
        assert result.preview_json.name == "Nguyen Van A"
        assert result.pdf_base64
        assert result.thumbnail_base64

    def test_normalizes_extracted_cv_before_render(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        cv = CVData(
            name="A",
            summary="Engineer.",
            skills=["Python ★★★★"],
            languages=[{"name": "English", "proficiency": "★★★★☆"}],
        )
        result = asyncio.run(rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(cv)))
        assert result.preview_json.skills == ["Python"]
        assert result.preview_json.languages[0].proficiency == "Fluent"

    def test_mixed_extracted_cv_is_unified_with_polish(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        cv = CVData(
            name="Nguyen Van A",
            summary="Kỹ sư phần mềm với 5 năm kinh nghiệm xây dựng API.",
            experience=[
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "bullets": ["Built a payment system serving 2M transactions a day."],
                }
            ],
        )
        unified = CVData(
            name="Nguyen Van A",
            summary="Backend engineer with 5 years of API development experience.",
            experience=[
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "bullets": ["Built a payment system serving 2M transactions a day."],
                }
            ],
        )
        extractor = FakeExtractor(cv, polish_result=unified)
        result = asyncio.run(rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=extractor))
        assert extractor.polish_calls == 1
        assert extractor.last_polish_language == "vi"
        assert result.preview_json.name == "Nguyen Van A"

    def test_consistent_extracted_cv_skips_extra_polish(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        cv = CVData(
            name="Nguyen Van A",
            summary="Backend engineer with 3 years of experience.",
        )
        extractor = FakeExtractor(cv)
        asyncio.run(rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=extractor))
        assert extractor.polish_calls == 0

    def test_vietnamese_name_survives_unify_polish(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        cv = CVData(
            name="Nguyễn Văn A",
            summary="Kỹ sư phần mềm với 5 năm kinh nghiệm xây dựng API.",
            experience=[
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "bullets": ["Built a payment system serving 2M transactions a day."],
                }
            ],
        )
        unified = CVData(
            name="Nguyễn Văn A",
            summary="Backend engineer with 5 years of API development experience.",
            experience=[
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "bullets": ["Built a payment system serving 2M transactions a day."],
                }
            ],
        )
        extractor = FakeExtractor(cv, polish_result=unified)
        result = asyncio.run(rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=extractor))
        assert extractor.polish_calls == 1
        assert result.preview_json.name == "Nguyễn Văn A"


class TestRebuildWithImprovements:
    def test_applies_instructions_even_when_cv_is_not_mixed(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        extractor = FakeExtractor(
            CVData(name="Nguyen Van A", summary="Backend engineer.", skills=["Python"]),
            polish_warnings=["Skills not grounded in source: Kubernetes"],
        )
        result = asyncio.run(
            rebuild_with_improvements(
                "Backend engineer with Python experience.",
                applied_improvements='- [Rewrite · Summary] Replace "Engineer" → "Backend engineer"',
                jd_text="Backend role needs Python.",
                extractor=extractor,
            )
        )
        assert result.filename == "improved_cv.pdf"
        assert extractor.polish_calls == 1
        assert extractor.last_applied_improvements is not None
        assert "[Rewrite · Summary]" in extractor.last_applied_improvements
        assert any("Skills not grounded in source" in warning for warning in result.warnings)


class TestBuildCv:
    def test_builds_cv_with_polish_and_selected_language(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        render_calls: list[dict] = []

        def capture_render(cv, *, language="en", avatar=None):
            render_calls.append({"language": language, "avatar": avatar})
            return "<html></html>"

        monkeypatch.setattr(orchestrator, "render_cv", capture_render)
        extractor = FakeExtractor(
            CVData(name="B", summary="Backend engineer.", skills=["Python"]),
            polish_result=CVData(name="B", summary="Kỹ sư phần mềm.", skills=["Python"]),
        )
        result = asyncio.run(build_cv(
            CVData(name="B", summary="Backend engineer."),
            language="vi",
            avatar="data:image/png;base64,QUFB",
            extractor=extractor,
        ))
        assert result.filename == "built_cv.pdf"
        assert result.preview_json.name == "B"
        assert extractor.last_polish_language == "vi"
        assert render_calls[0]["language"] == "vi"
        assert render_calls[0]["avatar"] == "data:image/png;base64,QUFB"

    def test_build_normalizes_polished_output(self, monkeypatch) -> None:
        async def fake_render(html: str) -> tuple[bytes, bytes]:
            return (b"pdf", b"thumb")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", fake_render
        )
        extractor = FakeExtractor(
            CVData(name="B", skills=["Python ★★★★"])
        )
        result = asyncio.run(build_cv(CVData(name="B"), extractor=extractor))
        assert result.preview_json.skills == ["Python"]

    def test_build_unifies_mixed_polished_output(self, monkeypatch) -> None:
        async def fake_render(html: str) -> tuple[bytes, bytes]:
            return (b"pdf", b"thumb")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", fake_render
        )
        mixed = CVData(
            name="B",
            summary="Kỹ sư phần mềm với 5 năm kinh nghiệm xây dựng API.",
            experience=[
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "bullets": ["Built a payment system serving 2M transactions a day."],
                }
            ],
        )
        extractor = FakeExtractor(mixed)
        asyncio.run(build_cv(CVData(name="B"), language="vi", extractor=extractor))
        assert extractor.polish_calls == 3
        assert extractor.last_polish_language == "vi"

    def test_build_keeps_entered_vietnamese_name_in_english_cv(self, monkeypatch) -> None:
        async def fake_render(html: str) -> tuple[bytes, bytes]:
            return (b"pdf", b"thumb")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", fake_render
        )
        extractor = FakeExtractor(
            CVData(name="Nguyen Van A", summary="Backend engineer.")
        )
        result = asyncio.run(build_cv(
            CVData(name="Nguyễn Văn A", summary="Backend engineer."),
            language="en",
            extractor=extractor,
        ))
        assert result.preview_json.name == "Nguyễn Văn A"

    def test_build_propagates_extraction_error(self, monkeypatch) -> None:
        async def fake_render(html: str) -> tuple[bytes, bytes]:
            return (b"pdf", b"thumb")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", fake_render
        )

        class BrokenExtractor:
            def polish(self, cv, *, language="en", max_attempts=3, jd_text=None):
                raise CvExtractionError("invalid structure")

        try:
            asyncio.run(build_cv(CVData(name="B"), extractor=BrokenExtractor()))
        except CvExtractionError as exc:
            assert "invalid structure" in str(exc)
        else:
            raise AssertionError("expected CvExtractionError")

    def test_build_defaults_to_english(self, monkeypatch) -> None:
        monkeypatch.setattr(orchestrator, "render_pdf_with_thumbnail", _fake_render)
        render_calls: list[dict] = []

        def capture_render(cv, *, language="en", avatar=None):
            render_calls.append({"language": language, "avatar": avatar})
            return "<html></html>"

        monkeypatch.setattr(orchestrator, "render_cv", capture_render)
        extractor = FakeExtractor(CVData(name="B"))
        asyncio.run(build_cv(CVData(name="B"), extractor=extractor))
        assert extractor.last_polish_language == "en"
        assert render_calls[0]["language"] == "en"
        assert render_calls[0]["avatar"] is None

    def test_leaves_no_temp_dirs_and_no_upload_files(self, monkeypatch) -> None:
        cv = CVData(name="A")

        async def fake_render(html: str) -> tuple[bytes, bytes]:
            return (b"pdf", b"thumb")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", fake_render
        )
        temp_root = Path(tempfile.gettempdir())
        before = set(temp_root.glob("fitcv-rebuild-*"))
        asyncio.run(rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(cv)))
        after = set(temp_root.glob("fitcv-rebuild-*"))
        assert before == after

    def test_propagates_extraction_error(self, monkeypatch) -> None:
        async def fake_render(html: str) -> tuple[bytes, bytes]:
            return (b"pdf", b"thumb")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", fake_render
        )

        class BrokenExtractor:
            def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
                raise CvExtractionError("invalid structure")

        try:
            asyncio.run(rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=BrokenExtractor()))
        except CvExtractionError as exc:
            assert "invalid structure" in str(exc)
        else:
            raise AssertionError("expected CvExtractionError")

    def test_propagates_gemini_error(self, monkeypatch) -> None:
        async def fake_render(html: str) -> tuple[bytes, bytes]:
            return (b"pdf", b"thumb")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", fake_render
        )

        class BrokenExtractor:
            def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
                raise GeminiClientError("busy")

        try:
            asyncio.run(rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=BrokenExtractor()))
        except GeminiClientError as exc:
            assert "busy" in str(exc)
        else:
            raise AssertionError("expected GeminiClientError")

    def test_propagates_render_error(self, monkeypatch) -> None:
        async def raise_render_error(html: str) -> tuple[bytes, bytes]:
            raise PdfRenderError("no chromium")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", raise_render_error
        )
        try:
            asyncio.run(
                rebuild_cv(
                    _MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(CVData())
                )
            )
        except PdfRenderError as exc:
            assert "no chromium" in str(exc)
        else:
            raise AssertionError("expected PdfRenderError")
