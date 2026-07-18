import json

import pytest

from app.core.config import settings
from app.schemas.improvement import ImprovementReportData
from app.services import improvement_provider
from app.services.improvement_provider import (
    FixtureImprovementProvider,
    GeminiImprovementProvider,
    ImprovementProviderError,
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


def test_fixture_report_is_grounded_in_demo_sources() -> None:
    report = FixtureImprovementProvider().generate_improvement_report(
        parsed_cv=CV_TEXT,
        job_description=JD_TEXT,
        match_result={"overall_score": 68},
    )

    validate_report_grounding(report, CV_TEXT, JD_TEXT)
    assert [gap.priority for gap in report.skill_gaps] == ["High", "Medium", "Low"]


def test_grounding_rejects_skill_gap_not_in_job_description() -> None:
    report = FixtureImprovementProvider().generate_improvement_report(
        parsed_cv=CV_TEXT,
        job_description=JD_TEXT,
        match_result={"overall_score": 68},
    )
    payload = report.model_dump(mode="json")
    payload["skill_gaps"][0]["skill"] = "Kubernetes"

    with pytest.raises(ImprovementProviderError, match="job description"):
        validate_report_grounding(ImprovementReportData.model_validate(payload), CV_TEXT, JD_TEXT)


def test_grounding_rejects_skill_gap_already_in_cv() -> None:
    report = FixtureImprovementProvider().generate_improvement_report(
        parsed_cv=CV_TEXT,
        job_description=JD_TEXT,
        match_result={"overall_score": 68},
    )

    with pytest.raises(ImprovementProviderError, match="already present"):
        validate_report_grounding(report, f"{CV_TEXT}\nDocker", JD_TEXT)


def test_grounding_rejects_rewrite_original_text_not_in_cv() -> None:
    report = FixtureImprovementProvider().generate_improvement_report(
        parsed_cv=CV_TEXT,
        job_description=JD_TEXT,
        match_result={"overall_score": 68},
    )
    payload = report.model_dump(mode="json")
    payload["rewrite_suggestions"][0]["original_text"] = "Built a payment system from scratch."

    with pytest.raises(ImprovementProviderError, match="source CV"):
        validate_report_grounding(ImprovementReportData.model_validate(payload), CV_TEXT, JD_TEXT)


def test_grounding_rejects_unsupported_numeric_claim() -> None:
    report = FixtureImprovementProvider().generate_improvement_report(
        parsed_cv=CV_TEXT,
        job_description=JD_TEXT,
        match_result={"overall_score": 68},
    )
    payload = report.model_dump(mode="json")
    payload["rewrite_suggestions"][0]["suggested_text"] = "Developed 12 backend features."

    with pytest.raises(ImprovementProviderError, match="numeric"):
        validate_report_grounding(ImprovementReportData.model_validate(payload), CV_TEXT, JD_TEXT)


def test_gemini_request_uses_header_key_schema_and_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(settings, "gemini_model", "gemini-test-model")
    monkeypatch.setattr(settings, "gemini_timeout_seconds", 1)
    monkeypatch.setattr(settings, "gemini_max_retries", 1)
    monkeypatch.setattr(improvement_provider.time, "sleep", lambda _seconds: None)

    report = FixtureImprovementProvider().generate_improvement_report(
        parsed_cv=CV_TEXT,
        job_description=JD_TEXT,
        match_result={"overall_score": 68},
    )
    calls = []

    class FakeResponse:
        def __init__(self, status_code: int, payload: dict | None = None) -> None:
            self.status_code = status_code
            self._payload = payload or {}

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
                    {"content": {"parts": [{"text": json.dumps(report.model_dump(mode="json"))}]}}
                ]
            },
        )

    monkeypatch.setattr(improvement_provider.requests, "post", fake_post)

    result = GeminiImprovementProvider().generate_improvement_report(
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
