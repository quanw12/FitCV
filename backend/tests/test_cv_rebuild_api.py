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


def _post_build(client: TestClient, body: dict):
    return client.post("/api/cv/build", json=body)


AVATAR_DATA_URL = "data:image/png;base64,QUFBQQ=="


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
    async def raise_extraction(content, filename, *, avatar=None, jd_text=None):
        raise CvExtractionError("invalid structure after retries")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_extraction)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 422
    assert "invalid structure" in response.json()["detail"]


def test_maps_gemini_error_to_502(monkeypatch) -> None:
    async def raise_gemini(content, filename, *, avatar=None, jd_text=None):
        raise GeminiClientError("busy")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_gemini)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 502


def test_maps_render_error_to_502(monkeypatch) -> None:
    async def raise_render(content, filename, *, avatar=None, jd_text=None):
        raise PdfRenderError("no chromium")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_render)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 502


def test_success_shape(monkeypatch) -> None:
    async def fake_rebuild(content, filename, *, avatar=None, jd_text=None):
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


def test_rebuild_forwards_avatar_form_field(monkeypatch) -> None:
    calls: list[dict] = []

    async def fake_rebuild(content, filename, *, avatar=None, jd_text=None):
        calls.append({"content": content, "filename": filename, "avatar": avatar})
        return {
            "filename": "rebuilt_cv.pdf",
            "preview_json": CVData(name="A").model_dump(),
            "pdf_base64": "cGRm",
            "thumbnail_base64": "dGh1bWI=",
        }

    monkeypatch.setattr(orchestrator, "rebuild_cv", fake_rebuild)
    client = _make_client()
    response = client.post(
        "/api/cv/rebuild",
        files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
        data={"avatar": AVATAR_DATA_URL},
    )
    assert response.status_code == 200
    assert calls[0]["avatar"] == AVATAR_DATA_URL


def test_rebuild_rejects_non_data_url_avatar(monkeypatch) -> None:
    async def noop(*a, **k):
        pass

    monkeypatch.setattr(orchestrator, "rebuild_cv", noop)
    client = _make_client()
    response = client.post(
        "/api/cv/rebuild",
        files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
        data={"avatar": "https://example.com/photo.jpg"},
    )
    assert response.status_code == 422
    assert "data URL" in response.json()["detail"]


class TestBuildEndpoint:
    def test_requires_auth(self) -> None:
        app.dependency_overrides.clear()
        client = TestClient(app)
        response = client.post("/api/cv/build", json={"cv": {}})
        assert response.status_code == 401

    def test_accepts_valid_payload(self, monkeypatch) -> None:
        calls: list[dict] = []

        async def fake_build(cv, *, language="en", avatar=None, jd_text=None):
            calls.append({"cv": cv, "language": language, "avatar": avatar})
            return {
                "filename": "built_cv.pdf",
                "preview_json": CVData(name="B").model_dump(),
                "pdf_base64": "cGRm",
                "thumbnail_base64": "dGh1bWI=",
            }

        monkeypatch.setattr(orchestrator, "build_cv", fake_build)
        client = _make_client()
        response = _post_build(
            client,
            {
                "cv": {"name": "B", "skills": ["Python"]},
                "language": "vi",
                "avatar": AVATAR_DATA_URL,
            },
        )
        assert response.status_code == 200
        assert calls[0]["language"] == "vi"
        assert calls[0]["avatar"] == AVATAR_DATA_URL
        assert calls[0]["cv"].name == "B"

    def test_defaults_language_to_english(self, monkeypatch) -> None:
        async def fake_build(cv, *, language="en", avatar=None, jd_text=None):
            return {
                "filename": "built_cv.pdf",
                "preview_json": CVData(name="B").model_dump(),
                "pdf_base64": "cGRm",
                "thumbnail_base64": "dGh1bWI=",
            }

        monkeypatch.setattr(orchestrator, "build_cv", fake_build)
        client = _make_client()
        response = _post_build(client, {"cv": {"name": "B"}})
        assert response.status_code == 200

    def test_rejects_unknown_language(self) -> None:
        client = _make_client()
        response = _post_build(client, {"cv": {"name": "B"}, "language": "fr"})
        assert response.status_code == 422

    def test_rejects_invalid_avatar(self) -> None:
        client = _make_client()
        response = _post_build(
            client, {"cv": {"name": "B"}, "avatar": "https://example.com/x.jpg"}
        )
        assert response.status_code == 422
        assert "data URL" in response.json()["detail"]

    def test_rejects_invalid_cv_structure(self) -> None:
        client = _make_client()
        response = _post_build(client, {"cv": {"skills": "Python"}})
        assert response.status_code == 422

    def test_maps_polish_error_to_422(self, monkeypatch) -> None:
        async def raise_polish(cv, *, language="en", avatar=None, jd_text=None):
            raise CvExtractionError("invalid structure after retries")

        monkeypatch.setattr(orchestrator, "build_cv", raise_polish)
        client = _make_client()
        response = _post_build(client, {"cv": {"name": "B"}})
        assert response.status_code == 422
        assert "invalid structure" in response.json()["detail"]

    def test_maps_gemini_error_to_502(self, monkeypatch) -> None:
        async def raise_gemini(cv, *, language="en", avatar=None, jd_text=None):
            raise GeminiClientError("busy")

        monkeypatch.setattr(orchestrator, "build_cv", raise_gemini)
        client = _make_client()
        response = _post_build(client, {"cv": {"name": "B"}})
        assert response.status_code == 502

    def test_maps_render_error_to_502(self, monkeypatch) -> None:
        async def raise_render(cv, *, language="en", avatar=None, jd_text=None):
            raise PdfRenderError("no chromium")

        monkeypatch.setattr(orchestrator, "build_cv", raise_render)
        client = _make_client()
        response = _post_build(client, {"cv": {"name": "B"}})
        assert response.status_code == 502
