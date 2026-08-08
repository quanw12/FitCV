import pytest

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.llm_extractor import CvExtractionError, CvExtractor
from app.services.cv_rebuild.prompts import build_polish_prompt
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


RAW_TEXT = (
    "Nguyen Van A, a@example.com. Backend engineer with 3 years of experience "
    "at Acme (2020-2023), building payment APIs in Python."
)

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

ENTERED_CV = CVData(
    name="B",
    summary="Backend engineer with 3 years of experience.",
    experience=[
        {"title": "Engineer", "company": "Acme", "date": "2020-2023", "bullets": ["Built APIs."]}
    ],
    skills=["Python"],
)


class TestPolishPrompt:
    def test_polish_prompt_includes_jd_when_provided(self) -> None:
        prompt = build_polish_prompt(
            '{"name": "A"}', "en", jd_text="Backend role with Redis"
        )
        assert "<jd_text>" in prompt
        assert "Redis" in prompt

    def test_polish_prompt_omits_jd_by_default(self) -> None:
        prompt = build_polish_prompt('{"name": "A"}', "en")
        assert "<jd_text>" not in prompt


class TestExtract:
    def test_valid_payload_returns_cvdata(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        cv = CvExtractor(client=client).extract(RAW_TEXT)
        assert cv.name == "Nguyen Van A"
        assert cv.skills == ["Python"]
        assert len(client.prompts) == 1

    def test_retries_on_invalid_payload_and_reports_error(self) -> None:
        client = FakeGeminiClient(["not json", VALID_PAYLOAD])
        cv = CvExtractor(client=client).extract(RAW_TEXT)
        assert cv.name == "Nguyen Van A"
        assert len(client.prompts) == 2

    def test_retry_prompt_includes_validation_error(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, VALID_PAYLOAD])
        CvExtractor(client=client).extract(RAW_TEXT)
        assert "skills" in client.prompts[1]
        assert "Previous attempt" in client.prompts[1]

    def test_exhausts_attempts_then_raises(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, {"skills": "Python"}, {"skills": "Python"}])
        with pytest.raises(CvExtractionError, match="3 attempts"):
            CvExtractor(client=client).extract(RAW_TEXT)
        assert len(client.prompts) == 3

    def test_defaults_max_attempts_to_three(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, {"skills": "Python"}, {"skills": "Python"}])
        with pytest.raises(CvExtractionError):
            CvExtractor(client=client).extract(RAW_TEXT)
        assert len(client.prompts) == 3

    def test_propagates_gemini_failure(self) -> None:
        class BrokenClient:
            def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
                raise GeminiClientError("Gemini is unavailable.")

        with pytest.raises(GeminiClientError, match="unavailable"):
            CvExtractor(client=BrokenClient()).extract(RAW_TEXT)

    def test_omits_validation_section_on_first_attempt(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        CvExtractor(client=client).extract(RAW_TEXT)
        assert "Previous attempt" not in client.prompts[0]
        assert "Raw CV text" in client.prompts[0]

    def test_prompt_keeps_vietnamese_name_in_english_cv(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        CvExtractor(client=client).extract(RAW_TEXT)
        prompt = client.prompts[0]
        assert "Vietnamese" in prompt
        assert "diacritics" in prompt
        assert '"Nguyễn Văn A"' in prompt


class TestPolish:
    def test_polish_returns_cvdata_with_language_prompt(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        cv, warnings = CvExtractor(client=client).polish(
            ENTERED_CV, language="vi"
        )
        assert cv.name == "Nguyen Van A"
        assert warnings == []
        assert "Vietnamese" in client.prompts[0]
        assert '"name":"B"' in client.prompts[0]

    def test_polish_retries_on_invalid_payload(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, VALID_PAYLOAD])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV)
        assert len(client.prompts) == 2
        assert "Previous attempt" in client.prompts[1]

    def test_polish_exhausts_attempts_then_raises(self) -> None:
        client = FakeGeminiClient([{"skills": "x"}, {"skills": "x"}, {"skills": "x"}])
        with pytest.raises(CvExtractionError, match="3 attempts"):
            CvExtractor(client=client).polish(ENTERED_CV)
        assert len(client.prompts) == 3

    def test_polish_prompt_keeps_vietnamese_name(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        CvExtractor(client=client).polish(ENTERED_CV, language="en")
        prompt = client.prompts[0]
        assert "Vietnamese" in prompt
        assert "diacritics" in prompt
        assert '"Nguyễn Văn A"' in prompt

    def test_polish_rejects_invented_metrics(self) -> None:
        import copy

        invented = copy.deepcopy(VALID_PAYLOAD)
        invented["experience"][0]["bullets"] = ["Cut API latency by 42%."]
        client = FakeGeminiClient([invented, VALID_PAYLOAD])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV)
        assert cv.experience[0].bullets == ["Built APIs."]
        assert len(client.prompts) == 2
        assert "42" in client.prompts[1]

    def test_polish_retries_when_an_applied_change_invents_a_skill(self) -> None:
        invented = dict(VALID_PAYLOAD)
        invented["skills"] = ["Python", "Kubernetes"]
        client = FakeGeminiClient([invented, VALID_PAYLOAD])
        cv, warnings = CvExtractor(client=client).polish(
            ENTERED_CV,
            applied_improvements="- [Skill gap] Highlight Kubernetes only if grounded.",
        )
        assert cv.skills == ["Python"]
        assert warnings == []
        assert len(client.prompts) == 2
        assert "Kubernetes" in client.prompts[1]
        assert "<approved_improvements>" in client.prompts[0]

    def test_polish_retries_when_entered_section_is_dropped(self) -> None:
        entered = CVData.model_validate(
            {
                "name": "B",
                "summary": "Backend engineer with 3 years of experience.",
                "experience": [
                    {
                        "title": "Engineer",
                        "company": "Acme",
                        "date": "2020-2023",
                        "bullets": ["Built APIs."],
                    }
                ],
                "projects": [{"name": "FitCV", "description": "AI CV screening."}],
                "awards": ["Dean's List 2024"],
                "skills": ["Python"],
            }
        )
        dropped = dict(VALID_PAYLOAD)
        dropped["projects"] = []
        dropped["awards"] = []
        fixed = dict(VALID_PAYLOAD)
        fixed["projects"] = [{"name": "FitCV", "description": "AI CV screening."}]
        fixed["awards"] = ["Dean's List 2024"]
        client = FakeGeminiClient([dropped, fixed])
        cv, warnings = CvExtractor(client=client).polish(entered)
        assert len(client.prompts) == 2
        assert "projects" in client.prompts[1]
        assert "awards" in client.prompts[1]
        assert "missing or empty" in client.prompts[1]
