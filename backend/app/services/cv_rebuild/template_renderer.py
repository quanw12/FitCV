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

_TEMPLATE_FILES = {
    "modern": "cv_template.html",
    "classic": "cv_template_classic.html",
}

_SECTION_HEADINGS = {
    "en": {
        "profile": "Profile",
        "skills": "Core Competencies",
        "experience": "Professional Experience",
        "projects": "Selected Projects",
        "education": "Education",
        "languages": "Languages",
        "certifications": "Certifications",
        "publications": "Publications",
        "awards": "Awards",
    },
    "vi": {
        "profile": "Giới thiệu",
        "skills": "Kỹ năng chuyên môn",
        "experience": "Kinh nghiệm làm việc",
        "projects": "Dự án tiêu biểu",
        "education": "Học vấn",
        "languages": "Ngoại ngữ",
        "certifications": "Chứng chỉ",
        "publications": "Công bố",
        "awards": "Giải thưởng",
    },
}


def render_cv(cv: CVData, *, language: str = "en", style: str = "modern") -> str:
    template_name = _TEMPLATE_FILES.get(style)
    if template_name is None:
        raise ValueError(f"Unknown template style: {style!r}")
    template = _environment.get_template(template_name)
    headings = _SECTION_HEADINGS.get(language, _SECTION_HEADINGS["en"])
    return template.render(data=cv, headings=headings)
