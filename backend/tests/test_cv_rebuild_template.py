from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.template_renderer import render_cv

ALL_HEADINGS = (
    "Profile",
    "Core Competencies",
    "Professional Experience",
    "Selected Projects",
    "Education",
    "Languages",
    "Certifications",
    "Publications",
    "Awards",
)


def test_empty_cv_omits_all_section_headings() -> None:
    html = render_cv(CVData())
    for heading in ALL_HEADINGS:
        assert f"<h2>{heading}</h2>" not in html
    assert "Nguyen" not in html


def test_partial_cv_renders_only_present_sections() -> None:
    cv = CVData(
        name="Nguyen Van A",
        email="a@example.com",
        phone="+84 912 345 678",
        summary="Backend engineer.",
        experience=[
            {
                "title": "Engineer",
                "company": "Acme",
                "location": "HCMC",
                "date": "2020-2023",
                "bullets": ["Built APIs."],
            }
        ],
    )
    html = render_cv(cv)
    assert "<h2>Profile</h2>" in html
    assert "<h2>Professional Experience</h2>" in html
    assert "Engineer" in html
    assert "Acme" in html
    assert "HCMC" in html
    assert "Built APIs." in html
    assert 'href="mailto:a@example.com"' in html
    assert "a@example.com" in html
    assert "tel:+84912345678" in html
    assert "+84 912 345 678" in html
    for heading in (
        "Core Competencies",
        "Selected Projects",
        "Education",
        "Languages",
        "Certifications",
        "Publications",
        "Awards",
    ):
        assert f"<h2>{heading}</h2>" not in html


def test_content_is_html_escaped() -> None:
    cv = CVData(name="<script>alert(1)</script>", summary="A & B")
    html = render_cv(cv)
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html
    assert "A &amp; B" in html


def test_template_has_page_break_avoid() -> None:
    html = render_cv(CVData(name="A"))
    assert "page-break-inside: avoid" in html


def test_css_uses_custom_properties() -> None:
    html = render_cv(CVData(name="A"))
    assert "--accent:" in html
    assert "--text-primary:" in html


def test_vietnamese_cv_uses_vietnamese_headings() -> None:
    cv = CVData(
        name="Nguyen Van A",
        summary="Kỹ sư phần mềm.",
        skills=["Python", "React"],
        languages=[{"name": "Tiếng Anh", "proficiency": "Thành thạo"}],
        publications=[{"title": "Bài báo", "venue": "Tạp chí", "date": "2023"}],
        awards=["Sinh viên giỏi"],
    )
    html = render_cv(cv, language="vi")
    assert "<h2>Giới thiệu</h2>" in html
    assert "<h2>Kỹ năng chuyên môn</h2>" in html
    assert "<h2>Kinh nghiệm làm việc</h2>" not in html
    assert "<h2>Ngoại ngữ</h2>" in html
    assert "<h2>Công bố</h2>" in html
    assert "<h2>Giải thưởng</h2>" in html
    for heading in ALL_HEADINGS:
        assert f"<h2>{heading}</h2>" not in html


def test_renders_links_languages_publications_and_awards() -> None:
    cv = CVData(
        name="Nguyen Van A",
        links=[
            {"label": "LinkedIn", "url": "https://linkedin.com/in/a"},
            {"label": "GitHub", "url": "https://github.com/a"},
        ],
        languages=[
            {"name": "Vietnamese", "proficiency": "Native"},
            {"name": "English", "proficiency": "Fluent"},
        ],
        publications=[{"title": "Paper", "venue": "Journal", "date": "2022"}],
        awards=["Dean's List", "Best Intern 2021"],
    )
    html = render_cv(cv)
    assert "LinkedIn" in html
    assert "GitHub" in html
    assert 'href="https://linkedin.com/in/a"' in html
    assert 'href="https://github.com/a"' in html
    assert "<h2>Languages</h2>" in html
    assert "English" in html
    assert "Fluent" in html
    assert "<h2>Publications</h2>" in html
    assert "Paper" in html
    assert "Journal" in html
    assert "<h2>Awards</h2>" in html
    assert "Dean&#39;s List" in html


def test_unknown_language_falls_back_to_english() -> None:
    html = render_cv(CVData(name="A", summary="Hello."), language="fr")
    assert "<h2>Profile</h2>" in html
