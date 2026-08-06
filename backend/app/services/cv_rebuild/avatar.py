"""Resolve an avatar value into an embeddable base64 data URL for the CV template.

The CV renderer only embeds inline ``data:image/`` URLs (it renders to a PDF via
headless Chromium with no live network). Stored avatars arrive as either:

- a ``data:image/...;base64,...`` data URL (already embeddable), or
- a local ``/uploads/avatars/...`` path/URL served by this backend.

This helper turns the latter into a data URL by reading the file from disk so the
avatar appears in the built/rebuilt CV even when the frontend cannot fetch it
(e.g. a relative URL resolved against the wrong origin).
"""

import base64
import re
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings

_AVATAR_CHARS_LIMIT = 7_000_000
_AVATAR_BYTES_LIMIT = 5 * 1024 * 1024
_AVATAR_PREFIX = "/uploads/avatars/"

_AVATAR_DOWNSCALE_BYTES = 2 * 1024 * 1024
_AVATAR_MAX_DIMENSION = 512
_AVATAR_JPEG_QUALITY = 80

_MIME_BY_EXTENSION = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
}

_DATA_URL_RE = re.compile(r"^data:image/[^;]+;base64,(.*)$", re.DOTALL)


def _local_avatar_path(value: str) -> Path | None:
    parsed = urlparse(value)
    path = parsed.path if (parsed.scheme or parsed.netloc) else value
    if not path.startswith(_AVATAR_PREFIX):
        return None
    filename = path[len(_AVATAR_PREFIX) :]
    if not filename or Path(filename).name != filename:
        return None
    candidate = (settings.upload_dir / "avatars" / filename).resolve()
    root = (settings.upload_dir / "avatars").resolve()
    if candidate.parent != root:
        return None
    return candidate


def resolve_avatar(avatar: str | None) -> str | None:
    """Return an embeddable avatar data URL, or ``None`` when no avatar is set.

    Raises ``ValueError`` for values that are not a data URL and not a local
    avatar path served by this backend.
    """
    if not avatar:
        return None
    value = avatar.strip()
    if not value:
        return None
    if value.startswith("data:image/") and ";base64," in value:
        if len(value) > _AVATAR_CHARS_LIMIT:
            raise ValueError("avatar image is too large.")
        return value
    path = _local_avatar_path(value)
    if path is None:
        raise ValueError(
            "avatar must be a base64 image data URL or a local /uploads/avatars path."
        )
    if not path.exists() or not path.is_file():
        raise ValueError("avatar image file could not be found.")
    data = path.read_bytes()
    if len(data) > _AVATAR_BYTES_LIMIT:
        raise ValueError("avatar image is too large.")
    extension = path.suffix.lower().lstrip(".")
    mime = _MIME_BY_EXTENSION.get(extension, "image/png")
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def maybe_downscale_avatar(
    avatar: str | None, warnings: list[str]
) -> str | None:
    """Downscale an avatar data URL if it exceeds ~2 MB, or drop it on error.

    If the avatar is ``None`` or already small enough, return it unchanged.
    If decoding or downscaling fails, return ``None`` and append a warning.
    """
    if not avatar:
        return None
    match = _DATA_URL_RE.match(avatar)
    if not match:
        return avatar
    try:
        raw_bytes = base64.b64decode(match.group(1))
    except Exception:
        warnings.append(
            "Avatar could not be decoded and was removed from the CV."
        )
        return None
    if len(raw_bytes) <= _AVATAR_DOWNSCALE_BYTES:
        return avatar
    try:
        from PIL import Image

        with Image.open(BytesIO(raw_bytes)) as img:
            img = img.convert("RGB")
            w, h = img.size
            scale = min(1.0, _AVATAR_MAX_DIMENSION / max(w, h))
            if scale < 1.0:
                new_w = max(1, round(w * scale))
                new_h = max(1, round(h * scale))
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=_AVATAR_JPEG_QUALITY)
            downscaled = buf.getvalue()
        encoded = base64.b64encode(downscaled).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    except Exception:
        warnings.append(
            "Avatar image could not be processed and was removed from the CV."
        )
        return None
