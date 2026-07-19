import json
from abc import ABC, abstractmethod

from pydantic import ValidationError

from app.schemas.improvement import ImprovementReportData
from app.services.gemini_client import GeminiClient, GeminiClientError


class ImprovementProviderError(RuntimeError):
    pass


class ImprovementProvider(ABC):
    name: str
    model_name: str

    @abstractmethod
    def generate_improvement_report(
        self,
        *,
        parsed_cv: dict | str | None,
        job_description: str,
        match_result: dict,
    ) -> ImprovementReportData:
        raise NotImplementedError


class GeminiImprovementProvider(ImprovementProvider):
    name = "gemini"

    def __init__(self, client: GeminiClient | None = None) -> None:
        try:
            self.client = client or GeminiClient()
        except GeminiClientError as exc:
            raise ImprovementProviderError(str(exc)) from exc
        self.model_name = self.client.model_name

    def generate_improvement_report(
        self,
        *,
        parsed_cv: dict | str | None,
        job_description: str,
        match_result: dict,
    ) -> ImprovementReportData:
        prompt = f"""You are FitCV, a careful CV improvement assistant.
Base every claim on the supplied CV and JD. Never invent employers, technologies, roles,
achievements, or metrics. When a rewrite would benefit from a missing number, use a visible
placeholder such as [N users] or [X%] instead of inventing it. Suggestions are recommendations only.
Copy jd_evidence exactly from the JD. Copy original_text exactly from the CV. A skill gap is valid
only when that skill is explicitly present in the JD and missing from the CV.

Return the exact structure required by the supplied JSON schema. Valid priorities are Low, Medium,
and High. Valid sections are Summary, WorkExperience, Skills, Education, Projects, and Other.

CV: {json.dumps(parsed_cv, ensure_ascii=False)}
JD: {job_description}
Match result: {json.dumps(match_result, ensure_ascii=False)}
"""
        try:
            payload = self.client.generate_structured(
                prompt=prompt,
                response_schema=ImprovementReportData.model_json_schema(),
            )
            return ImprovementReportData.model_validate(payload)
        except GeminiClientError as exc:
            raise ImprovementProviderError(str(exc)) from exc
        except ValidationError as exc:
            raise ImprovementProviderError(
                "Gemini returned an invalid improvement report."
            ) from exc


def get_improvement_provider() -> ImprovementProvider:
    return GeminiImprovementProvider()
