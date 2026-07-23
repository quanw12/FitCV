import unittest
from types import SimpleNamespace

from app.services.document_parser import parse_cv_text, parse_jd_text
from app.services.match_engine import (
    build_structured_job_scoring_text,
    normalize_scoring_jd_text,
    score_match,
)
from app.services.matching_service import (
    ALGORITHM_VERSION,
    SCORING_FRAMEWORK_VERSION,
    supplement_semantic_jd,
)
from app.services.improvement_service import _match_context_payload


CV_TEXT = """
Alex Nguyen
Backend Engineer
Skills
Python, FastAPI, SQL, Docker
Experience
3 years building REST APIs.
Education
Bachelor degree in Computer Science.
Strong communication and teamwork.
"""

SCORING_JD = """
Job title
Backend Engineer
About the job
Build reliable backend services.
Responsibilities
Develop REST APIs using Python and FastAPI.
Requirements
3 years experience. Bachelor degree. SQL and communication are required.
Docker is preferred.
"""


class MatchEngineTests(unittest.TestCase):
    def test_non_requirement_sections_do_not_change_score(self) -> None:
        full_jd = SCORING_JD + """
We offer
Kubernetes training, Azure credits and a learning budget.
Life at company
We use JavaScript at social events.
Hiring process
Candidates meet the teamwork panel in three interviews.
"""
        normalized = normalize_scoring_jd_text(full_jd)
        self.assertNotIn("Kubernetes", normalized)
        self.assertNotIn("JavaScript", normalized)
        self.assertNotIn("three interviews", normalized)

        baseline = score_match(
            cv_text=CV_TEXT,
            jd_text=SCORING_JD,
            algorithm_version=ALGORITHM_VERSION,
            source_scope="test-baseline",
        )
        with_non_requirements = score_match(
            cv_text=CV_TEXT,
            jd_text=full_jd,
            algorithm_version=ALGORITHM_VERSION,
            source_scope="test-full-job",
        )
        self.assertEqual(
            baseline["overall_score"],
            with_non_requirements["overall_score"],
        )
        self.assertEqual(
            baseline["matching_inputs"],
            with_non_requirements["matching_inputs"],
        )

    def test_structured_job_and_batch_jd_use_same_rubric(self) -> None:
        structured = build_structured_job_scoring_text(
            title="Backend Engineer",
            description=None,
            about_job="Build reliable backend services.",
            responsibilities="Develop REST APIs using Python and FastAPI.",
            requirements=(
                "3 years experience. Bachelor degree. SQL and communication "
                "are required. Docker is preferred."
            ),
        )
        cv_payload = parse_cv_text(CV_TEXT)
        structured_result = score_match(
            cv_text=CV_TEXT,
            jd_text=structured,
            parsed_cv=cv_payload,
            parsed_jd=parse_jd_text(structured),
            algorithm_version=ALGORITHM_VERSION,
            source_scope="job-application",
        )
        batch_result = score_match(
            cv_text=CV_TEXT,
            jd_text=SCORING_JD,
            parsed_cv=cv_payload,
            parsed_jd=parse_jd_text(SCORING_JD),
            algorithm_version=ALGORITHM_VERSION,
            source_scope="hr-batch-upload",
        )
        self.assertEqual(
            structured_result["overall_score"],
            batch_result["overall_score"],
        )
        self.assertEqual(
            structured_result["breakdown"],
            batch_result["breakdown"],
        )
        self.assertEqual(
            structured_result["engine"]["framework_version"],
            SCORING_FRAMEWORK_VERSION,
        )
        self.assertEqual(
            structured_result["eligibility"]["status"],
            "not_evaluated",
        )

    def test_semantic_jd_keeps_locally_grounded_requirements(self) -> None:
        supplemented = supplement_semantic_jd(
            {
                "required_skills": ["Python"],
                "preferred_skills": [],
                "required_skill_groups": [],
                "preferred_skill_groups": [],
                "experience_years": None,
                "education": None,
                "soft_skills": [],
            },
            {
                "required_skills": ["Python", "FastAPI"],
                "preferred_skills": ["Docker"],
                "experience_years": 3,
                "education": "Bachelor",
                "soft_skills": ["Communication"],
            },
        )
        self.assertEqual(supplemented["required_skills"], ["FastAPI", "Python"])
        self.assertEqual(supplemented["preferred_skills"], ["Docker"])
        self.assertEqual(supplemented["experience_years"], 3)
        self.assertEqual(supplemented["education"], "Bachelor")
        self.assertEqual(supplemented["soft_skills"], ["Communication"])

    def test_improvement_consumes_the_same_persisted_engine_result(self) -> None:
        result = score_match(
            cv_text=CV_TEXT,
            jd_text=SCORING_JD,
            algorithm_version=ALGORITHM_VERSION,
            source_scope="student-analyzer",
        )
        match = SimpleNamespace(
            overall_score=result["overall_score"],
            algorithm_version=result["algorithm_version"],
            model_name=result["algorithm_version"],
            skill_score=result["breakdown"]["skills"]["score"],
            experience_score=result["breakdown"]["experience"]["score"],
            education_score=result["breakdown"]["education"]["score"],
            soft_skill_score=result["breakdown"]["soft_skills"]["score"],
            match_summary=result["match_summary"],
            strengths=result["strengths"],
            weaknesses=result["weaknesses"],
            recommendation=result["suggestions"],
            evidence_json={
                "breakdown": result["breakdown"],
                "matching_inputs": result["matching_inputs"],
                "engine": result["engine"],
                "rubric": result["rubric"],
                "eligibility": result["eligibility"],
            },
        )
        improvement_context = _match_context_payload(match)
        self.assertEqual(
            improvement_context["overall_score"],
            result["overall_score"],
        )
        self.assertEqual(
            improvement_context["algorithm_version"],
            ALGORITHM_VERSION,
        )
        self.assertEqual(
            improvement_context["evidence_json"]["engine"]["framework_version"],
            SCORING_FRAMEWORK_VERSION,
        )


if __name__ == "__main__":
    unittest.main()
