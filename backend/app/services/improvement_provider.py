import json
import re
from abc import ABC, abstractmethod
from urllib import error, parse, request

from app.core.config import settings
from app.schemas.improvement import ImprovementReportData


class ImprovementProviderError(RuntimeError):
    pass


class ImprovementProvider(ABC):
    name: str
    model_name: str | None = None

    @abstractmethod
    def generate_improvement_report(
        self, *, parsed_cv: dict | str | None, job_description: str, match_result: dict
    ) -> ImprovementReportData:
        raise NotImplementedError


class FixtureImprovementProvider(ImprovementProvider):
    name = "fixture"
    model_name = "fitcv-deterministic-v1"

    def generate_improvement_report(
        self, *, parsed_cv: dict | str | None, job_description: str, match_result: dict
    ) -> ImprovementReportData:
        del parsed_cv, job_description, match_result
        return ImprovementReportData.model_validate({
            "skill_gaps": [
                {"skill": "Docker", "priority": "High", "reason": "The CV does not show containerization experience required by this role.", "jd_evidence": "Experience with Docker and containerized deployment."},
                {"skill": "CI/CD", "priority": "Medium", "reason": "Deployment automation is requested but is not demonstrated in the CV.", "jd_evidence": "Familiarity with CI/CD pipelines."},
                {"skill": "Redis", "priority": "Low", "reason": "Caching knowledge would strengthen the backend profile.", "jd_evidence": "Knowledge of Redis is preferred."},
            ],
            "section_feedback": [
                {"section": "WorkExperience", "issue": "Experience bullets describe responsibilities without outcomes.", "explanation": "Recruiters cannot assess the scale or impact of the work.", "priority": "High", "suggested_action": "Use action verbs and add verified scope or results for each major contribution."},
                {"section": "Summary", "issue": "The summary is generic and not tailored to the target role.", "explanation": "It misses the strongest relevant backend skills.", "priority": "Medium", "suggested_action": "Mention the target role and two or three skills already supported by the CV."},
            ],
            "rewrite_suggestions": [
                {"section": "WorkExperience", "original_text": "Responsible for developing backend features and fixing bugs.", "issue": "The statement is vague and has no verifiable scope or outcome.", "suggested_text": "Developed [N] backend features using the technologies already listed in your CV, improving [verified outcome].", "framework": "Problem → Action → Result"},
                {"section": "Projects", "original_text": "Worked with a team to build a web application.", "issue": "Your individual action and project result are unclear.", "suggested_text": "Collaborated with a team of [N] to implement [specific feature], resulting in [verified project outcome].", "framework": "Problem → Action → Result"},
            ],
            "quick_wins": [
                {"title": "Add Docker only if you have used it", "category": "Skill", "priority": "High", "explanation": "The JD explicitly requires Docker; describe a real project or course where you used it."},
                {"title": "Quantify one experience bullet", "category": "Experience", "priority": "Medium", "explanation": "Replace placeholders only with figures you can verify."},
                {"title": "Shorten the summary to three sentences", "category": "Format", "priority": "Low", "explanation": "Keep the summary focused on evidence relevant to this JD."},
            ],
        })


class GeminiImprovementProvider(ImprovementProvider):
    name = "gemini"

    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise ImprovementProviderError("GEMINI_API_KEY is required when IMPROVEMENT_PROVIDER=gemini.")
        self.model_name = settings.gemini_model

    def generate_improvement_report(
        self, *, parsed_cv: dict | str | None, job_description: str, match_result: dict
    ) -> ImprovementReportData:
        prompt = f"""You are FitCV, a careful CV improvement assistant.
Return JSON only. Base every claim on the supplied CV and JD. Never invent employers, technologies,
roles, achievements, or metrics. When a rewrite would benefit from a missing number, use a visible
placeholder such as [N users] or [X%] instead of inventing it. Suggestions are recommendations only.

The JSON object must contain exactly: skill_gaps, section_feedback, rewrite_suggestions, quick_wins.
Valid priorities: Low, Medium, High. Valid sections: Summary, WorkExperience, Skills, Education,
Projects, Other. Each skill gap needs skill, priority, reason, jd_evidence. Each section feedback needs
section, issue, explanation, priority, suggested_action. Each rewrite needs section, original_text,
issue, suggested_text, framework. Each quick win needs title, category, priority, explanation.

CV: {json.dumps(parsed_cv, ensure_ascii=False)}
JD: {job_description}
Match result: {json.dumps(match_result, ensure_ascii=False)}
"""
        body = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        }).encode("utf-8")
        model = parse.quote(self.model_name or settings.gemini_model, safe="")
        key = parse.quote(settings.gemini_api_key or "", safe="")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        try:
            with request.urlopen(request.Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            text = payload["candidates"][0]["content"]["parts"][0]["text"]
            return ImprovementReportData.model_validate_json(_strip_code_fence(text))
        except (error.URLError, TimeoutError) as exc:
            raise ImprovementProviderError("Gemini is unavailable or timed out.") from exc
        except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
            raise ImprovementProviderError("Gemini returned an invalid improvement report.") from exc


def _strip_code_fence(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[-1]
        stripped = stripped.rsplit("```", 1)[0]
    return stripped.strip()


def get_improvement_provider() -> ImprovementProvider:
    provider = settings.improvement_provider.strip().lower()
    if provider == "fixture":
        return FixtureImprovementProvider()
    if provider == "gemini":
        return GeminiImprovementProvider()
    raise ImprovementProviderError(f"Unsupported improvement provider: {settings.improvement_provider}")


def validate_report_grounding(report: ImprovementReportData, parsed_cv: dict | str | None) -> None:
    """Reject concrete rewrite metrics that are not present in the source CV.

    Placeholders such as [N] and [X%] contain no concrete digits and remain allowed.
    """
    source = json.dumps(parsed_cv, ensure_ascii=False) if isinstance(parsed_cv, dict) else str(parsed_cv or "")
    source_numbers = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", source))
    for rewrite in report.rewrite_suggestions:
        claimed = set(re.findall(r"\b\d+(?:\.\d+)?%?\b", rewrite.suggested_text))
        unsupported = claimed - source_numbers
        if unsupported:
            raise ImprovementProviderError(
                "AI rewrite introduced unsupported numeric claims; use placeholders instead."
            )
