import json
import time

import requests

from app.core.config import settings


class GeminiClientError(RuntimeError):
    pass


class GeminiClient:
    name = "gemini"

    def __init__(self, *, model_name: str | None = None) -> None:
        if not settings.gemini_api_key:
            raise GeminiClientError("GEMINI_API_KEY is required.")
        self.model_name = model_name or settings.gemini_model

    def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": response_schema,
                "temperature": 0.2,
            },
        }
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model_name}:generateContent"
        )
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": settings.gemini_api_key,
        }
        attempts = max(1, settings.gemini_max_retries + 1)

        for attempt in range(attempts):
            try:
                response = requests.post(
                    url,
                    json=body,
                    headers=headers,
                    timeout=settings.gemini_timeout_seconds,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt + 1 < attempts:
                        time.sleep(_retry_delay(response, attempt))
                        continue
                    raise GeminiClientError(
                        "Gemini is busy or the free quota was reached. Try again later."
                    )
                if response.status_code in {401, 403}:
                    raise GeminiClientError(
                        "Gemini rejected the API key. Check GEMINI_API_KEY and its restrictions."
                    )
                if response.status_code >= 400:
                    detail = _safe_error_detail(response)
                    message = f"Gemini request failed with HTTP {response.status_code}"
                    raise GeminiClientError(
                        f"{message}: {detail}" if detail else f"{message}."
                    )

                payload = response.json()
                content = payload["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(_strip_code_fence(content))
                if not isinstance(parsed, dict):
                    raise GeminiClientError("Gemini returned a non-object JSON response.")
                return parsed
            except GeminiClientError:
                raise
            except requests.Timeout as exc:
                if attempt + 1 < attempts:
                    time.sleep(0.5 * (2 ** attempt))
                    continue
                raise GeminiClientError("Gemini timed out. Try again later.") from exc
            except requests.RequestException as exc:
                raise GeminiClientError("Gemini is unavailable. Try again later.") from exc
            except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
                raise GeminiClientError("Gemini returned an invalid structured response.") from exc

        raise GeminiClientError("Gemini is unavailable. Try again later.")


def _strip_code_fence(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[-1]
        stripped = stripped.rsplit("```", 1)[0]
    return stripped.strip()


def _retry_delay(response: requests.Response, attempt: int) -> float:
    retry_after = response.headers.get("Retry-After")
    if retry_after:
        try:
            return max(0.0, float(retry_after))
        except ValueError:
            pass
    return 0.5 * (2 ** attempt)


def _safe_error_detail(response: requests.Response) -> str | None:
    try:
        payload = response.json()
    except (TypeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    error = payload.get("error")
    message = error.get("message") if isinstance(error, dict) else None
    if not isinstance(message, str) or not message.strip():
        return None
    sanitized = " ".join(message.split())
    if settings.gemini_api_key:
        sanitized = sanitized.replace(settings.gemini_api_key, "[redacted]")
    return sanitized[:500]
