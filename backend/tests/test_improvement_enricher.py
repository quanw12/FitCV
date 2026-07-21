from app.schemas.improvement import ImprovementReportData
from app.services.improvement_enricher import enrich_improvement_report
from app.services.improvement_validator import (
    filter_grounded_report,
    validate_report_grounding,
)


RAW_CV = """Professional Summary
Backend student focused on building reliable web applications.
Technical Skills
Python, FastAPI, MySQL
Experience
Developed backend features and fixed application defects.
Collaborated with classmates to deliver a web application.
Projects
Built a course project that processes uploaded documents.
"""

PARSED_CV = {
    "skills": ["Python", "FastAPI", "MySQL"],
    "soft_skills": [],
    "sections": {
        "summary": "Backend student focused on building reliable web applications.",
        "skills": "Python, FastAPI, MySQL",
        "experience": (
            "Developed backend features and fixed application defects.\n"
            "Collaborated with classmates to deliver a web application."
        ),
        "projects": "Built a course project that processes uploaded documents.",
    },
}

JD = """Experience with Python, Docker, Redis, and AWS is required.
Strong teamwork and communication are expected.
"""


def _moderate_match() -> dict:
    return {
        "overall_score": 57.76,
        "evidence_json": {
            "breakdown": {
                "skills": {
                    "score": 25,
                    "matched": ["Python"],
                    "missing": ["AWS", "Docker", "Redis"],
                },
                "soft_skills": {
                    "score": 0,
                    "matched": [],
                    "missing": ["Teamwork"],
                },
            }
        },
    }


def _sparse_report() -> ImprovementReportData:
    return ImprovementReportData.model_validate(
        {
            "skill_gaps": [
                {
                    "skill": "AWS",
                    "priority": "High",
                    "reason": "The analyzed CV does not show AWS evidence.",
                    "jd_evidence": "Experience with Python, Docker, Redis, and AWS is required.",
                }
            ],
            "quick_wins": [
                {
                    "title": "Review the strongest project entry",
                    "category": "Projects",
                    "priority": "Medium",
                    "explanation": "Keep the description accurate and focused on verified work.",
                }
            ],
        }
    )


def test_moderate_match_gets_richer_grounded_coverage() -> None:
    enriched = enrich_improvement_report(
        _sparse_report(),
        parsed_cv=PARSED_CV,
        raw_cv_text=RAW_CV,
        job_description=JD,
        match_result=_moderate_match(),
    )

    assert len(enriched.skill_gaps) == 4
    assert len(enriched.section_feedback) == 3
    assert len(enriched.rewrite_suggestions) == 2
    assert len(enriched.quick_wins) == 4
    assert {item.skill.casefold() for item in enriched.skill_gaps} == {
        "aws",
        "docker",
        "redis",
        "teamwork",
    }
    assert all(
        item.original_text in RAW_CV
        for item in enriched.rewrite_suggestions
    )
    assert all(
        "[verified scope or outcome]" in item.suggested_text
        for item in enriched.rewrite_suggestions
    )
    validate_report_grounding(
        enriched,
        PARSED_CV,
        JD,
        raw_cv_text=RAW_CV,
    )


def test_enrichment_does_not_invent_skill_gaps_without_analyzer_evidence() -> None:
    report = ImprovementReportData.model_validate(
        {
            "quick_wins": [
                {
                    "title": "Review every claim before submitting",
                    "category": "Other",
                    "priority": "Low",
                    "explanation": "Keep only statements that are accurate.",
                }
            ]
        }
    )

    enriched = enrich_improvement_report(
        report,
        parsed_cv=PARSED_CV,
        raw_cv_text=RAW_CV,
        job_description=JD,
        match_result={"overall_score": 57.76, "evidence_json": {"breakdown": {}}},
    )

    assert enriched.skill_gaps == []
    assert len(enriched.section_feedback) == 3
    assert len(enriched.rewrite_suggestions) == 2
    assert len(enriched.quick_wins) == 4
    validate_report_grounding(
        enriched,
        PARSED_CV,
        JD,
        raw_cv_text=RAW_CV,
    )


def test_strong_match_uses_lower_coverage_targets() -> None:
    enriched = enrich_improvement_report(
        ImprovementReportData(),
        parsed_cv=PARSED_CV,
        raw_cv_text=RAW_CV,
        job_description=JD,
        match_result={"overall_score": 92, "evidence_json": {"breakdown": {}}},
    )

    assert len(enriched.section_feedback) == 2
    assert len(enriched.rewrite_suggestions) == 1
    assert len(enriched.quick_wins) == 3
    validate_report_grounding(
        enriched,
        PARSED_CV,
        JD,
        raw_cv_text=RAW_CV,
    )


def test_unstructured_cv_still_gets_moderate_match_feedback() -> None:
    enriched = enrich_improvement_report(
        ImprovementReportData(),
        parsed_cv=RAW_CV,
        raw_cv_text=RAW_CV,
        job_description=JD,
        match_result=_moderate_match(),
    )

    assert len(enriched.section_feedback) == 3
    assert {item.section.value for item in enriched.section_feedback} == {"Other"}
    assert len(enriched.rewrite_suggestions) == 2
    assert len(enriched.quick_wins) == 4
    validate_report_grounding(
        enriched,
        RAW_CV,
        JD,
        raw_cv_text=RAW_CV,
    )


def test_empty_provider_report_can_be_enriched_before_final_validation() -> None:
    invalid = ImprovementReportData.model_validate(
        {
            "quick_wins": [
                {
                    "title": "Add 12 achievements",
                    "category": "Other",
                    "priority": "High",
                    "explanation": "Use verified evidence.",
                }
            ]
        }
    )
    filtered = filter_grounded_report(
        invalid,
        PARSED_CV,
        JD,
        raw_cv_text=RAW_CV,
        require_any=False,
    )
    assert filtered == ImprovementReportData()

    enriched = enrich_improvement_report(
        filtered,
        parsed_cv=PARSED_CV,
        raw_cv_text=RAW_CV,
        job_description=JD,
        match_result=_moderate_match(),
    )
    final = filter_grounded_report(
        enriched,
        PARSED_CV,
        JD,
        raw_cv_text=RAW_CV,
    )

    assert len(final.section_feedback) == 3
    assert len(final.rewrite_suggestions) == 2
    assert len(final.quick_wins) == 4
