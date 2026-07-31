import pytest

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.llm_extractor import CvExtractionError, CvExtractor
from app.services.gemini_client import GeminiClientError


class FakeGeminiClient:
    def __init__(self, responses: list[dict]) -> None:
        self.responses = list(responses)
        self.prompts: list[str] = []

    def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
        self.prompts.append(prompt)
        if not self.responses:
            raise AssertionError("generate_structured called more times than responses provided")
        return self.responses.pop(0)


VALID_PAYLOAD = {
    "name": "Nguyen Van A",
    "email": "a@example.com",
    "phone": "",
    "summary": "Backend engineer with 3 years of experience.",
    "experience": [{"title": "Engineer", "company": "Acme", "date": "2020-2023", "bullets": ["Built APIs."]}],
    "skills": ["Python"],
    "projects": [],
    "certifications": [],
    "education": [],
}


class TestExtract:
    def test_valid_payload_returns_cvdata(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        cv = CvExtractor(client=client).extract("raw text")
        assert cv.name == "Nguyen Van A"
        assert cv.skills == ["Python"]
        assert len(client.prompts) == 1

    def test_retries_on_invalid_payload_and_reports_error(self) -> None:
        client = FakeGeminiClient(["not json", VALID_PAYLOAD])
        cv = CvExtractor(client=client).extract("raw text")
        assert cv.name == "Nguyen Van A"
        assert len(client.prompts) == 2

    def test_retry_prompt_includes_validation_error(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, VALID_PAYLOAD])
        CvExtractor(client=client).extract("raw text")
        assert "skills" in client.prompts[1]
        assert "Previous attempt" in client.prompts[1]

    def test_exhausts_attempts_then_raises(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, {"skills": "Python"}, {"skills": "Python"}])
        with pytest.raises(CvExtractionError, match="3 attempts"):
            CvExtractor(client=client).extract("raw text")
        assert len(client.prompts) == 3

    def test_defaults_max_attempts_to_three(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, {"skills": "Python"}, {"skills": "Python"}])
        with pytest.raises(CvExtractionError):
            CvExtractor(client=client).extract("raw text")
        assert len(client.prompts) == 3

    def test_propagates_gemini_failure(self) -> None:
        class BrokenClient:
            def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
                raise GeminiClientError("Gemini is unavailable.")

        with pytest.raises(GeminiClientError, match="unavailable"):
            CvExtractor(client=BrokenClient()).extract("raw text")

    def test_omits_validation_section_on_first_attempt(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        CvExtractor(client=client).extract("raw text")
        assert "Previous attempt" not in client.prompts[0]
        assert "Raw CV text" in client.prompts[0]
