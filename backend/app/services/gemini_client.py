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
                        retry_after = response.headers.get("Retry-After")
                        delay = float(retry_after) if retry_after else 0.5 * (2 ** attempt)
                        time.sleep(max(0.0, delay))
                        continue
                    raise GeminiClientError(
                        "Gemini is busy or the free quota was reached. Try again later."
                    )
                if response.status_code in {401, 403}:
                    raise GeminiClientError(
                        "Gemini rejected the API key. Check GEMINI_API_KEY and its restrictions."
                    )

                response.raise_for_status()
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
