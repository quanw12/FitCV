from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.grounding import (
    find_missing_sections,
    find_unfounded_numbers,
)


class TestFindUnfoundedNumbers:
    def test_grounded_cv_has_no_violations(self) -> None:
        cv = CVData(
            name="Nguyen Van A",
            summary="Backend engineer with 3 years of experience.",
            experience=[
                {
                    "title": "Engineer",
                    "company": "Acme",
                    "date": "2020-2023",
                    "bullets": ["Built a system serving 2M transactions a day."],
                }
            ],
        )
        source = (
            "Nguyen Van A. Backend engineer with 3 years of experience at "
            "Acme (2020-2023). Built a system serving 2M transactions a day."
        )
        assert find_unfounded_numbers(source, cv) == []

    def test_invented_metric_is_flagged(self) -> None:
        cv = CVData(
            name="A",
            summary="Reduced latency by 40% and served 2 million users.",
        )
        assert find_unfounded_numbers("Backend engineer with 3 years.", cv) == ["2", "40"]

    def test_contact_fields_are_ignored(self) -> None:
        cv = CVData(
            name="A",
            email="a2@example.com",
            phone="+84 912 345 678",
            links=[{"label": "GitHub", "url": "https://github.com/user3"}],
            summary="Engineer.",
        )
        assert find_unfounded_numbers("Engineer.", cv) == []

    def test_thousands_separator_formatting_tolerated(self) -> None:
        cv = CVData(
            name="A",
            summary="Handled 1,000,000 requests per day.",
        )
        source = "Handled 1000000 requests per day."
        assert find_unfounded_numbers(source, cv) == []

    def test_decimal_comma_formatting_tolerated(self) -> None:
        cv = CVData(
            name="A",
            summary="Cut latency from 2.5s to 1.2s.",
        )
        source = "Cut latency từ 2,5s xuống 1,2s."
        assert find_unfounded_numbers(source, cv) == []

    def test_numbers_in_language_proficiency_must_be_grounded(self) -> None:
        cv = CVData(
            name="A",
            summary="Engineer.",
            languages=[{"name": "English", "proficiency": "IELTS 7.5"}],
        )
        assert find_unfounded_numbers("Engineer. IELTS 7.5", cv) == []
        assert find_unfounded_numbers("Engineer.", cv) == ["5", "7"]

    def test_empty_source_flags_every_number(self) -> None:
        cv = CVData(name="A", summary="Built 3 projects in 2024.")
        assert find_unfounded_numbers("", cv) == ["2024", "3"]

    def test_empty_cv_has_no_violations(self) -> None:
        assert find_unfounded_numbers("anything 123", CVData()) == []


class TestFindMissingSections:
    def _entered(self) -> CVData:
        return CVData(
            name="A",
            summary="Backend engineer.",
            skills=["Python"],
            experience=[{"title": "Engineer", "bullets": ["Built APIs."]}],
            projects=[{"name": "FitCV", "description": "AI CV screening."}],
            education=[{"degree": "B.Sc.", "institution": "HUS", "date": "2020"}],
            languages=[{"name": "English", "proficiency": "Fluent"}],
            certifications=["AWS Certified"],
            publications=[{"title": "Paper", "venue": "Journal"}],
            awards=["Dean's List"],
        )

    def test_all_sections_present_in_output(self) -> None:
        entered = self._entered()
        assert find_missing_sections(entered, entered.model_copy()) == []

    def test_dropped_sections_are_flagged(self) -> None:
        entered = self._entered()
        output = entered.model_copy(
            update={
                "projects": [],
                "publications": [],
                "awards": [],
                "languages": [],
            }
        )
        assert find_missing_sections(entered, output) == [
            "projects",
            "languages",
            "publications",
            "awards",
        ]

    def test_emptied_summary_is_flagged(self) -> None:
        entered = self._entered()
        output = entered.model_copy(update={"summary": ""})
        assert find_missing_sections(entered, output) == ["summary"]

    def test_sections_not_in_entered_are_ignored(self) -> None:
        entered = CVData(name="A", summary="Engineer.")
        output = CVData(name="A", summary="Engineer.")
        assert find_missing_sections(entered, output) == []

    def test_partially_dropped_entries_are_not_flagged(self) -> None:
        entered = self._entered()
        output = entered.model_copy(
            update={"experience": [entered.experience[0]]}
        )
        assert find_missing_sections(entered, output) == []

    def test_derived_sections_are_never_checked(self) -> None:
        entered = self._entered()
        output = entered.model_copy(update={"core_competencies": [], "skill_groups": []})
        assert find_missing_sections(entered, output) == []
