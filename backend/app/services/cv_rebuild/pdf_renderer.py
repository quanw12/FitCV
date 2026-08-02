"""Render CV HTML to PDF bytes and a first-page JPEG thumbnail via Playwright."""

import atexit
import threading
from io import BytesIO

from PIL import Image

THUMBNAIL_WIDTH = 300
THUMBNAIL_JPEG_QUALITY = 80

_PDF_KWARGS = {
    "format": "A4",
    "margin": {"top": "0", "right": "0", "bottom": "0", "left": "0"},
    "print_background": True,
}

_browser_lock = threading.Lock()
_playwright = None
_browser = None


class PdfRenderError(RuntimeError):
    """Raised when headless Chromium cannot render the CV."""


def resize_thumbnail(image_bytes: bytes, width: int = THUMBNAIL_WIDTH) -> bytes:
    """Resize a PNG/JPEG screenshot to A4-ratio JPEG at the given width."""
    with Image.open(BytesIO(image_bytes)) as image:
        height = max(1, round(image.height * width / image.width))
        resized = image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
        output = BytesIO()
        resized.save(output, format="JPEG", quality=THUMBNAIL_JPEG_QUALITY)
        return output.getvalue()


def _ensure_browser():
    global _playwright, _browser
    with _browser_lock:
        if _browser is None or not _browser.is_connected():
            try:
                from playwright.sync_api import sync_playwright
            except ImportError as exc:
                raise PdfRenderError(
                    "Playwright is not installed; run `pip install playwright`."
                ) from exc
            if _playwright is None:
                try:
                    _playwright = sync_playwright().start()
                except NotImplementedError as exc:
                    raise PdfRenderError(
                        "Playwright could not start the browser driver: asyncio "
                        "needs the Proactor event loop on Windows. Run the "
                        "backend with `python app/main.py` so the Proactor "
                        "policy is applied."
                    ) from exc
            try:
                _browser = _playwright.chromium.launch()
            except Exception as exc:
                raise PdfRenderError(
                    "Headless Chromium is not installed; run "
                    "`.venv\\Scripts\\python.exe -m playwright install chromium`."
                ) from exc
        return _browser


def stop_browser() -> None:
    global _playwright, _browser
    with _browser_lock:
        if _browser is not None:
            _browser.close()
            _browser = None
        if _playwright is not None:
            _playwright.stop()
            _playwright = None


atexit.register(stop_browser)


def render_pdf_with_thumbnail(html: str) -> tuple[bytes, bytes]:
    """Render the HTML document to PDF bytes and a page-1 JPEG thumbnail."""
    try:
        browser = _ensure_browser()
        context = browser.new_context(viewport={"width": 794, "height": 1123})
        try:
            page = context.new_page()
            page.set_content(html, wait_until="load")
            pdf_bytes = page.pdf(**_PDF_KWARGS)
            screenshot = page.screenshot(full_page=False, type="png")
        finally:
            context.close()
    except PdfRenderError:
        raise
    except Exception as exc:
        raise PdfRenderError(f"PDF rendering failed: {exc}") from exc
    return pdf_bytes, resize_thumbnail(screenshot)
