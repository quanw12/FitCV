"""Render a CVData model into the fixed HTML template."""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.schemas.cv_rebuild import CVData

_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"

_environment = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(("html", "xml")),
)


def render_cv(cv: CVData) -> str:
    template = _environment.get_template("cv_template.html")
    return template.render(data=cv)
