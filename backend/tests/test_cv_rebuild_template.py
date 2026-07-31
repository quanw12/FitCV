from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.template_renderer import render_cv

ALL_HEADINGS = (
    "Profile",
    "Core Competencies",
    "Professional Experience",
    "Selected Projects",
    "Education",
    "Certifications",
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
            {"title": "Engineer", "company": "Acme", "date": "2020-2023", "bullets": ["Built APIs."]}
        ],
    )
    html = render_cv(cv)
    assert "<h2>Profile</h2>" in html
    assert "<h2>Professional Experience</h2>" in html
    assert "Engineer" in html
    assert "Acme" in html
    assert "Built APIs." in html
    assert "a@example.com" in html
    assert "+84 912 345 678" in html
    for heading in ("Core Competencies", "Selected Projects", "Education", "Certifications"):
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
    )
    html = render_cv(cv, language="vi")
    assert "<h2>Giới thiệu</h2>" in html
    assert "<h2>Kỹ năng chuyên môn</h2>" in html
    assert "<h2>Kinh nghiệm làm việc</h2>" not in html
    for heading in ALL_HEADINGS:
        assert f"<h2>{heading}</h2>" not in html


def test_unknown_language_falls_back_to_english() -> None:
    html = render_cv(CVData(name="A", summary="Hello."), language="fr")
    assert "<h2>Profile</h2>" in html
