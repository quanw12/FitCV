"""Extract + polish a CV from raw text with a single Gemini call."""

from pydantic import ValidationError

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.prompts import CV_DATA_JSON_SCHEMA, build_extraction_prompt
from app.services.gemini_client import GeminiClient, GeminiClientError


class CvExtractionError(RuntimeError):
    """Raised when the LLM output is still invalid after all attempts."""


class CvExtractor:
    def __init__(self, client: GeminiClient | None = None) -> None:
        self._client = client or GeminiClient()

    def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
        last_error: ValidationError | None = None
        prompt = build_extraction_prompt(raw_text)
        for _ in range(max_attempts):
            try:
                payload = self._client.generate_structured(
                    prompt=prompt,
                    response_schema=CV_DATA_JSON_SCHEMA,
                )
            except GeminiClientError:
                raise
            try:
                return CVData.model_validate(payload)
            except ValidationError as exc:
                last_error = exc
                prompt = build_extraction_prompt(raw_text, str(last_error))
        raise CvExtractionError(
            f"AI returned an invalid CV structure after {max_attempts} attempts. "
            f"Last validation errors: {last_error}"
        )
