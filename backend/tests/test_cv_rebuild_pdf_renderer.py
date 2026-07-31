import io

from PIL import Image

from app.services.cv_rebuild.pdf_renderer import resize_thumbnail


def test_resize_thumbnail_scales_to_width_and_returns_jpeg() -> None:
    source = Image.new("RGB", (794, 1123), color=(255, 255, 255))
    buffer = io.BytesIO()
    source.save(buffer, format="PNG")

    result = resize_thumbnail(buffer.getvalue())

    with Image.open(io.BytesIO(result)) as resized:
        assert resized.width == 300
        assert abs(resized.height - 424) <= 1
        assert resized.format == "JPEG"
