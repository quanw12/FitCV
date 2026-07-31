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
    assert (
        '<a class="contact-link" href="https://linkedin.com/in/a">LinkedIn — https://linkedin.com/in/a</a>'
        in html
    )
    assert (
        '<a class="contact-link" href="https://github.com/a">GitHub — https://github.com/a</a>'
        in html
    )
    assert "<h2>Languages</h2>" in html
    assert "English" in html
    assert "Fluent" in html
    assert "<h2>Publications</h2>" in html
    assert "Paper" in html
    assert "Journal" in html
    assert "<h2>Awards</h2>" in html
    assert "Dean&#39;s List" in html


def test_project_links_and_description_urls_are_clickable() -> None:
    cv = CVData(
        name="Nguyen Van A",
        projects=[
            {
                "name": "FitCV",
                "description": "AI CV screening tool. Repo: https://github.com/a/fitcv.",
                "links": [
                    {"label": "GitHub", "url": "https://github.com/a/fitcv"},
                    {"label": "Demo", "url": "https://fitcv.demo.app"},
                ],
            }
        ],
    )
    html = render_cv(cv)
    assert (
        '<a class="project-link" href="https://github.com/a/fitcv">GitHub — https://github.com/a/fitcv</a>'
        in html
    )
    assert (
        '<a class="project-link" href="https://fitcv.demo.app">Demo — https://fitcv.demo.app</a>'
        in html
    )
    assert (
        '<a class="project-link" href="https://github.com/a/fitcv">https://github.com/a/fitcv</a>'
        in html
    )


def test_linkify_escapes_text_and_urls() -> None:
    cv = CVData(
        name="Nguyen Van A",
        projects=[
            {
                "name": "X",
                "description": "A <b>bold</b> & raw: https://example.com/a?x=1&y=2",
            }
        ],
    )
    html = render_cv(cv)
    assert "<b>bold</b>" not in html
    assert "&lt;b&gt;bold&lt;/b&gt;" in html
    assert "&amp; raw:" in html
    assert 'href="https://example.com/a?x=1&amp;y=2"' in html


def test_unknown_language_falls_back_to_english() -> None:
    html = render_cv(CVData(name="A", summary="Hello."), language="fr")
    assert "<h2>Profile</h2>" in html


def test_unknown_style_raises_value_error() -> None:
    try:
        render_cv(CVData(name="A"), style="fancy")
    except ValueError as exc:
        assert "Unknown template style" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_classic_template_uses_harvard_layout() -> None:
    cv = CVData(
        name="Nguyen Van A",
        email="a@example.com",
        phone="+84 912 345 678",
        links=[{"label": "GitHub", "url": "https://github.com/a"}],
        summary="Backend engineer.",
        education=[{"degree": "BSc", "institution": "HCMUS", "date": "2016-2020"}],
        experience=[
            {
                "title": "Engineer",
                "company": "Acme",
                "location": "HCMC",
                "date": "2020-2023",
                "bullets": ["Built APIs."],
            }
        ],
        skills=["Python"],
        projects=[
            {
                "name": "FitCV",
                "description": "Repo: https://github.com/a/fitcv",
                "links": [{"label": "GitHub", "url": "https://github.com/a/fitcv"}],
            }
        ],
    )
    html = render_cv(cv, style="classic")
    assert "Times New Roman" in html
    assert "<svg" not in html
    assert html.index("<h2>Education</h2>") < html.index("<h2>Professional Experience</h2>")
    assert html.index("<h2>Professional Experience</h2>") < html.index("<h2>Core Competencies</h2>")
    assert '<a href="mailto:a@example.com">a@example.com</a>' in html
    assert 'class="entry-right">HCMC · 2020-2023' in html
    assert '<a href="https://github.com/a/fitcv">GitHub — https://github.com/a/fitcv</a>' in html


def test_classic_template_uses_vietnamese_headings() -> None:
    cv = CVData(name="A", education=[{"degree": "Cử nhân"}], skills=["Python"])
    html = render_cv(cv, language="vi", style="classic")
    assert "<h2>Học vấn</h2>" in html
    assert "<h2>Kỹ năng chuyên môn</h2>" in html
