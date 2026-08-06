from app.schemas.cv_rebuild import CVData, CvExperienceItem
from app.services.cv_rebuild.grounding import (
    find_missing_sections,
    find_title_inflation,
    find_unfounded_numbers,
    find_unfounded_skills,
)
from app.services.cv_rebuild.llm_extractor import _entry_count_message, _title_message


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


class TestFindUnfoundedSkills:
    def test_grounded_skills_are_not_flagged(self) -> None:
        cv = CVData(
            name="A",
            skills=["Python", "React"],
            core_competencies=[{"name": "Backend Development"}],
            skill_groups=[{"category": "Languages", "items": ["Python"]}],
        )
        source = (
            "Backend developer with experience in Python and React. "
            "Công nghệ phát triển phần mềm."
        )
        assert find_unfounded_skills(source, cv) == []

    def test_invented_skill_is_flagged(self) -> None:
        cv = CVData(name="A", skills=["Python", "Rust"])
        assert find_unfounded_skills("Engineer who knows Python.", cv) == ["Rust"]

    def test_inflection_is_lenient(self) -> None:
        cv = CVData(name="A", skills=["Development"])
        assert find_unfounded_skills("Software developer with development work.", cv) == []

    def test_vietnamese_token_is_lenient(self) -> None:
        cv = CVData(name="A", skills=["Công nghệ"])
        assert find_unfounded_skills("Làm việc với công nghệ mới.", cv) == []

    def test_contact_fields_do_not_cause_false_positive(self) -> None:
        cv = CVData(name="A", email="a@example.com", skills=["Python"])
        assert find_unfounded_skills("Python engineer.", cv) == []


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

    def test_dropped_bullets_are_flagged(self) -> None:
        entered = self._entered().model_copy(
            update={
                "experience": [
                    CvExperienceItem(
                        title="Engineer",
                        company="Acme",
                        date="2020-2023",
                        bullets=[
                            "Built APIs.",
                            "Shipped service.",
                            "Fixed bugs.",
                            "Wrote tests.",
                            "Onboarded juniors.",
                        ],
                    )
                ]
            }
        )
        output = entered.model_copy(
            update={
                "experience": [
                    CvExperienceItem(
                        title="Engineer",
                        company="Acme",
                        date="2020-2023",
                        bullets=["Built APIs.", "Shipped service.", "Fixed bugs."],
                    )
                ]
            }
        )
        assert "experience bullets" in find_missing_sections(entered, output)

    def test_derived_sections_are_never_checked(self) -> None:
        entered = self._entered()
        output = entered.model_copy(update={"core_competencies": [], "skill_groups": []})
        assert find_missing_sections(entered, output) == []

    def test_merged_experience_entries_are_flagged(self) -> None:
        """4 experience entries merged into 1 must produce merged_experience."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Collaborator", company="Lab A", bullets=["Work."]),
                CvExperienceItem(title="Assistant", company="Lab B", bullets=["Helped."]),
                CvExperienceItem(title="Researcher", company="Lab C", bullets=["Studied."]),
                CvExperienceItem(title="Intern", company="Lab D", bullets=["Learned."]),
            ],
        )
        output = CVData(
            name="A",
            experience=[
                CvExperienceItem(
                    title="Research Contributor",
                    company="Academic Collaborations",
                    bullets=["Work.", "Helped.", "Studied.", "Learned."],
                ),
            ],
        )
        issues = find_missing_sections(entered, output)
        assert "merged_experience" in issues
        # The generic "experience" label should NOT appear — merged_* is the specific one
        assert "experience" not in issues

    def test_merged_projects_are_flagged(self) -> None:
        """2 projects merged into 1 must produce merged_projects."""
        entered = CVData(
            name="A",
            projects=[
                {"name": "Project A", "description": "Desc A"},
                {"name": "Project B", "description": "Desc B"},
            ],
        )
        output = CVData(
            name="A",
            projects=[{"name": "Projects A & B", "description": "Desc A and B"}],
        )
        issues = find_missing_sections(entered, output)
        assert "merged_projects" in issues

    def test_no_merge_when_counts_match(self) -> None:
        """Same count but reordered should not flag merged_*."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="A", company="X"),
                CvExperienceItem(title="B", company="Y"),
            ],
        )
        output = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="B", company="Y"),
                CvExperienceItem(title="A", company="X"),
            ],
        )
        issues = find_missing_sections(entered, output)
        assert not any(m.startswith("merged_") for m in issues)


class TestFindTitleInflation:
    def test_inflated_title_is_flagged(self) -> None:
        """Input 'Member' -> output 'Researcher' must be flagged."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Member", company="OpenSource Org", date="2023"),
            ],
        )
        polished = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Researcher", company="OpenSource Org", date="2023"),
            ],
        )
        issues = find_title_inflation(entered, polished)
        assert len(issues) == 1
        assert "Member" in issues[0]
        assert "Researcher" in issues[0]

    def test_case_only_change_is_not_flagged(self) -> None:
        """Input 'member' -> output 'Member' (case only) must NOT be flagged."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="member", company="Acme Corp", date="2022-2024"),
            ],
        )
        polished = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Member", company="Acme Corp", date="2022-2024"),
            ],
        )
        assert find_title_inflation(entered, polished) == []

    def test_matching_by_company_not_index(self) -> None:
        """Entries reordered by LLM still compare correct titles."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Intern", company="Alpha", date="2021"),
                CvExperienceItem(title="Volunteer", company="Beta", date="2022"),
            ],
        )
        # LLM swaps order — titles stay the same, only order changes
        polished = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Volunteer", company="Beta", date="2022"),
                CvExperienceItem(title="Intern", company="Alpha", date="2021"),
            ],
        )
        issues = find_title_inflation(entered, polished)
        assert issues == []

    def test_reorder_with_inflation_detected(self) -> None:
        """Entries reordered AND inflated — only the inflated one is flagged."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Intern", company="Alpha", date="2021"),
                CvExperienceItem(title="Volunteer", company="Beta", date="2022"),
            ],
        )
        # LLM swaps order and inflates Beta's title only
        polished = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Intern", company="Alpha", date="2021"),
                CvExperienceItem(title="Lead", company="Beta", date="2022"),
            ],
        )
        issues = find_title_inflation(entered, polished)
        assert len(issues) == 1
        assert "Lead" in issues[0]
        assert "Beta" in issues[0]

    def test_same_title_different_company_not_flagged(self) -> None:
        """Same title at two different companies is fine."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Engineer", company="X", date="2020"),
                CvExperienceItem(title="Engineer", company="Y", date="2021"),
            ],
        )
        polished = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Engineer", company="Y", date="2021"),
                CvExperienceItem(title="Engineer", company="X", date="2020"),
            ],
        )
        assert find_title_inflation(entered, polished) == []

    def test_empty_entered_title_fabrication_is_flagged(self) -> None:
        """Empty original title + fabricated role title IS flagged (fabrication)."""
        entered = CVData(
            name="A",
            experience=[CvExperienceItem(title="", company="Acme", date="2020")],
        )
        polished = CVData(
            name="A",
            experience=[CvExperienceItem(title="Manager", company="Acme", date="2020")],
        )
        issues = find_title_inflation(entered, polished)
        assert len(issues) == 1
        assert "fabricated" in issues[0].lower()

    def test_empty_entered_title_non_role_not_flagged(self) -> None:
        """Empty original title + non-role text (project name) is NOT flagged."""
        entered = CVData(
            name="A",
            experience=[CvExperienceItem(title="", company="Acme", date="2020")],
        )
        polished = CVData(
            name="A",
            experience=[CvExperienceItem(title="ESP32 Project", company="Acme", date="2020")],
        )
        assert find_title_inflation(entered, polished) == []


class TestMessageFormats:
    def test_title_message_includes_original_and_polished(self) -> None:
        """_title_message must tell LLM the exact original title to restore."""
        issues = ['"Member" -> "Researcher" (company: OpenSource Org)']
        msg = _title_message(issues)
        assert "MUST use the exact original title" in msg
        assert "Member" in msg
        assert "Researcher" in msg
        assert "OpenSource Org" in msg

    def test_entry_count_message_includes_exact_counts(self) -> None:
        """_entry_count_message must state exact entered vs output counts."""
        msg = _entry_count_message("experience", 4, 1)
        assert "4" in msg
        assert "1" in msg
        assert "experience" in msg
        assert "MUST NOT merge" in msg

    def test_member_to_researcher_detected_and_message_correct(self) -> None:
        """Full pipeline: 'Member' -> 'Researcher' produces actionable message."""
        entered = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Member", company="OpenSource Org", date="2023"),
            ],
        )
        polished = CVData(
            name="A",
            experience=[
                CvExperienceItem(title="Researcher", company="OpenSource Org", date="2023"),
            ],
        )
        issues = find_title_inflation(entered, polished)
        assert len(issues) == 1
        msg = _title_message(issues)
        # Message must contain the original title the LLM should restore
        assert "Member" in msg
        # Message must contain what the LLM incorrectly wrote
        assert "Researcher" in msg
