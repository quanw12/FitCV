import io

from PIL import Image

from app.services.cv_rebuild.pdf_renderer import (
    _PDF_KWARGS,
    count_pdf_pages,
    resize_thumbnail,
)

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


def test_pdf_kwargs_apply_page_margins() -> None:
    assert _PDF_KWARGS["margin"] == {
        "top": "0.6in",
        "right": "0.65in",
        "bottom": "0.5in",
        "left": "0.65in",
    }


def test_count_pdf_pages() -> None:
    assert count_pdf_pages(b"%PDF") == 0
    assert count_pdf_pages(b"") == 0
    assert count_pdf_pages(_MINIMAL_PDF) == 1


def test_resize_thumbnail_scales_to_width_and_returns_jpeg() -> None:
    source = Image.new("RGB", (794, 1123), color=(255, 255, 255))
    buffer = io.BytesIO()
    source.save(buffer, format="PNG")

    result = resize_thumbnail(buffer.getvalue())

    with Image.open(io.BytesIO(result)) as resized:
        assert resized.width == 300
        assert abs(resized.height - 424) <= 1
        assert resized.format == "JPEG"
