from fastapi.testclient import TestClient

from app.api.deps import get_current_account
from app.main import app
from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.gemini_client import GeminiClientError


class FakeAccount:
    account_id = 1


def _make_client() -> TestClient:
    app.dependency_overrides[get_current_account] = lambda: FakeAccount()
    return TestClient(app)


def _post(client: TestClient, content: bytes, filename: str = "cv.pdf"):
    return client.post(
        "/api/cv/rebuild",
        files={"file": (filename, content, "application/octet-stream")},
    )


def test_requires_auth() -> None:
    app.dependency_overrides.clear()
    client = TestClient(app)
    response = client.post(
        "/api/cv/rebuild",
        files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 401


def test_rejects_unsupported_extension() -> None:
    client = _make_client()
    response = _post(client, b"hello", filename="cv.txt")
    assert response.status_code == 400
    assert "Only PDF and DOCX" in response.json()["detail"]


def test_rejects_empty_file() -> None:
    client = _make_client()
    response = _post(client, b"")
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]


def test_rejects_oversized_file() -> None:
    client = _make_client()
    response = _post(client, b"%PDF-1.4" + b"x" * (10 * 1024 * 1024))
    assert response.status_code == 400
    assert "10 MB" in response.json()["detail"]


def test_maps_extraction_error_to_422(monkeypatch) -> None:
    def raise_extraction(content, filename):
        raise CvExtractionError("invalid structure after retries")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_extraction)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 422
    assert "invalid structure" in response.json()["detail"]


def test_maps_gemini_error_to_502(monkeypatch) -> None:
    def raise_gemini(content, filename):
        raise GeminiClientError("busy")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_gemini)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 502


def test_maps_render_error_to_502(monkeypatch) -> None:
    def raise_render(content, filename):
        raise PdfRenderError("no chromium")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_render)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 502


def test_success_shape(monkeypatch) -> None:
    def fake_rebuild(content, filename):
        return {
            "filename": "rebuilt_cv.pdf",
            "preview_json": CVData(name="A").model_dump(),
            "pdf_base64": "cGRm",
            "thumbnail_base64": "dGh1bWI=",
        }

    monkeypatch.setattr(orchestrator, "rebuild_cv", fake_rebuild)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 200
    payload = response.json()
    assert payload["filename"] == "rebuilt_cv.pdf"
    assert payload["preview_json"]["name"] == "A"
    assert payload["pdf_base64"] == "cGRm"
    assert payload["thumbnail_base64"] == "dGh1bWI="
