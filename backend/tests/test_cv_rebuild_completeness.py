"""Tests for the deterministic CV rebuild completeness backfill.

These pin Bug 1's guarantee that the rebuilt CV never silently drops
content present in the original input, and that the new baseline-aware
polish comparison + best-attempt selection behave correctly.
"""

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.completeness import (
    backfill_cv,
    derive_baseline_from_text,
    detect_sections_in_text,
)
from app.services.cv_rebuild.grounding import find_title_inflation
from app.services.cv_rebuild.llm_extractor import CvExtractor


def _fake_client(responses: list[dict]):
    class _Fake:
        def __init__(self, responses: list[dict]) -> None:
            self.responses = list(responses)
            self.prompts: list[str] = []

        def generate_structured(self, *, prompt, response_schema, temperature=None, seed=None):
            self.prompts.append(prompt)
            if not self.responses:
                raise AssertionError("no response")
            return self.responses.pop(0)

    return _Fake(responses)


def test_backfill_restores_dropped_contact_and_skills() -> None:
    original = CVData(
        name="Nguyen Van A",
        email="a@example.com",
        phone="+84 123 456 789",
        summary="Backend engineer.",
        skills=["Python", "FastAPI", "SQL"],
        links=[{"label": "GitHub", "url": "https://github.com/nga"}],
        experience=[
            {
                "title": "Engineer",
                "company": "Acme",
                "date": "2020-2023",
                "bullets": ["Built APIs."],
            }
        ],
    )
    # Polished output dropped the phone, one skill, and the link.
    built = CVData(
        name="Nguyen Van A",
        email="a@example.com",
        summary="Backend engineer.",
        skills=["Python", "FastAPI"],
        experience=[
            {
                "title": "Engineer",
                "company": "Acme",
                "date": "2020-2023",
                "bullets": ["Built APIs."],
            }
        ],
    )
    merged, warnings = backfill_cv(original, built)
    assert merged.phone == "+84 123 456 789"
    assert "SQL" in merged.skills
    assert any(link.url == "https://github.com/nga" for link in merged.links)
    assert warnings  # something was restored and reported


def test_backfill_is_additive_only() -> None:
    """Backfill never overwrites polished wording with raw input."""
    original = CVData(name="A", summary="OLD summary wording.")
    built = CVData(name="A", summary="Polished, improved summary wording.")
    merged, warnings = backfill_cv(original, built)
    # Summary already present in built -> keep the polished version.
    assert merged.summary == "Polished, improved summary wording."
    assert warnings == []


def test_backfill_restores_missing_experience_entry() -> None:
    original = CVData(
        name="A",
        experience=[
            {"title": "E1", "company": "Acme", "date": "2020", "bullets": ["x"]},
            {"title": "E2", "company": "Globex", "date": "2021", "bullets": ["y"]},
        ],
    )
    built = CVData(
        name="A",
        experience=[
            {"title": "E1", "company": "Acme", "date": "2020", "bullets": ["x"]},
        ],
    )
    merged, warnings = backfill_cv(original, built)
    assert len(merged.experience) == 2
    assert any(e.company == "Globex" for e in merged.experience)
    assert any("experience" in w for w in warnings)


def test_backfill_restores_skill_outside_group() -> None:
    """A skill present only outside groups is re-injected when missing."""
    original = CVData(name="A", skills=["Python", "Docker"])
    built = CVData(
        name="A",
        skill_groups=[{"category": "Languages", "items": ["Python"]}],
    )
    merged, warnings = backfill_cv(original, built)
    assert "Docker" in merged.skills
    assert any("Docker" in w for w in warnings)


def test_detect_sections_in_text_finds_headers() -> None:
    raw = (
        "John Doe\n"
        "Work Experience\n"
        "Engineer at Acme (2020-2023)\n"
        "Education\n"
        "BSc at HCMUS\n"
        "Personal Projects\n"
        "FitCV\n"
    )
    sections = detect_sections_in_text(raw)
    assert "experience" in sections
    assert "education" in sections
    assert "projects" in sections


def test_detect_sections_in_text_ignores_embedded_words() -> None:
    # "experiences" / "educational" should not false-positive as headers.
    raw = "I have many experiences and some educational background."
    sections = detect_sections_in_text(raw)
    assert "experience" not in sections
    assert "education" not in sections


def test_derive_baseline_from_text_finds_contact() -> None:
    raw = (
        "Nguyen Van A\na@example.com\n"
        "https://linkedin.com/in/nga\n"
        "https://github.com/nga\n"
    )
    baseline = derive_baseline_from_text(raw)
    assert baseline.email == "a@example.com"
    assert any(link.url == "https://linkedin.com/in/nga" for link in baseline.links)
    assert any(link.url == "https://github.com/nga" for link in baseline.links)


def test_polish_baseline_prevents_drift_on_repeat() -> None:
    """With baseline=original, a clean first attempt is accepted and the
    returned titles stay faithful to the original (index-based fix)."""
    original = CVData(
        name="A",
        experience=[
            {
                "title": "Member",
                "company": "OpenSource Org",
                "date": "2022",
                "bullets": ["Contributed."],
            },
            {
                "title": "Assistant",
                "company": "University Lab",
                "date": "2021",
                "bullets": ["Assisted."],
            },
        ],
    )
    clean = {
        "name": "A",
        "experience": [
            {"title": "Member", "company": "OpenSource Org", "date": "2022",
             "bullets": ["Contributed."]},
            {"title": "Assistant", "company": "University Lab", "date": "2021",
             "bullets": ["Assisted."]},
        ],
    }
    client = _fake_client([clean])
    cv, warnings = CvExtractor(client=client).polish(
        original, language="en", baseline=original
    )
    assert cv.experience[0].title == "Member"
    assert cv.experience[1].title == "Assistant"
    assert warnings == []


def test_title_inflation_targeted_fix_for_duplicate_company() -> None:
    """Only the inflated entry is restored; a same-company sibling is intact."""
    entered = CVData(
        name="A",
        experience=[
            {"title": "Engineer", "company": "Acme", "date": "2020",
             "bullets": ["x"]},
            {"title": "Intern", "company": "Acme", "date": "2021",
             "bullets": ["y"]},
        ],
    )
    polished = CVData(
        name="A",
        experience=[
            # First Acme entry inflated; second kept as Intern.
            {"title": "Senior Engineer", "company": "Acme", "date": "2020",
             "bullets": ["x"]},
            {"title": "Intern", "company": "Acme", "date": "2021",
             "bullets": ["y"]},
        ],
    )
    issues = find_title_inflation(entered, polished)
    # Only one entry flagged (the inflation).
    assert len(issues) == 1
    # The LLM keeps inflating; the hard-override restores the original titles.
    client = _fake_client(
        [polished.model_dump(), polished.model_dump(), polished.model_dump()]
    )
    cv, _ = CvExtractor(client=client).polish(
        entered, language="en", baseline=entered
    )
    # First restored to Engineer, second untouched.
    assert cv.experience[0].title == "Engineer"
    assert cv.experience[1].title == "Intern"
