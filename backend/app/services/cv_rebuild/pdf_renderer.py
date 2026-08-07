"""Render CV HTML to PDF bytes and a first-page JPEG thumbnail via Playwright."""

import asyncio
from io import BytesIO

from PIL import Image
from pypdf import PdfReader

THUMBNAIL_WIDTH = 300
THUMBNAIL_JPEG_QUALITY = 80

_PDF_KWARGS = {
    "format": "A4",
    "margin": {"top": "0.6in", "right": "0.65in", "bottom": "0.5in", "left": "0.65in"},
    "print_background": True,
}

_playwright = None
_browser = None
_lock = asyncio.Lock()


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


async def _ensure_browser():
    global _playwright, _browser
    async with _lock:
        if _browser is None or not _browser.is_connected():
            try:
                from playwright.async_api import async_playwright
            except ImportError as exc:
                raise PdfRenderError(
                    "Playwright is not installed; run `pip install playwright`."
                ) from exc
            if _playwright is None:
                try:
                    _playwright = await async_playwright().start()
                except NotImplementedError as exc:
                    raise PdfRenderError(
                        "Playwright could not start the browser driver: asyncio "
                        "needs the Proactor event loop on Windows. Run the "
                        "backend with `python app/main.py` so the Proactor "
                        "policy is applied."
                    ) from exc
            try:
                _browser = await _playwright.chromium.launch()
            except Exception as exc:
                raise PdfRenderError(
                    "Headless Chromium is not installed; run "
                    "`.venv\\Scripts\\python.exe -m playwright install chromium`."
                ) from exc
        return _browser


async def render_pdf_with_thumbnail(html: str) -> tuple[bytes, bytes]:
    """Render the HTML document to PDF bytes and a page-1 JPEG thumbnail."""
    try:
        browser = await _ensure_browser()
        context = await browser.new_context(viewport={"width": 794, "height": 1123})
        try:
            page = await context.new_page()
            await page.set_content(html, wait_until="load")
            await page.evaluate("document.fonts.ready.then(() => true)")
            pdf_bytes = await page.pdf(**_PDF_KWARGS)
            screenshot = await page.screenshot(full_page=False, type="png")
        finally:
            await context.close()
    except PdfRenderError:
        raise
    except Exception as exc:
        raise PdfRenderError(f"PDF rendering failed: {exc}") from exc
    return pdf_bytes, resize_thumbnail(screenshot)


def count_pdf_pages(pdf_bytes: bytes) -> int:
    """Return the number of pages in a PDF, or 0 when it cannot be read."""
    try:
        return len(PdfReader(BytesIO(pdf_bytes)).pages)
    except Exception:
        return 0
