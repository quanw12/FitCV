import json

import pytest

from app.core.config import settings
from app.schemas.improvement import ImprovementReportData
from app.services import gemini_client
from app.services.gemini_client import GeminiClient
from app.services.improvement_provider import GeminiImprovementProvider
from app.services.improvement_report_mapper import report_to_suggestions, suggestions_to_report
from app.services.improvement_validator import (
    ImprovementValidationError,
    validate_report_grounding,
)

CV_TEXT = """
Responsible for developing backend features and fixing bugs.
Worked with a team to build a web application.
"""

JD_TEXT = """
Experience with Docker and containerized deployment.
Familiarity with CI/CD pipelines.
Knowledge of Redis is preferred.
"""


def build_report() -> ImprovementReportData:
    return ImprovementReportData.model_validate({
        "skill_gaps": [
            {
                "skill": "Docker",
                "priority": "High",
                "reason": "The CV does not show required containerization experience.",
                "jd_evidence": "Experience with Docker and containerized deployment.",
            },
            {
                "skill": "CI/CD",
                "priority": "Medium",
                "reason": "Deployment automation is not demonstrated in the CV.",
                "jd_evidence": "Familiarity with CI/CD pipelines.",
            },
            {
                "skill": "Redis",
                "priority": "Low",
                "reason": "Caching knowledge would strengthen the backend profile.",
                "jd_evidence": "Knowledge of Redis is preferred.",
            },
        ],
        "section_feedback": [
            {
                "section": "WorkExperience",
                "issue": "Experience bullets describe responsibilities without outcomes.",
                "explanation": "Recruiters cannot assess the impact of the work.",
                "priority": "High",
                "suggested_action": "Add verified scope or results.",
            }
        ],
        "rewrite_suggestions": [
            {
                "section": "WorkExperience",
                "original_text": "Responsible for developing backend features and fixing bugs.",
                "issue": "The statement is vague.",
                "suggested_text": "Developed [N] backend features, improving [verified outcome].",
                "framework": "Problem → Action → Result",
            }
        ],
        "quick_wins": [
            {
                "title": "Quantify one experience bullet",
                "category": "Experience",
                "priority": "Medium",
                "explanation": "Use only figures you can verify.",
            }
        ],
    })


def test_valid_report_is_grounded_in_sources() -> None:
    report = build_report()

    validate_report_grounding(report, CV_TEXT, JD_TEXT)


def test_grounding_rejects_skill_gap_not_in_job_description() -> None:
    payload = build_report().model_dump(mode="json")
    payload["skill_gaps"][0]["skill"] = "Kubernetes"

    with pytest.raises(ImprovementValidationError, match="job description"):
        validate_report_grounding(ImprovementReportData.model_validate(payload), CV_TEXT, JD_TEXT)


def test_grounding_rejects_skill_gap_already_in_cv() -> None:
    with pytest.raises(ImprovementValidationError, match="already present"):
        validate_report_grounding(build_report(), f"{CV_TEXT}\nDocker", JD_TEXT)


def test_grounding_rejects_rewrite_original_text_not_in_cv() -> None:
    payload = build_report().model_dump(mode="json")
    payload["rewrite_suggestions"][0]["original_text"] = "Built a payment system."

    with pytest.raises(ImprovementValidationError, match="source CV"):
        validate_report_grounding(ImprovementReportData.model_validate(payload), CV_TEXT, JD_TEXT)


def test_grounding_rejects_unsupported_numeric_claim() -> None:
    payload = build_report().model_dump(mode="json")
    payload["rewrite_suggestions"][0]["suggested_text"] = "Developed 12 backend features."

    with pytest.raises(ImprovementValidationError, match="numeric"):
        validate_report_grounding(ImprovementReportData.model_validate(payload), CV_TEXT, JD_TEXT)


def test_report_mapping_round_trip() -> None:
    report = build_report()

    restored = suggestions_to_report(report_to_suggestions(42, report))

    assert restored == report


def test_gemini_request_uses_header_schema_and_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(settings, "gemini_model", "gemini-test-model")
    monkeypatch.setattr(settings, "gemini_timeout_seconds", 1)
    monkeypatch.setattr(settings, "gemini_max_retries", 1)
    monkeypatch.setattr(gemini_client.time, "sleep", lambda _seconds: None)

    report = build_report()
    calls = []

    class FakeResponse:
        def __init__(self, status_code: int, payload: dict | None = None) -> None:
            self.status_code = status_code
            self._payload = payload or {}
            self.headers: dict[str, str] = {}

        def raise_for_status(self) -> None:
            if self.status_code >= 400:
                raise AssertionError(f"Unexpected status {self.status_code}")

        def json(self) -> dict:
            return self._payload

    def fake_post(url: str, **kwargs):
        calls.append({"url": url, **kwargs})
        if len(calls) == 1:
            return FakeResponse(429)
        return FakeResponse(
            200,
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": json.dumps(report.model_dump(mode="json"))}
                            ]
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(gemini_client.requests, "post", fake_post)

    result = GeminiImprovementProvider(GeminiClient()).generate_improvement_report(
        parsed_cv=CV_TEXT,
        job_description=JD_TEXT,
        match_result={"overall_score": 68},
    )

    assert result.skill_gaps[0].skill == "Docker"
    assert len(calls) == 2
    assert "key=" not in calls[0]["url"]
    assert calls[0]["headers"]["x-goog-api-key"] == "test-key"
    assert calls[0]["json"]["generationConfig"]["responseMimeType"] == "application/json"
    assert "responseJsonSchema" in calls[0]["json"]["generationConfig"]
