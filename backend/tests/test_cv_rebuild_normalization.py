from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.normalization import normalize_cv


class TestLanguageRatings:
    def test_star_rating_maps_to_english_level(self) -> None:
        cv = CVData(
            name="A",
            summary="Backend engineer.",
            languages=[{"name": "English", "proficiency": "★★★★☆"}],
        )
        out = normalize_cv(cv)
        assert out.languages[0].proficiency == "Fluent"

    def test_star_rating_maps_to_vietnamese_level(self) -> None:
        cv = CVData(
            name="A",
            summary="Kỹ sư phần mềm.",
            languages=[{"name": "Tiếng Anh", "proficiency": "★★★★★"}],
        )
        out = normalize_cv(cv)
        assert out.languages[0].proficiency == "Thành thạo"

    def test_dot_rating_maps_to_level(self) -> None:
        cv = CVData(
            name="A",
            summary="Engineer.",
            languages=[{"name": "Japanese", "proficiency": "●●●○○"}],
        )
        out = normalize_cv(cv)
        assert out.languages[0].proficiency == "Intermediate"

    def test_rating_drops_parenthetical_detail(self) -> None:
        cv = CVData(
            name="A",
            summary="Engineer.",
            languages=[{"name": "English", "proficiency": "★★★★☆ (IELTS 7.5)"}],
        )
        out = normalize_cv(cv)
        assert out.languages[0].proficiency == "Fluent"

    def test_plain_proficiency_left_untouched(self) -> None:
        cv = CVData(
            name="A",
            summary="Engineer.",
            languages=[{"name": "English", "proficiency": "Fluent"}],
        )
        out = normalize_cv(cv)
        assert out.languages[0].proficiency == "Fluent"

    def test_language_name_symbols_removed(self) -> None:
        cv = CVData(
            name="A",
            summary="Engineer.",
            languages=[{"name": "English ★", "proficiency": "Fluent"}],
        )
        out = normalize_cv(cv)
        assert out.languages[0].name == "English"


class TestSymbolStripping:
    def test_skill_ratings_removed(self) -> None:
        cv = CVData(name="A", skills=["Python ★★★★", "Docker ●●●●●", "Git"])
        out = normalize_cv(cv)
        assert out.skills == ["Python", "Docker", "Git"]

    def test_symbols_removed_from_all_text_fields(self) -> None:
        cv = CVData(
            name="Nguyen ★",
            summary="Great ★ engineer ✔",
            certifications=["OSCP ✓"],
            awards=["Best ★ 2024"],
            experience=[
                {
                    "title": "Intern ★",
                    "company": "Acme",
                    "date": "2023",
                    "bullets": ["Built APIs ★", "  "],
                }
            ],
            projects=[{"name": "Tool ★", "description": "Self-built ✔ tool"}],
            core_competencies=[{"name": "Security ✔", "description": "HomeLab ★ setup"}],
            skill_groups=[{"category": "Tools ★", "items": ["Nmap ▲"]}],
        )
        out = normalize_cv(cv)
        assert out.name == "Nguyen"
        assert out.summary == "Great engineer"
        assert out.certifications == ["OSCP"]
        assert out.awards == ["Best 2024"]
        assert out.experience[0].title == "Intern"
        assert out.experience[0].bullets == ["Built APIs"]
        assert out.projects[0].name == "Tool"
        assert out.projects[0].description == "Self-built tool"
        assert out.core_competencies[0].name == "Security"
        assert out.core_competencies[0].description == "HomeLab setup"
        assert out.skill_groups[0].category == "Tools"
        assert out.skill_groups[0].items == ["Nmap"]

    def test_symbol_only_entries_are_dropped(self) -> None:
        cv = CVData(name="A", skills=["★", "Python", "●●●●●"], certifications=["✓"])
        out = normalize_cv(cv)
        assert out.skills == ["Python"]
        assert out.certifications == []

    def test_empty_cv_unchanged(self) -> None:
        out = normalize_cv(CVData())
        assert out.languages == []
        assert out.skills == []
