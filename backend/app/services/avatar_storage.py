import hashlib
import os
import secrets
import struct
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import HTTPException, status

from app.core.config import BACKEND_ROOT, settings

MAX_AVATAR_BYTES = 5 * 1024 * 1024
UPLOAD_ROOT = BACKEND_ROOT / "uploads" / "avatars"


@dataclass(frozen=True)
class StoredAvatar:
    url: str


def detect_image(data: bytes) -> tuple[str, str]:
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 33:
        length = struct.unpack(">I", data[8:12])[0]
        if length == 13 and data[12:16] == b"IHDR" and data[-12:-8] == b"\x00\x00\x00\x00" and data[-8:-4] == b"IEND":
            return "png", "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        declared = struct.unpack("<I", data[4:8])[0] + 8
        if declared == len(data) and data[12:16] in {b"VP8 ", b"VP8L", b"VP8X"}:
            return "webp", "image/webp"
    if len(data) >= 4 and data[:2] == b"\xff\xd8" and data[-2:] == b"\xff\xd9":
        offset = 2
        saw_frame = False
        while offset + 1 < len(data) - 2:
            if data[offset] != 0xFF:
                break
            while offset < len(data) and data[offset] == 0xFF:
                offset += 1
            if offset >= len(data):
                break
            marker = data[offset]
            offset += 1
            if marker in {0x01, *range(0xD0, 0xD9)}:
                continue
            if offset + 2 > len(data):
                break
            segment_length = struct.unpack(">H", data[offset:offset + 2])[0]
            if segment_length < 2 or offset + segment_length > len(data):
                break
            if marker in {*range(0xC0, 0xC4), *range(0xC5, 0xC8), *range(0xC9, 0xCC), *range(0xCD, 0xD0)} and segment_length >= 8:
                saw_frame = True
            if marker == 0xDA:
                if saw_frame and segment_length >= 6 and offset + segment_length < len(data) - 2:
                    return "jpg", "image/jpeg"
                break
            offset += segment_length
    raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File must be a valid JPEG, PNG, or WebP image.")


def validate_avatar(data: bytes, content_type: str | None) -> tuple[str, str]:
    if not data:
        raise HTTPException(status_code=422, detail="Avatar file is empty.")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Avatar must be 5MB or smaller.")
    extension, detected_type = detect_image(data)
    if (content_type or "").lower() not in {"image/jpeg", "image/png", "image/webp"} or content_type.lower() != detected_type:
        raise HTTPException(status_code=415, detail="Image MIME type does not match its content.")
    return extension, detected_type


def _public_base(request_base_url: str) -> str:
    return (settings.backend_public_url or request_base_url).rstrip("/")


def _cloudinary_config() -> tuple[str, str, str]:
    values = (settings.cloudinary_cloud_name, settings.cloudinary_api_key, settings.cloudinary_api_secret)
    if not all(values):
        raise HTTPException(status_code=503, detail="Cloudinary avatar storage is selected but is not fully configured.")
    return values  # type: ignore[return-value]


def store_avatar(data: bytes, extension: str, mime: str, request_base_url: str) -> StoredAvatar:
    mode = settings.avatar_storage.lower()
    if mode == "local":
        if os.getenv("RENDER", "").lower() in {"1", "true", "yes"}:
            raise HTTPException(status_code=503, detail="Local avatar storage is ephemeral on Render. Configure Cloudinary and set AVATAR_STORAGE=cloudinary.")
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        filename = f"{secrets.token_urlsafe(24)}.{extension}"
        (UPLOAD_ROOT / filename).write_bytes(data)
        url = f"{_public_base(request_base_url)}/uploads/avatars/{filename}"
    elif mode == "cloudinary":
        cloud, api_key, secret = _cloudinary_config()
        timestamp = int(time.time())
        public_id = f"fitcv/avatars/{secrets.token_urlsafe(24)}"
        to_sign = f"public_id={public_id}&timestamp={timestamp}"
        signature = hashlib.sha1(f"{to_sign}{secret}".encode()).hexdigest()
        try:
            response = requests.post(
                f"https://api.cloudinary.com/v1_1/{cloud}/image/upload",
                data={"api_key": api_key, "timestamp": timestamp, "public_id": public_id, "signature": signature},
                files={"file": (f"avatar.{extension}", data, mime)}, timeout=20,
            )
            response.raise_for_status()
            url = response.json()["secure_url"]
        except (requests.RequestException, KeyError, ValueError) as exc:
            raise HTTPException(status_code=502, detail="Avatar storage provider rejected the upload.") from exc
    else:
        raise HTTPException(status_code=503, detail="AVATAR_STORAGE must be either local or cloudinary.")
    if len(url) > 400:
        if mode == "local":
            delete_local_avatar(url)
        raise HTTPException(status_code=500, detail="Generated avatar URL exceeds the database limit.")
    return StoredAvatar(url=url)


def delete_local_avatar(url: str | None) -> None:
    if not url:
        return
    path = urlparse(url).path
    prefix = "/uploads/avatars/"
    if not path.startswith(prefix):
        return
    filename = path.removeprefix(prefix)
    if not filename or Path(filename).name != filename:
        return
    root = UPLOAD_ROOT.resolve()
    target = (root / filename).resolve()
    if target.parent == root:
        target.unlink(missing_ok=True)
