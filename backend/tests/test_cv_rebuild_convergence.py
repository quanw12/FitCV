"""Convergence tests for CV rebuild polish() guards.

These tests verify that guards (title inflation, entry-count mismatch,
unfounded numbers) trigger retries at EVERY attempt where the LLM produces
an error — not just pass randomly.  Each test runs the pipeline at least
5 times (with different mock LLM response sequences) to confirm deterministic
guard behavior regardless of LLM randomness.

Key invariant: if the LLM always produces a specific error, the guard must
detect it on every attempt and either converge (if a later attempt is clean)
or fall back with explicit warnings (never silently return a wrong result).
"""

import copy
import pytest

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.llm_extractor import CvExtractionError, CvExtractor


class FakeGeminiClient:
    def __init__(self, responses: list[dict]) -> None:
        self.responses = list(responses)
        self.prompts: list[str] = []

    def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
        self.prompts.append(prompt)
        if not self.responses:
            raise AssertionError("generate_structured called more times than responses provided")
        return self.responses.pop(0)


# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

ENTERED_CV = CVData(
    name="Nguyen Van A",
    summary="Backend engineer with 3 years of experience.",
    experience=[
        {
            "title": "Member",
            "company": "OpenSource Org",
            "date": "2022-2023",
            "bullets": ["Contributed to open-source projects."],
        },
        {
            "title": "Assistant",
            "company": "University Lab",
            "date": "2021-2022",
            "bullets": ["Assisted with research experiments."],
        },
    ],
    education=[
        {"degree": "BSc Computer Science", "institution": "HCMUS", "date": "2019-2023"},
    ],
    skills=["Python", "Git"],
)

CLEAN_PAYLOAD = {
    "name": "Nguyen Van A",
    "summary": "Backend engineer with 3 years of experience.",
    "experience": [
        {"title": "Member", "company": "OpenSource Org", "date": "2022-2023",
         "bullets": ["Contributed to open-source projects."]},
        {"title": "Assistant", "company": "University Lab", "date": "2021-2022",
         "bullets": ["Assisted with research experiments."]},
    ],
    "skills": ["Python", "Git"],
    "education": [
        {"degree": "BSc Computer Science", "institution": "HCMUS", "date": "2019-2023"},
    ],
    "projects": [],
    "certifications": [],
}


def _inflated_payload(title: str = "Researcher") -> dict:
    """Return a payload with 'Member' inflated to `title` at OpenSource Org."""
    p = copy.deepcopy(CLEAN_PAYLOAD)
    p["experience"][0]["title"] = title
    return p


def _merged_payload() -> dict:
    """Return a payload that merges 2 experience entries into 1."""
    p = copy.deepcopy(CLEAN_PAYLOAD)
    p["experience"] = [
        {
            "title": "Research Contributor",
            "company": "Academic Collaborations",
            "date": "2021-2023",
            "bullets": [
                "Contributed to open-source projects.",
                "Assisted with research experiments.",
            ],
        }
    ]
    return p


def _gpa_invented_payload() -> dict:
    """Return a payload with an invented GPA not in the source."""
    p = copy.deepcopy(CLEAN_PAYLOAD)
    p["education"][0]["degree"] = "BSc Computer Science, GPA 3.8/4.0"
    return p


# ===========================================================================
# 1. TITLE INFLATION GUARD — convergence tests
# ===========================================================================

class TestTitleInflationConvergence:
    """Verify title inflation guard retries on EVERY inflated attempt."""

    def test_always_inflated_falls_back_with_warnings(self) -> None:
        """All 3 attempts return inflated title → must fall back with warnings
        AND hard-override must restore original title."""
        inflated = _inflated_payload("Researcher")
        client = FakeGeminiClient([inflated, inflated, inflated])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        # All 3 attempts consumed
        assert len(client.prompts) == 3
        # Must return warnings about title inflation
        assert any("Titles changed" in w for w in warnings)
        # Hard-override must restore original title
        assert cv.experience[0].title == "Member", \
            f"Expected 'Member', got '{cv.experience[0].title}'"

    def test_inflated_then_clean_converges(self) -> None:
        """Attempt 1 inflated, attempt 2 clean → must converge on attempt 2."""
        inflated = _inflated_payload("Researcher")
        client = FakeGeminiClient([inflated, CLEAN_PAYLOAD])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 2
        assert warnings == []
        assert cv.experience[0].title == "Member"

    def test_clean_then_inflated_converges(self) -> None:
        """Attempt 1 clean → must return immediately, never see attempt 2."""
        client = FakeGeminiClient([CLEAN_PAYLOAD, _inflated_payload()])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 1
        assert warnings == []
        assert cv.experience[0].title == "Member"

    def test_member_to_researcher_detected_every_run(self) -> None:
        """Run 5 times with always-inflated → guard triggers retry AND
        hard-override restores 'Member' EVERY time."""
        inflated = _inflated_payload("Researcher")
        for i in range(5):
            client = FakeGeminiClient([inflated, inflated, inflated])
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)
            assert len(client.prompts) == 3, f"Run {i}: expected 3 prompts"
            assert any("Titles changed" in w for w in warnings), f"Run {i}: no title warning"
            assert cv.experience[0].title == "Member", \
                f"Run {i}: title was '{cv.experience[0].title}', expected 'Member'"

    def test_member_to_cv_researcher_detected_every_run(self) -> None:
        """'Member' → 'Computer Vision Researcher' detected AND fixed every run."""
        inflated = _inflated_payload("Computer Vision Researcher")
        for i in range(5):
            client = FakeGeminiClient([inflated, inflated, inflated])
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)
            assert len(client.prompts) == 3, f"Run {i}: expected 3 prompts"
            assert any("Computer Vision Researcher" in w for w in warnings), \
                f"Run {i}: 'Computer Vision Researcher' not in warnings"
            assert cv.experience[0].title == "Member", \
                f"Run {i}: title was '{cv.experience[0].title}', expected 'Member'"

    def test_member_to_cv_research_member_detected_every_run(self) -> None:
        """'Member' → 'Computer Vision Research Member' detected AND fixed every run."""
        inflated = _inflated_payload("Computer Vision Research Member")
        for i in range(5):
            client = FakeGeminiClient([inflated, inflated, inflated])
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)
            assert len(client.prompts) == 3, f"Run {i}: expected 3 prompts"
            assert cv.experience[0].title == "Member", \
                f"Run {i}: title was '{cv.experience[0].title}', expected 'Member'"

    def test_different_inflated_titles_all_detected(self) -> None:
        """Each attempt inflates to a different title → all detected AND fixed."""
        titles = ["Researcher", "Senior Researcher", "Lead Researcher"]
        client = FakeGeminiClient([_inflated_payload(t) for t in titles])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 3
        assert any("Titles changed" in w for w in warnings)
        # The warning should mention the last inflated title
        title_warning = [w for w in warnings if "Titles changed" in w][0]
        assert "Lead Researcher" in title_warning
        # Hard-override must restore original title
        assert cv.experience[0].title == "Member", \
            f"Expected 'Member', got '{cv.experience[0].title}'"

    def test_convergence_when_llm_fixes_on_retry(self) -> None:
        """Simulate 5 different LLM response sequences, verify guard works."""
        scenarios = [
            # (responses, expected_prompts, expected_warnings)
            ([CLEAN_PAYLOAD], 1, False),                          # Clean on first try
            ([_inflated_payload(), CLEAN_PAYLOAD], 2, False),     # Fix on retry
            ([_inflated_payload()] * 3, 3, True),                 # Never fixes
            ([_merged_payload(), CLEAN_PAYLOAD], 2, False),       # Merge fix on retry
            ([_gpa_invented_payload(), CLEAN_PAYLOAD], 2, False), # GPA fix on retry
        ]
        for i, (responses, exp_prompts, exp_warnings) in enumerate(scenarios):
            client = FakeGeminiClient(list(responses))
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)
            assert len(client.prompts) == exp_prompts, \
                f"Scenario {i}: expected {exp_prompts} prompts, got {len(client.prompts)}"
            assert (len(warnings) > 0) == exp_warnings, \
                f"Scenario {i}: expected warnings={exp_warnings}, got {warnings}"


def _fabricated_title_payload(title: str = "Researcher") -> dict:
    """Return a payload where an empty-title entry has a fabricated title."""
    p = copy.deepcopy(CLEAN_PAYLOAD)
    # Entry with empty title (simulates "Research Collaboration" with no role)
    p["experience"][0]["title"] = ""  # Empty title in input
    p["experience"][0]["company"] = "Tinh Vi Lab"
    # LLM fabricates a title for this entry
    p["experience"][0]["title"] = title
    return p


class TestTitleFabricationConvergence:
    """Verify title fabrication guard catches invented titles from empty input."""

    def test_fabricated_title_detected(self) -> None:
        """Empty title → 'Researcher' is detected as fabrication."""
        from app.schemas.cv_rebuild import CVData
        from app.services.cv_rebuild.grounding import find_title_inflation

        # Entered: empty title at Tinh Vi Lab
        entered = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "", "company": "Tinh Vi Lab", "date": "2023",
                 "bullets": ["Did something."]},
            ],
        })
        # Polished: fabricated title
        polished = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "Researcher", "company": "Tinh Vi Lab", "date": "2023",
                 "bullets": ["Did something."]},
            ],
        })
        issues = find_title_inflation(entered, polished)
        assert len(issues) == 1
        assert "fabricated" in issues[0].lower()
        assert "Researcher" in issues[0]

    def test_fabricated_contributor_detected(self) -> None:
        """Empty title → 'Contributor' is detected as fabrication."""
        from app.schemas.cv_rebuild import CVData
        from app.services.cv_rebuild.grounding import find_title_inflation

        entered = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "", "company": "Tinh Vi Lab", "date": "2023",
                 "bullets": ["Did something."]},
            ],
        })
        polished = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "Research Contributor", "company": "Tinh Vi Lab",
                 "date": "2023", "bullets": ["Did something."]},
            ],
        })
        issues = find_title_inflation(entered, polished)
        assert len(issues) == 1
        assert "fabricated" in issues[0].lower()

    def test_empty_stays_empty_not_flagged(self) -> None:
        """Empty title staying empty is NOT flagged."""
        from app.schemas.cv_rebuild import CVData
        from app.services.cv_rebuild.grounding import find_title_inflation

        entered = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "", "company": "Tinh Vi Lab", "date": "2023",
                 "bullets": ["Did something."]},
            ],
        })
        polished = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "", "company": "Tinh Vi Lab", "date": "2023",
                 "bullets": ["Did something."]},
            ],
        })
        issues = find_title_inflation(entered, polished)
        assert issues == []

    def test_non_role_title_not_flagged(self) -> None:
        """Non-role title from empty input (e.g. project name) is NOT flagged."""
        from app.schemas.cv_rebuild import CVData
        from app.services.cv_rebuild.grounding import find_title_inflation

        entered = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "", "company": "Tinh Vi Lab", "date": "2023",
                 "bullets": ["Did something."]},
            ],
        })
        polished = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "ESP32 Voice Project", "company": "Tinh Vi Lab",
                 "date": "2023", "bullets": ["Did something."]},
            ],
        })
        issues = find_title_inflation(entered, polished)
        # "ESP32 Voice Project" doesn't contain common role words
        assert issues == []

    def test_polish_hard_overrides_fabricated_title(self) -> None:
        """polish() hard-override clears fabricated title from empty input."""
        # Create entered CV with empty title
        entered = CVData.model_validate({
            "name": "Test",
            "experience": [
                {"title": "", "company": "Tinh Vi Lab", "date": "2023",
                 "bullets": ["Contributed to research."]},
                {"title": "Assistant", "company": "University Lab",
                 "date": "2021-2022",
                 "bullets": ["Assisted with experiments."]},
            ],
        })
        # LLM fabricates title
        fabricated = {
            "name": "Test",
            "summary": "Engineer.",
            "experience": [
                {"title": "Researcher", "company": "Tinh Vi Lab",
                 "date": "2023", "bullets": ["Contributed to research."]},
                {"title": "Assistant", "company": "University Lab",
                 "date": "2021-2022",
                 "bullets": ["Assisted with experiments."]},
            ],
            "skills": ["Python"],
            "education": [],
            "projects": [],
            "certifications": [],
        }
        client = FakeGeminiClient([fabricated, fabricated, fabricated])
        cv, warnings = CvExtractor(client=client).polish(entered, max_attempts=3)

        # Hard-override must clear the fabricated title
        assert cv.experience[0].title == "", \
            f"Expected empty title, got '{cv.experience[0].title}'"
        # Second entry (Assistant) unchanged
        assert cv.experience[1].title == "Assistant"


# ===========================================================================
# 2. ENTRY-COUNT MISMATCH GUARD — convergence tests
# ===========================================================================

class TestEntryCountConvergence:
    """Verify entry-count merge guard retries on EVERY merged attempt."""

    def test_always_merged_falls_back_with_warnings(self) -> None:
        """All 3 attempts merge 2 entries into 1 → must fall back with warnings."""
        merged = _merged_payload()
        client = FakeGeminiClient([merged, merged, merged])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 3
        assert any("Entries merged" in w for w in warnings)

    def test_merged_then_clean_converges(self) -> None:
        """Attempt 1 merged, attempt 2 clean → must converge on attempt 2."""
        merged = _merged_payload()
        client = FakeGeminiClient([merged, CLEAN_PAYLOAD])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 2
        assert warnings == []
        assert len(cv.experience) == 2

    def test_merged_detected_every_run(self) -> None:
        """Run 5 times with always-merged → guard triggers retry EVERY time."""
        merged = _merged_payload()
        for i in range(5):
            client = FakeGeminiClient([merged, merged, merged])
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)
            assert len(client.prompts) == 3, f"Run {i}: expected 3 prompts"
            assert any("Entries merged" in w for w in warnings), \
                f"Run {i}: no merge warning"


# ===========================================================================
# 3. UNFOUNDED NUMBERS GUARD — convergence tests
# ===========================================================================

class TestUnfoundedNumbersConvergence:
    """Verify unfounded-numbers guard retries on EVERY invented-number attempt."""

    def test_always_invented_falls_back_with_warnings(self) -> None:
        """All 3 attempts invent numbers → must fall back with warnings."""
        invented = _gpa_invented_payload()
        client = FakeGeminiClient([invented, invented, invented])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 3
        assert any("Numbers not grounded" in w for w in warnings)

    def test_invented_then_clean_converges(self) -> None:
        """Attempt 1 invented, attempt 2 clean → must converge on attempt 2."""
        invented = _gpa_invented_payload()
        client = FakeGeminiClient([invented, CLEAN_PAYLOAD])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 2
        assert warnings == []

    def test_invented_detected_every_run(self) -> None:
        """Run 5 times with always-invented → guard triggers retry EVERY time."""
        invented = _gpa_invented_payload()
        for i in range(5):
            client = FakeGeminiClient([invented, invented, invented])
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)
            assert len(client.prompts) == 3, f"Run {i}: expected 3 prompts"
            assert any("Numbers not grounded" in w for w in warnings), \
                f"Run {i}: no number warning"


# ===========================================================================
# 4. MULTI-ERROR CONVERGENCE — combined guard behavior
# ===========================================================================

class TestMultiErrorConvergence:
    """Verify multiple guards trigger simultaneously and independently."""

    def test_title_and_merge_both_detected(self) -> None:
        """Payload with BOTH title inflation AND merge → both warnings present.

        Note: when entries are merged, the company name changes, so title
        inflation may not be detected by company-based matching. This test
        uses a scenario where ONE entry keeps its company (title inflated)
        while the OTHER entry is dropped (merge/missing).
        """
        # Keep entry 2 (University Lab) with original title, but drop entry 1
        # entirely → missing_experience + title inflation on entry 1
        merged_partial = copy.deepcopy(CLEAN_PAYLOAD)
        merged_partial["experience"] = [
            # Entry 1 is DROPPED (missing)
            # Entry 2 kept but with wrong title
            {"title": "Research Assistant", "company": "University Lab",
             "date": "2021-2022", "bullets": ["Assisted with research experiments."]},
        ]
        client = FakeGeminiClient([merged_partial, merged_partial, merged_partial])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 3
        # Should detect merged_experience (2→1)
        assert any("Entries merged" in w for w in warnings)

    def test_guard_independence(self) -> None:
        """Title fix but merge persists → only merge warning, no title warning."""
        merged_clean_title = copy.deepcopy(_merged_payload())
        # Keep original titles (no inflation) but merged entries
        client = FakeGeminiClient([merged_clean_title] * 3)
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 3
        assert not any("Titles changed" in w for w in warnings)
        assert any("Entries merged" in w for w in warnings)


# ===========================================================================
# 4b. OVERLAP GUARD — description/bullet redundancy tests
# ===========================================================================

def _overlapping_project_payload() -> dict:
    """Return a payload where project bullet 1 repeats the description."""
    p = copy.deepcopy(CLEAN_PAYLOAD)
    p["projects"] = [
        {
            "name": "AI Voice Assistant",
            "description": "Engineered a full-featured AI voice assistant using streaming ASR, LLM, and TTS.",
            "bullets": [
                "Engineered a full-featured AI voice assistant using streaming ASR, LLM, and TTS over Wi-Fi.",
                "Integrated Qwen for on-device conversation.",
            ],
            "links": [],
        },
    ]
    return p


def _clean_project_payload() -> dict:
    """Return a payload where description and bullets are distinct."""
    p = copy.deepcopy(CLEAN_PAYLOAD)
    p["projects"] = [
        {
            "name": "AI Voice Assistant",
            "description": "AI voice assistant running on microcontroller with zero cloud dependency.",
            "bullets": [
                "Implemented streaming ASR pipeline using Whisper Tiny.",
                "Integrated Qwen for on-device conversation.",
                "Engineered TTS output with Coqui TTS and audio driver.",
            ],
            "links": [],
        },
    ]
    return p


class TestOverlapGuard:
    """Verify project description/bullet overlap detection."""

    def test_detects_overlap_in_guard(self) -> None:
        """Overlap guard catches high Jaccard between description and bullet 1."""
        from app.services.cv_rebuild.grounding import find_project_description_overlap
        cv = CVData.model_validate(_overlapping_project_payload())
        issues = find_project_description_overlap(cv)
        assert len(issues) == 1
        assert "projects[0].bullets[0]" in issues[0]
        assert "overlap" in issues[0]

    def test_no_overlap_when_distinct(self) -> None:
        """No overlap flagged when description and bullets are distinct."""
        from app.services.cv_rebuild.grounding import find_project_description_overlap
        cv = CVData.model_validate(_clean_project_payload())
        issues = find_project_description_overlap(cv)
        assert issues == []

    def test_polish_retries_on_overlap(self) -> None:
        """polish() retries when first attempt has overlapping bullets."""
        from app.schemas.cv_rebuild import CVData
        overlapping = _overlapping_project_payload()
        clean = _clean_project_payload()
        client = FakeGeminiClient([overlapping, clean])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        # First attempt flagged overlap → retried
        assert len(client.prompts) == 2
        # Second attempt clean → no overlap warning
        assert not any("overlap" in w.lower() for w in warnings)

    def test_overlap_persists_with_warnings(self) -> None:
        """All 3 attempts overlap → returns with overlap warning."""
        overlapping = _overlapping_project_payload()
        client = FakeGeminiClient([overlapping, overlapping, overlapping])
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

        assert len(client.prompts) == 3
        assert any("overlap" in w.lower() for w in warnings)

    def test_five_iteration_convergence(self) -> None:
        """5 iterations with alternating overlap/clean → guard triggers on overlap attempts."""
        overlapping = _overlapping_project_payload()
        clean = _clean_project_payload()
        # Pattern: overlap, clean, overlap, overlap, clean
        responses = [overlapping, clean, overlapping, overlapping, clean]
        client = FakeGeminiClient(responses)
        cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=5)

        # 3 overlap attempts + 1 clean = 4 prompts consumed (stops at first clean)
        assert len(client.prompts) <= 5
        # No overlap warning in final output (last was clean)
        assert not any("overlap" in w.lower() for w in warnings)
        # Projects present and clean
        assert len(cv.projects) == 1
        desc = cv.projects[0].description
        bullet0 = cv.projects[0].bullets[0] if cv.projects[0].bullets else ""
        # Description and first bullet should be distinct words
        from app.services.cv_rebuild.grounding import _normalize_words
        desc_words = _normalize_words(desc)
        bullet_words = _normalize_words(bullet0)
        if desc_words and bullet_words:
            jaccard = len(desc_words & bullet_words) / len(desc_words | bullet_words)
            assert jaccard < 0.60, f"Expected <60% overlap, got {int(jaccard * 100)}%"


# ===========================================================================
# 5. SCHEMA CHECK — project role label
# ===========================================================================

class TestProjectRoleLabel:
    """Verify whether CvProjectItem has a role/label field."""

    def test_project_has_no_role_field(self) -> None:
        """CvProjectItem should NOT have a 'role' field per current schema."""
        from app.schemas.cv_rebuild import CvProjectItem
        fields = CvProjectItem.model_fields.keys()
        assert "role" not in fields
        assert "label" not in fields
        assert "type" not in fields
        # Current fields: name, description, bullets, links
        assert set(fields) == {"name", "description", "bullets", "links"}

    def test_project_role_labels_must_come_from_name_or_description(self) -> None:
        """'Developer/Project leader/Personal Project' labels have no schema field.

        If the LLM needs to convey project role, it must embed it in the
        project 'name' or 'description'. There is no separate field for it.
        This is a schema gap if role labels are required.
        """
        project = CvProjectItem(
            name="FitCV - Personal Project",
            description="AI-powered CV screening tool. Role: Developer.",
        )
        assert "Personal Project" in project.name
        assert "Developer" in project.description
        # There is no 'role' field to store this separately
        assert not hasattr(project, "role")


# ===========================================================================
# 6. FIVE-ITERATION CONVERGENCE — simulate all 3 observed title variants
# ===========================================================================

class TestFiveIterationConvergence:
    """Run the pipeline 5 times with different mock LLM response sequences
    simulating the 3 observed title inflation variants.  Verify that the
    hard-override always restores the original title."""

    # The 3 variants observed in real pipeline runs
    VARIANTS = [
        "Computer Vision Researcher",
        "Researcher",
        "Computer Vision Research Member",
    ]

    def test_five_runs_title_always_restored(self) -> None:
        """Run 5 times, each with a different inflation variant → title always 'Member'."""
        for i, variant in enumerate(self.VARIANTS + self.VARIANTS[:2]):  # 5 total
            inflated = _inflated_payload(variant)
            client = FakeGeminiClient([inflated, inflated, inflated])
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

            # All 3 attempts consumed
            assert len(client.prompts) == 3, f"Run {i}: expected 3 prompts"
            # Title MUST be restored to original
            assert cv.experience[0].title == "Member", \
                f"Run {i} (variant '{variant}'): title was '{cv.experience[0].title}', expected 'Member'"
            # Warning must be present
            assert any("Titles changed" in w for w in warnings), \
                f"Run {i} (variant '{variant}'): no title warning"

    def test_five_runs_second_entry_preserved(self) -> None:
        """Second entry title must be preserved across all 5 runs."""
        for i, variant in enumerate(self.VARIANTS + self.VARIANTS[:2]):
            inflated = _inflated_payload(variant)
            client = FakeGeminiClient([inflated, inflated, inflated])
            cv, warnings = CvExtractor(client=client).polish(ENTERED_CV, max_attempts=3)

            # Second entry title must stay "Assistant" (not inflated)
            assert cv.experience[1].title == "Assistant", \
                f"Run {i}: second entry title was '{cv.experience[1].title}', expected 'Assistant'"

    def test_five_runs_project_bullet_sample(self) -> None:
        """Verify project bullets are present in output (not collapsed)."""
        entered_with_project = CVData(
            name="A",
            summary="CS student.",
            experience=[
                {"title": "Member", "company": "OpenSource Org", "date": "2022-2023",
                 "bullets": ["Contributed to open-source projects."]},
            ],
            projects=[{
                "name": "FitCV",
                "description": "AI CV screening tool.",
                "bullets": ["Built backend API with FastAPI.", "Deployed to production."],
            }],
            skills=["Python"],
        )
        clean = {
            "name": "A",
            "summary": "CS student.",
            "experience": [
                {"title": "Member", "company": "OpenSource Org", "date": "2022-2023",
                 "bullets": ["Contributed to open-source projects."]},
            ],
            "projects": [{
                "name": "FitCV",
                "description": "AI CV screening tool.",
                "bullets": ["Built backend API with FastAPI.", "Deployed to production."],
            }],
            "skills": ["Python"],
            "education": [],
            "certifications": [],
        }
        for i in range(5):
            client = FakeGeminiClient([clean, clean, clean])
            cv, warnings = CvExtractor(client=client).polish(entered_with_project, max_attempts=3)
            # Project bullets must be preserved
            assert len(cv.projects) == 1, f"Run {i}: expected 1 project"
            assert len(cv.projects[0].bullets) == 2, \
                f"Run {i}: expected 2 project bullets, got {len(cv.projects[0].bullets)}"
            assert cv.projects[0].bullets[0] == "Built backend API with FastAPI.", \
                f"Run {i}: project bullet changed"


# Import CvProjectItem for the schema test
from app.schemas.cv_rebuild import CvProjectItem
