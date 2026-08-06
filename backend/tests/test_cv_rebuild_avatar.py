from pathlib import Path

from app.core.config import settings
from app.services.cv_rebuild.avatar import resolve_avatar


def _write_avatar(filename: str, data: bytes = b"\xff\xd8\xff\xe0avatar") -> None:
    target = settings.upload_dir / "avatars" / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def test_none_avatar_stays_none():
    assert resolve_avatar(None) is None
    assert resolve_avatar("") is None
    assert resolve_avatar("   ") is None


def test_data_url_passes_through():
    url = "data:image/png;base64,QUFBQQ=="
    assert resolve_avatar(url) == url


def test_rejects_external_url():
    import pytest

    with pytest.raises(ValueError):
        resolve_avatar("https://example.com/photo.jpg")


def test_local_path_embeds_file():
    _write_avatar("abc123.jpg", b"imagedata")
    result = resolve_avatar("/uploads/avatars/abc123.jpg")
    assert result is not None
    assert result.startswith("data:image/jpeg;base64,")


def test_local_path_rejects_traversal():
    import pytest

    with pytest.raises(ValueError):
        resolve_avatar("/uploads/avatars/../config.txt")


def test_missing_local_file_rejected():
    import pytest

    with pytest.raises(ValueError):
        resolve_avatar("/uploads/avatars/does-not-exist.png")
