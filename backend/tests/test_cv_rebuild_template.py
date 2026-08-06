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
    "Technical Skills",
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
        "Technical Skills",
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


def _extract_block(html: str, selector: str) -> str:
    import re

    match = re.search(
        rf"{re.escape(selector)}\s*\{{([^}}]*)\}}", html
    )
    return match.group(1) if match else ""


def test_section_has_no_page_break_avoid() -> None:
    html = render_cv(CVData(name="A"))
    block = _extract_block(html, "section.cv-section")
    assert "page-break-inside: avoid" not in block


def test_entry_keeps_page_break_avoid() -> None:
    html = render_cv(CVData(name="A"))
    block = _extract_block(html, ".entry")
    assert "page-break-inside: avoid" in block


def test_entry_right_allows_wrap() -> None:
    html = render_cv(CVData(name="A"))
    block = _extract_block(html, ".entry-right")
    assert "white-space: nowrap" not in block
    assert "max-width" in block


def test_uses_language_attribute() -> None:
    html = render_cv(CVData(name="A"), language="vi")
    assert '<html lang="vi">' in html
    html = render_cv(CVData(name="A"), language="fr")
    assert '<html lang="fr">' in html


def test_template_uses_plain_harvard_font() -> None:
    html = render_cv(CVData(name="A"))
    assert "Times New Roman" in html
    assert "--accent:" not in html


def test_vietnamese_cv_uses_vietnamese_headings() -> None:
    cv = CVData(
        name="Nguyen Van A",
        summary="Kỹ sư phần mềm.",
        skills=["Python", "React"],
        core_competencies=[{"name": "Phát triển Backend", "description": "3 năm kinh nghiệm."}],
        languages=[{"name": "Tiếng Anh", "proficiency": "Thành thạo"}],
        publications=[{"title": "Bài báo", "venue": "Tạp chí", "date": "2023"}],
        awards=["Sinh viên giỏi"],
    )
    html = render_cv(cv, language="vi")
    assert "<h2>Giới thiệu</h2>" in html
    assert "<h2>Năng lực cốt lõi</h2>" in html
    assert "<h2>Kỹ năng kỹ thuật</h2>" in html
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
    assert '<a href="https://linkedin.com/in/a">LinkedIn — https://linkedin.com/in/a</a>' in html
    assert '<a href="https://github.com/a">GitHub — https://github.com/a</a>' in html
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
    assert '<a href="https://github.com/a/fitcv">GitHub — https://github.com/a/fitcv</a>' in html
    assert '<a href="https://fitcv.demo.app">Demo — https://fitcv.demo.app</a>' in html
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


def test_template_uses_harvard_layout() -> None:
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
            },
            {
                "title": "Senior Engineer",
                "company": "TechCorp",
                "location": "HCMC",
                "date": "2023-present",
                "bullets": ["Led team of 5."],
            },
        ],
        skills=["Python"],
        core_competencies=[{"name": "Backend", "description": "4 years of APIs."}],
        projects=[
            {
                "name": "FitCV",
                "description": "Repo: https://github.com/a/fitcv",
                "links": [{"label": "GitHub", "url": "https://github.com/a/fitcv"}],
            }
        ],
    )
    html = render_cv(cv)
    assert "Times New Roman" in html
    assert "<svg" not in html
    assert html.index("<h2>Profile</h2>") < html.index("<h2>Core Competencies</h2>")
    assert html.index("<h2>Core Competencies</h2>") < html.index("<h2>Education</h2>")
    assert html.index("<h2>Education</h2>") < html.index("<h2>Professional Experience</h2>")
    assert html.index("<h2>Professional Experience</h2>") < html.index("<h2>Technical Skills</h2>")
    assert '<a href="mailto:a@example.com">a@example.com</a>' in html
    assert 'class="entry-right">HCMC · 2020-2023' in html
    assert '<a href="https://github.com/a/fitcv">GitHub — https://github.com/a/fitcv</a>' in html


def test_core_competencies_render_with_value_descriptions() -> None:
    cv = CVData(
        name="Nguyen Van A",
        core_competencies=[
            {"name": "Backend Development", "description": "4 years building payment APIs."},
            {"name": "SQL", "description": "Designed schemas for 1M+ rows."},
        ],
    )
    html = render_cv(cv)
    assert "<h2>Core Competencies</h2>" in html
    assert '<li><span class="entry-title">Backend Development</span> — 4 years building payment APIs.</li>' in html
    assert '<li><span class="entry-title">SQL</span> — Designed schemas for 1M+ rows.</li>' in html
    assert "<h2>Technical Skills</h2>" not in html


def test_skill_groups_render_categorized_technical_skills() -> None:
    cv = CVData(
        name="Nguyen Van A",
        skill_groups=[
            {"category": "Languages", "items": ["Python", "TypeScript"]},
            {"category": "Frameworks", "items": ["React", "FastAPI"]},
        ],
    )
    html = render_cv(cv)
    assert "<h2>Technical Skills</h2>" in html
    assert "<span class=\"entry-title\">Languages:</span> Python, TypeScript" in html
    assert "<span class=\"entry-title\">Frameworks:</span> React, FastAPI" in html


def test_plain_skills_list_renders_when_no_groups() -> None:
    cv = CVData(name="Nguyen Van A", skills=["Python", "Docker"])
    html = render_cv(cv)
    assert "<h2>Technical Skills</h2>" in html
    assert '<ul class="skills-list">' in html
    assert "<li>Python</li>" in html
    assert "<li>Docker</li>" in html
    assert "<h2>Core Competencies</h2>" not in html


def test_vietnamese_headings() -> None:
    cv = CVData(name="A", education=[{"degree": "Cử nhân"}], skills=["Python"])
    html = render_cv(cv, language="vi")
    assert "<h2>Học vấn</h2>" in html
    assert "<h2>Kỹ năng kỹ thuật</h2>" in html


def test_avatar_data_url_is_embedded_in_header() -> None:
    html = render_cv(
        CVData(name="Nguyen Van A"),
        avatar="data:image/png;base64,QUFB",
    )
    assert (
        '<img class="cv-avatar" src="data:image/png;base64,QUFB" alt="Profile photo" />'
        in html
    )


def test_non_data_url_avatar_is_ignored() -> None:
    html = render_cv(CVData(name="Nguyen Van A"), avatar="https://example.com/x.jpg")
    assert 'class="cv-avatar"' not in html


def test_experience_light_profile_orders_projects_before_experience() -> None:
    """Projects + 0-1 experience entries → Education before Experience."""
    cv = CVData(
        name="Student A",
        summary="CS student.",
        education=[{"degree": "BSc", "institution": "HCMUS", "date": "2022-2026"}],
        projects=[{"name": "FitCV", "description": "AI CV tool."}],
        experience=[{"title": "Intern", "company": "Acme", "date": "Summer 2025"}],
        skills=["Python"],
    )
    html = render_cv(cv)
    assert html.index("<h2>Education</h2>") < html.index("<h2>Selected Projects</h2>")
    assert html.index("<h2>Selected Projects</h2>") < html.index("<h2>Professional Experience</h2>")


def test_standard_profile_orders_experience_before_projects() -> None:
    """2+ experience entries → standard order: Experience before Projects."""
    cv = CVData(
        name="Engineer A",
        summary="Backend engineer.",
        experience=[
            {"title": "Engineer", "company": "Acme", "date": "2020-2022"},
            {"title": "Senior", "company": "Biz", "date": "2022-present"},
        ],
        projects=[{"name": "FitCV", "description": "AI CV tool."}],
        skills=["Python"],
    )
    html = render_cv(cv)
    assert html.index("<h2>Professional Experience</h2>") < html.index("<h2>Selected Projects</h2>")
