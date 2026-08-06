"""Render a CVData model into the fixed HTML template."""

import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup, escape

from app.schemas.cv_rebuild import CVData

_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"

_URL_PATTERN = re.compile(r"(https?://[^\s<>\"']+)")
_URL_TRAILING_PUNCTUATION = re.compile(r"[.,;:!?)\"']+$")

_environment = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(("html", "xml")),
)


def _linkify(value: str) -> Markup:
    """Escape text and turn bare http(s) URLs into clickable anchors."""

    def replace(match: re.Match) -> str:
        url = match.group(1)
        cleaned = _URL_TRAILING_PUNCTUATION.sub("", url)
        trailing = url[len(cleaned) :]
        if not cleaned:
            return url
        return f'<a class="project-link" href="{cleaned}">{cleaned}</a>{trailing}'

    text = escape(value)
    return Markup(_URL_PATTERN.sub(replace, str(text)))


_environment.filters["linkify"] = _linkify

_SECTION_HEADINGS = {
    "en": {
        "profile": "Profile",
        "core_competencies": "Core Competencies",
        "experience": "Professional Experience",
        "projects": "Selected Projects",
        "education": "Education",
        "languages": "Languages",
        "certifications": "Certifications",
        "publications": "Publications",
        "awards": "Awards",
        "technical_skills": "Technical Skills",
    },
    "vi": {
        "profile": "Giới thiệu",
        "core_competencies": "Năng lực cốt lõi",
        "experience": "Kinh nghiệm làm việc",
        "projects": "Dự án tiêu biểu",
        "education": "Học vấn",
        "languages": "Ngoại ngữ",
        "certifications": "Chứng chỉ",
        "publications": "Công bố",
        "awards": "Giải thưởng",
        "technical_skills": "Kỹ năng kỹ thuật",
    },
}

_STANDARD_ORDER = [
    "profile", "core_competencies", "education", "experience", "projects",
    "languages", "certifications", "publications", "awards", "technical_skills",
]

_EXPERIENCE_LIGHT_ORDER = [
    "profile", "education", "projects", "core_competencies", "experience",
    "languages", "certifications", "publications", "awards", "technical_skills",
]


def _section_order(cv: CVData) -> list[str]:
    """Return the section render order based on profile characteristics.

    Experience-light profiles (few/no work experiences but has projects)
    place Projects and Education above Experience so the candidate's
    strongest content appears first.
    """
    has_projects = bool(cv.projects)
    is_experience_light = has_projects and len(cv.experience) <= 1
    return _EXPERIENCE_LIGHT_ORDER if is_experience_light else _STANDARD_ORDER


def render_cv(
    cv: CVData, *, language: str = "en", avatar: str | None = None
) -> str:
    template = _environment.get_template("cv_template.html")
    headings = _SECTION_HEADINGS.get(language, _SECTION_HEADINGS["en"])
    safe_avatar = avatar if avatar and avatar.startswith("data:image/") else None
    return template.render(
        data=cv,
        headings=headings,
        avatar=safe_avatar,
        language=language,
        section_order=_section_order(cv),
    )
