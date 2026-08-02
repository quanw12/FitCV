"""Extract + polish a CV from raw text with a single Gemini call."""

from pydantic import ValidationError

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.grounding import (
    find_missing_sections,
    find_unfounded_numbers,
)
from app.services.cv_rebuild.prompts import (
    CV_DATA_JSON_SCHEMA,
    build_extraction_prompt,
    build_polish_prompt,
)
from app.services.gemini_client import GeminiClient, GeminiClientError


class CvExtractionError(RuntimeError):
    """Raised when the LLM output is still invalid after all attempts."""


_GROUNDING_MESSAGE = (
    "Grounded-numbers check: the following numbers or metrics in your output "
    "are NOT present in the source text: {numbers}. Keep the wording "
    "impressive but 100% truthful: remove every number the source does not "
    "state, or write the metric in words exactly as the source does."
)

_COMPLETENESS_MESSAGE = (
    "Completeness check: the following sections exist in the entered "
    "information but are missing or empty in your output: {sections}. Keep "
    "every entered section, entry, bullet, and detail; never drop content."
)


def _grounding_message(unfounded: list[str]) -> str:
    return _GROUNDING_MESSAGE.format(numbers=", ".join(unfounded))


def _completeness_message(missing: list[str]) -> str:
    return _COMPLETENESS_MESSAGE.format(sections=", ".join(missing))


class CvExtractor:
    def __init__(self, client: GeminiClient | None = None) -> None:
        self._client = client or GeminiClient()

    def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
        last_error: str | None = None
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
                last_error = str(exc)
                prompt = build_extraction_prompt(raw_text, last_error)
        raise CvExtractionError(
            f"AI returned an invalid CV structure after {max_attempts} attempts. "
            f"Last validation errors: {last_error}"
        )

    def polish(self, cv: CVData, *, language: str = "en", max_attempts: int = 3) -> CVData:
        last_error: str | None = None
        last_cv: CVData | None = None
        source_text = cv.model_dump_json()
        prompt = build_polish_prompt(source_text, language)
        for _ in range(max_attempts):
            try:
                payload = self._client.generate_structured(
                    prompt=prompt,
                    response_schema=CV_DATA_JSON_SCHEMA,
                )
            except GeminiClientError:
                raise
            try:
                polished = CVData.model_validate(payload)
            except ValidationError as exc:
                last_error = str(exc)
                prompt = build_polish_prompt(source_text, language, last_error)
                continue
            unfounded = find_unfounded_numbers(source_text, polished)
            missing = find_missing_sections(cv, polished)
            if unfounded or missing:
                last_cv = polished
                messages = []
                if unfounded:
                    messages.append(_grounding_message(unfounded))
                if missing:
                    messages.append(_completeness_message(missing))
                last_error = "\n".join(messages)
                prompt = build_polish_prompt(source_text, language, last_error)
                continue
            return polished
        if last_cv is not None:
            return last_cv
        raise CvExtractionError(
            f"AI returned an invalid CV structure after {max_attempts} attempts. "
            f"Last validation errors: {last_error}"
        )
