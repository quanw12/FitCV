# AI Rebuild CV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stateless "AI Rebuild CV" feature: upload PDF/DOCX → Gemini extracts+polishes → Pydantic validates → Jinja2 template → Playwright PDF + thumbnail → one synchronous response, plus a Seeker-portal screen replacing the dashboard.

**Architecture:** FastAPI route `POST /api/cv/rebuild` (JWT-guarded) calls a stateless orchestrator: parse text (existing `document_parser`), single Gemini structured call with a Pydantic retry loop (max 2 retries), render fixed Jinja2 HTML, render PDF + first-page thumbnail with Playwright/Pillow, return base64 in one response. No DB, no long-lived storage (temp files in `TemporaryDirectory`). Frontend: `CVReBuildScreen.tsx` replaces `SeekerDashboard` (nav item "CV Rebuild", screen id `cv-rebuild`), with upload → skeleton → thumbnail card → modal PDF viewer + Download.

**Tech Stack:** FastAPI, Pydantic v2, Jinja2, Playwright (Python), Pillow, Gemini (`gemini_client.py`), existing `document_parser.py`; React 19 + Vite + vitest, `@phosphor-icons/react`.

## Global Constraints

- File rules: PDF/DOCX only, max 10 MB (`MAX_CV_BYTES = 10 * 1024 * 1024`), validated via `document_parser.validate_cv_content`.
- JWT required on the endpoint (`get_current_account`); NO database session may be created anywhere in the pipeline.
- Schema: only `name` non-optional-ish; every other CVData field defaults to `""` / `[]`, never fabricated values.
- LLM: single Gemini call; extraction must not invent facts; polish must not change meaning or add facts; keep source-language content.
- Validation retry: max 2 retries (3 total attempts) with Pydantic error appended; on final failure return a clear error — no silent fallback.
- Template: English headings, content as-is; section (heading included) hidden when its data is empty; `page-break-inside: avoid` on items.
- Response (one sync response): `{ filename, preview_json, pdf_base64, thumbnail_base64 }`.
- Frontend: thumbnail card → click opens modal with `<iframe src="data:application/pdf;base64,...">`; "Download PDF" reuses cached base64 (no second API call); skeleton placeholder while processing.
- No new npm dependencies. New backend deps only: `jinja2`, `playwright`, `pillow`.
- Backend tests run from `backend/` dir with the repo venv (`python -m pytest`); frontend via `npm run test` / `npx vitest run`.

---

### Task 1: Backend dependencies + CVData schemas

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/schemas/cv_rebuild.py`
- Test: `backend/tests/test_cv_rebuild_schema.py`
- Modify: `README.md` (add `playwright install chromium` to backend setup)

**Interfaces:**
- Consumes: nothing new.
- Produces: `app.schemas.cv_rebuild.CVData`, `CvExperienceItem`, `CvProjectItem`, `CvEducationItem`, `CvRebuildResponse`.

- [ ] **Step 1: Add dependencies**

Append to `backend/requirements.txt`:

```
jinja2==3.1.5
playwright==1.51.0
pillow==11.1.0
```

Run from `backend/`:

```bash
.venv\Scripts\python.exe -m pip install jinja2==3.1.5 playwright==1.51.0 pillow==11.1.0
.venv\Scripts\python.exe -m playwright install chromium
```

Expected: pip installs complete; `playwright install chromium` downloads/verifies headless Chromium.

- [ ] **Step 2: Write the failing schema test**

Create `backend/tests/test_cv_rebuild_schema.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas.cv_rebuild import CVData, CvRebuildResponse


class TestCVData:
    def test_empty_document_defaults_are_empty(self) -> None:
        cv = CVData.model_validate({})
        assert cv.name == ""
        assert cv.email == ""
        assert cv.phone == ""
        assert cv.summary == ""
        assert cv.experience == []
        assert cv.skills == []
        assert cv.projects == []
        assert cv.certifications == []
        assert cv.education == []

    def test_rejects_skills_as_string(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate({"skills": "Python"})

    def test_rejects_experience_bullets_as_string(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate(
                {"experience": [{"title": "Engineer", "bullets": "led team"}]}
            )

    def test_rejects_unknown_experience_item_type(self) -> None:
        with pytest.raises(ValidationError):
            CVData.model_validate({"experience": [{"title": 42}]})

    def test_accepts_full_document(self) -> None:
        cv = CVData.model_validate(
            {
                "name": "Nguyen Van A",
                "email": "a@example.com",
                "phone": "+84 912 345 678",
                "summary": "Backend engineer.",
                "experience": [
                    {"title": "Engineer", "company": "Acme", "date": "2020-2023", "bullets": ["Built APIs."]}
                ],
                "skills": ["Python"],
                "projects": [{"name": "FitCV", "description": "CV tool."}],
                "certifications": ["AWS"],
                "education": [{"degree": "BSc", "institution": "HCMUS", "date": "2016-2020"}],
            }
        )
        assert cv.experience[0].bullets == ["Built APIs."]

    def test_response_model_shape(self) -> None:
        response = CvRebuildResponse(
            filename="rebuilt_cv.pdf",
            preview_json=CVData(name="A"),
            pdf_base64="AAA",
            thumbnail_base64="BBB",
        )
        assert response.filename == "rebuilt_cv.pdf"
        assert response.preview_json.name == "A"


class TestCvRebuildResponse:
    def test_defaults(self) -> None:
        response = CvRebuildResponse(preview_json=CVData(), pdf_base64="", thumbnail_base64="")
        assert response.filename == "rebuilt_cv.pdf"
```

- [ ] **Step 3: Run test to verify it fails**

Run from `backend/`:

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_schema.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.cv_rebuild'`.

- [ ] **Step 4: Implement the schema**

Create `backend/app/schemas/cv_rebuild.py`:

```python
"""Pydantic schemas for the stateless AI Rebuild CV pipeline."""

from pydantic import BaseModel, Field


class CvExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    date: str = ""
    bullets: list[str] = Field(default_factory=list)


class CvProjectItem(BaseModel):
    name: str = ""
    description: str = ""


class CvEducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    date: str = ""


class CVData(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    summary: str = ""
    experience: list[CvExperienceItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    projects: list[CvProjectItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    education: list[CvEducationItem] = Field(default_factory=list)


class CvRebuildResponse(BaseModel):
    filename: str = "rebuilt_cv.pdf"
    preview_json: CVData
    pdf_base64: str
    thumbnail_base64: str
```

- [ ] **Step 5: Run test to verify it passes**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_schema.py -v
```

Expected: PASS (7 tests).

- [ ] **Step 6: Document the browser install in README**

In `README.md`, find the backend setup section and add after the pip install command:

```text
4. Install the headless Chromium used by AI Rebuild CV:
   cd backend
   .venv\Scripts\python.exe -m playwright install chromium
```

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/app/schemas/cv_rebuild.py backend/tests/test_cv_rebuild_schema.py README.md
git commit -m "feat(cv-rebuild): add schemas and backend deps"
```

---

### Task 2: LLM extractor with retry loop

**Files:**
- Create: `backend/app/services/cv_rebuild/__init__.py`
- Create: `backend/app/services/cv_rebuild/prompts.py`
- Create: `backend/app/services/cv_rebuild/llm_extractor.py`
- Test: `backend/tests/test_cv_rebuild_extractor.py`

**Interfaces:**
- Consumes: `app.schemas.cv_rebuild.CVData` (Task 1); `app.services.gemini_client.GeminiClient`, `GeminiClientError`.
- Produces: `CvExtractionError(RuntimeError)` and class `CvExtractor` with `extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_cv_rebuild_extractor.py`:

```python
import pytest

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.llm_extractor import CvExtractionError, CvExtractor
from app.services.gemini_client import GeminiClientError


class FakeGeminiClient:
    def __init__(self, responses: list[dict]) -> None:
        self.responses = list(responses)
        self.prompts: list[str] = []

    def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
        self.prompts.append(prompt)
        if not self.responses:
            raise AssertionError("generate_structured called more times than responses provided")
        return self.responses.pop(0)


VALID_PAYLOAD = {
    "name": "Nguyen Van A",
    "email": "a@example.com",
    "phone": "",
    "summary": "Backend engineer with 3 years of experience.",
    "experience": [{"title": "Engineer", "company": "Acme", "date": "2020-2023", "bullets": ["Built APIs."]}],
    "skills": ["Python"],
    "projects": [],
    "certifications": [],
    "education": [],
}


class TestExtract:
    def test_valid_payload_returns_cvdata(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        cv = CvExtractor(client=client).extract("raw text")
        assert cv.name == "Nguyen Van A"
        assert cv.skills == ["Python"]
        assert len(client.prompts) == 1

    def test_retries_on_invalid_payload_and_reports_error(self) -> None:
        client = FakeGeminiClient(["not json", VALID_PAYLOAD])
        cv = CvExtractor(client=client).extract("raw text")
        assert cv.name == "Nguyen Van A"
        assert len(client.prompts) == 2

    def test_retry_prompt_includes_validation_error(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, VALID_PAYLOAD])
        CvExtractor(client=client).extract("raw text")
        assert "skills" in client.prompts[1]
        assert "Previous attempt" in client.prompts[1]

    def test_exhausts_attempts_then_raises(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, {"skills": "Python"}, {"skills": "Python"}])
        with pytest.raises(CvExtractionError, match="3 attempts"):
            CvExtractor(client=client).extract("raw text")
        assert len(client.prompts) == 3

    def test_defaults_max_attempts_to_three(self) -> None:
        client = FakeGeminiClient([{"skills": "Python"}, {"skills": "Python"}, {"skills": "Python"}])
        with pytest.raises(CvExtractionError):
            CvExtractor(client=client).extract("raw text")
        assert len(client.prompts) == 3

    def test_propagates_gemini_failure(self) -> None:
        class BrokenClient:
            def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
                raise GeminiClientError("Gemini is unavailable.")

        with pytest.raises(GeminiClientError, match="unavailable"):
            CvExtractor(client=BrokenClient()).extract("raw text")

    def test_omits_validation_section_on_first_attempt(self) -> None:
        client = FakeGeminiClient([VALID_PAYLOAD])
        CvExtractor(client=client).extract("raw text")
        assert "Previous attempt" not in client.prompts[0]
        assert "Raw CV text" in client.prompts[0]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_extractor.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.cv_rebuild'`.

- [ ] **Step 3: Implement prompts, extractor, package init**

Create `backend/app/services/cv_rebuild/__init__.py`:

```python
"""Stateless AI Rebuild CV pipeline services."""
```

Create `backend/app/services/cv_rebuild/prompts.py`:

```python
"""Prompts and JSON schema for the single-call Gemini CV rebuild step."""

CV_DATA_JSON_SCHEMA: dict = {
    "type": "object",
    "required": ["name"],
    "properties": {
        "name": {"type": "string"},
        "email": {"type": "string"},
        "phone": {"type": "string"},
        "summary": {"type": "string"},
        "experience": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "company": {"type": "string"},
                    "date": {"type": "string"},
                    "bullets": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "skills": {"type": "array", "items": {"type": "string"}},
        "projects": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                },
            },
        },
        "certifications": {"type": "array", "items": {"type": "string"}},
        "education": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "degree": {"type": "string"},
                    "institution": {"type": "string"},
                    "date": {"type": "string"},
                },
            },
        },
    },
}

_EXTRACT_PROMPT = """You are an expert CV reviewer and professional CV writer.

You receive the raw text extracted from a candidate's CV.

Step 1 — Extract: Build a structured JSON profile containing ONLY information
explicitly present in the raw text. Keep numbers, dates, job titles, company
names, and metrics exactly as written. Do not infer, guess, or add anything
that is not in the text.

Step 2 — Polish: Rewrite the summary and each experience bullet to be
professional, concise, grammatically correct, and consistent in style. Do NOT
change facts, and do NOT add skills, responsibilities, numbers, or experiences
that are not present in the extracted data.

Rules:
- If a field is absent in the raw text, leave it as an empty string or an
  empty array. Never invent placeholder values.
- Preserve the original language of the content.
- "name" is the candidate's full name; if not found, use an empty string.

Raw CV text:
<cv_text>

Output ONLY the JSON object matching the provided schema."""

_VALIDATION_SUFFIX = """

Previous attempt was rejected by validation. Fix exactly these errors and
output only the corrected JSON:

<validation_error>
"""


def build_extraction_prompt(raw_text: str, validation_error: str | None = None) -> str:
    prompt = _EXTRACT_PROMPT.replace("<cv_text>", raw_text.strip())
    if validation_error:
        prompt = prompt + _VALIDATION_SUFFIX.replace(
            "<validation_error>", validation_error.strip()
        )
    return prompt
```

Create `backend/app/services/cv_rebuild/llm_extractor.py`:

```python
"""Extract + polish a CV from raw text with a single Gemini call."""

from pydantic import ValidationError

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.prompts import CV_DATA_JSON_SCHEMA, build_extraction_prompt
from app.services.gemini_client import GeminiClient, GeminiClientError


class CvExtractionError(RuntimeError):
    """Raised when the LLM output is still invalid after all attempts."""


class CvExtractor:
    def __init__(self, client: GeminiClient | None = None) -> None:
        self._client = client or GeminiClient()

    def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
        last_error: ValidationError | None = None
        prompt = build_extraction_prompt(raw_text)
        for _ in range(max_attempts):
            try:
                payload = self._client.generate_structured(
                    prompt=prompt,
                    response_schema=CV_DATA_JSON_SCHEMA,
                )
            except GeminiClientError:
                raise
            try:
                return CVData.model_validate(payload)
            except ValidationError as exc:
                last_error = exc
                prompt = build_extraction_prompt(raw_text, str(last_error))
        raise CvExtractionError(
            f"AI returned an invalid CV structure after {max_attempts} attempts. "
            f"Last validation errors: {last_error}"
        )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_extractor.py -v
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/cv_rebuild backend/tests/test_cv_rebuild_extractor.py
git commit -m "feat(cv-rebuild): add single-call Gemini extractor with retry loop"
```

---

### Task 3: Jinja2 template renderer

**Files:**
- Create: `backend/app/templates/cv_template.html`
- Create: `backend/app/services/cv_rebuild/template_renderer.py`
- Test: `backend/tests/test_cv_rebuild_template.py`

**Interfaces:**
- Consumes: `app.schemas.cv_rebuild.CVData` (Task 1).
- Produces: `render_cv(cv: CVData) -> str` (full HTML document string).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_cv_rebuild_template.py`:

```python
from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild.template_renderer import render_cv


def test_empty_cv_omits_all_section_headings() -> None:
    html = render_cv(CVData())
    for heading in ("Summary", "Experience", "Projects", "Skills", "Certifications", "Education"):
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
    assert "<h2>Summary</h2>" in html
    assert "<h2>Experience</h2>" in html
    assert "Engineer" in html
    assert "Acme" in html
    assert "Built APIs." in html
    for heading in ("Projects", "Skills", "Certifications", "Education"):
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_template.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.cv_rebuild.template_renderer'`.

- [ ] **Step 3: Implement the template and renderer**

Create `backend/app/templates/cv_template.html` (exact content):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CV</title>
<style>
  :root {
    --accent: #2563EB;
    --text-primary: #0F172A;
    --text-secondary: #64748B;
    --border: #E2E8F0;
    --bg: #FFFFFF;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 11px;
    color: var(--text-primary);
    background: var(--bg);
    line-height: 1.5;
  }
  .page { padding: 36px 40px; }
  header.cv-header { text-align: center; margin-bottom: 22px; }
  header.cv-header h1 { font-size: 24px; letter-spacing: 0.02em; }
  .contact { margin-top: 6px; color: var(--text-secondary); font-size: 10.5px; }
  .contact span + span::before { content: " \00b7 "; }
  section.cv-section { margin-bottom: 18px; page-break-inside: avoid; }
  section.cv-section h2 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    border-bottom: 1.5px solid var(--accent);
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .item { margin-bottom: 10px; page-break-inside: avoid; }
  .item-head { display: flex; justify-content: space-between; gap: 12px; }
  .item-head .title { font-weight: 600; }
  .item-head .sub { color: var(--text-secondary); }
  .item-head .date { color: var(--text-secondary); white-space: nowrap; }
  ul.bullets { padding-left: 16px; margin-top: 4px; }
  ul.bullets li { margin-bottom: 2px; }
  .skills-list { display: flex; flex-wrap: wrap; }
  .skills-list span + span::before { content: " \00b7 "; }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
<div class="page">
  {% if data.name %}
  <header class="cv-header">
    <h1>{{ data.name }}</h1>
    {% if data.email or data.phone %}
    <div class="contact">
      {% if data.email %}<span>{{ data.email }}</span>{% endif %}
      {% if data.phone %}<span>{{ data.phone }}</span>{% endif %}
    </div>
    {% endif %}
  </header>
  {% endif %}

  {% if data.summary %}
  <section class="cv-section">
    <h2>Summary</h2>
    <p>{{ data.summary }}</p>
  </section>
  {% endif %}

  {% if data.experience %}
  <section class="cv-section">
    <h2>Experience</h2>
    {% for item in data.experience %}
    <div class="item">
      <div class="item-head">
        <div>
          <span class="title">{{ item.title }}</span>
          {% if item.company %}<span class="sub"> — {{ item.company }}</span>{% endif %}
        </div>
        {% if item.date %}<span class="date">{{ item.date }}</span>{% endif %}
      </div>
      {% if item.bullets %}
      <ul class="bullets">
        {% for bullet in item.bullets %}<li>{{ bullet }}</li>{% endfor %}
      </ul>
      {% endif %}
    </div>
    {% endfor %}
  </section>
  {% endif %}

  {% if data.projects %}
  <section class="cv-section">
    <h2>Projects</h2>
    {% for project in data.projects %}
    <div class="item">
      <div class="item-head">
        <div><span class="title">{{ project.name }}</span></div>
      </div>
      {% if project.description %}<p>{{ project.description }}</p>{% endif %}
    </div>
    {% endfor %}
  </section>
  {% endif %}

  {% if data.skills %}
  <section class="cv-section">
    <h2>Skills</h2>
    <div class="skills-list">
      {% for skill in data.skills %}<span>{{ skill }}</span>{% endfor %}
    </div>
  </section>
  {% endif %}

  {% if data.certifications %}
  <section class="cv-section">
    <h2>Certifications</h2>
    <ul class="bullets">
      {% for cert in data.certifications %}<li>{{ cert }}</li>{% endfor %}
    </ul>
  </section>
  {% endif %}

  {% if data.education %}
  <section class="cv-section">
    <h2>Education</h2>
    {% for education in data.education %}
    <div class="item">
      <div class="item-head">
        <div>
          <span class="title">{{ education.degree }}</span>
          {% if education.institution %}<span class="sub"> — {{ education.institution }}</span>{% endif %}
        </div>
        {% if education.date %}<span class="date">{{ education.date }}</span>{% endif %}
      </div>
    </div>
    {% endfor %}
  </section>
  {% endif %}
</div>
</body>
</html>
```

Create `backend/app/services/cv_rebuild/template_renderer.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_template.py -v
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/templates/cv_template.html backend/app/services/cv_rebuild/template_renderer.py backend/tests/test_cv_rebuild_template.py
git commit -m "feat(cv-rebuild): add Jinja2 CV template renderer"
```

---

### Task 4: Playwright PDF + thumbnail renderer

**Files:**
- Create: `backend/app/services/cv_rebuild/pdf_renderer.py`
- Test: `backend/tests/test_cv_rebuild_pdf_renderer.py`

**Interfaces:**
- Consumes: nothing from earlier tasks (takes HTML string).
- Produces: `PdfRenderError(RuntimeError)`, `render_pdf_with_thumbnail(html: str) -> tuple[bytes, bytes]` (pdf bytes, JPEG thumbnail bytes), `resize_thumbnail(image_bytes: bytes, width: int = 300) -> bytes`, `stop_browser() -> None`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_cv_rebuild_pdf_renderer.py`:

```python
import io

from PIL import Image

from app.services.cv_rebuild.pdf_renderer import resize_thumbnail


def test_resize_thumbnail_scales_to_width_and_returns_jpeg() -> None:
    source = Image.new("RGB", (794, 1123), color=(255, 255, 255))
    buffer = io.BytesIO()
    source.save(buffer, format="PNG")

    result = resize_thumbnail(buffer.getvalue())

    with Image.open(io.BytesIO(result)) as resized:
        assert resized.width == 300
        assert abs(resized.height - 424) <= 1
        assert resized.format == "JPEG"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_pdf_renderer.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.cv_rebuild.pdf_renderer'`.

- [ ] **Step 3: Implement the renderer**

Create `backend/app/services/cv_rebuild/pdf_renderer.py`:

```python
"""Render CV HTML to PDF bytes and a first-page JPEG thumbnail via Playwright."""

import atexit
import threading
from io import BytesIO

from PIL import Image

THUMBNAIL_WIDTH = 300
THUMBNAIL_JPEG_QUALITY = 80

_PDF_KWARGS = {
    "format": "A4",
    "margin": {"top": "0", "right": "0", "bottom": "0", "left": "0"},
    "print_background": True,
}

_browser_lock = threading.Lock()
_playwright = None
_browser = None


class PdfRenderError(RuntimeError):
    """Raised when headless Chromium cannot render the CV."""


def resize_thumbnail(image_bytes: bytes, width: int = THUMBNAIL_WIDTH) -> bytes:
    """Resize a PNG/JPEG screenshot to A4-ratio JPEG at the given width."""
    with Image.open(BytesIO(image_bytes)) as image:
        height = max(1, round(image.height * width / image.width))
        resized = image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
        output = BytesIO()
        resized.save(output, format="JPEG", quality=THUMBNAIL_JPEG_QUALITY)
        return output.getvalue()


def _ensure_browser():
    global _playwright, _browser
    with _browser_lock:
        if _browser is None or not _browser.is_connected():
            try:
                from playwright.sync_api import sync_playwright
            except ImportError as exc:
                raise PdfRenderError(
                    "Playwright is not installed; run `pip install playwright`."
                ) from exc
            if _playwright is None:
                _playwright = sync_playwright().start()
            try:
                _browser = _playwright.chromium.launch()
            except Exception as exc:
                raise PdfRenderError(
                    "Headless Chromium is not installed; run "
                    "`.venv\\Scripts\\python.exe -m playwright install chromium`."
                ) from exc
        return _browser


def stop_browser() -> None:
    global _playwright, _browser
    with _browser_lock:
        if _browser is not None:
            _browser.close()
            _browser = None
        if _playwright is not None:
            _playwright.stop()
            _playwright = None


atexit.register(stop_browser)


def render_pdf_with_thumbnail(html: str) -> tuple[bytes, bytes]:
    """Render the HTML document to PDF bytes and a page-1 JPEG thumbnail."""
    try:
        browser = _ensure_browser()
        context = browser.new_context(viewport={"width": 794, "height": 1123})
        try:
            page = context.new_page()
            page.set_content(html, wait_until="load")
            pdf_bytes = page.pdf(**_PDF_KWARGS)
            screenshot = page.screenshot(full_page=False, type="png")
        finally:
            context.close()
    except PdfRenderError:
        raise
    except Exception as exc:
        raise PdfRenderError(f"PDF rendering failed: {exc}") from exc
    return pdf_bytes, resize_thumbnail(screenshot)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_pdf_renderer.py -v
```

Expected: PASS (1 test).

- [ ] **Step 5: Smoke-test the real renderer once (manual)**

From `backend/`, run:

```bash
.venv\Scripts\python.exe -c "from app.services.cv_rebuild.template_renderer import render_cv; from app.services.cv_rebuild.pdf_renderer import render_pdf_with_thumbnail, stop_browser; from app.schemas.cv_rebuild import CVData; html = render_cv(CVData(name='Test User', summary='Hello', skills=['Python'])); pdf, thumb = render_pdf_with_thumbnail(html); print(len(pdf), len(thumb)); stop_browser()"
```

Expected: prints two positive byte counts (e.g. `13245 2100`); no exception.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/cv_rebuild/pdf_renderer.py backend/tests/test_cv_rebuild_pdf_renderer.py
git commit -m "feat(cv-rebuild): add Playwright PDF and thumbnail renderer"
```

---

### Task 5: Stateless orchestrator

**Files:**
- Create: `backend/app/services/cv_rebuild/orchestrator.py`
- Test: `backend/tests/test_cv_rebuild_orchestrator.py`

**Interfaces:**
- Consumes: `document_parser.validate_cv_content` / `extract_document_text`; `CvExtractor.extract` (Task 2); `render_cv` (Task 3); `render_pdf_with_thumbnail` (Task 4); `CvRebuildResponse` (Task 1).
- Produces: `rebuild_cv(content: bytes, filename: str, *, extractor: CvExtractor | None = None) -> CvRebuildResponse`. Raises `ValueError` (bad file), `CvExtractionError` (bad LLM output), `GeminiClientError`, `PdfRenderError`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_cv_rebuild_orchestrator.py`:

```python
import tempfile
from pathlib import Path

from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.orchestrator import rebuild_cv
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.gemini_client import GeminiClientError

_MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    b"4 0 obj<</Length 90>>stream\n"
    b"BT /F1 12 Tf 72 720 Td (Backend engineer with skills in Python and FastAPI) Tj ET\n"
    b"endstream endobj\n"
    b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    b"xref\n"
    b"0 6\n"
    b"0000000000 65535 f \n"
    b"0000000009 00000 n \n"
    b"0000000058 00000 n \n"
    b"0000000115 00000 n \n"
    b"0000000255 00000 n \n"
    b"0000000405 00000 n \n"
    b"trailer<</Size 6/Root 1 0 R>>\n"
    b"startxref\n"
    b"456\n"
    b"%%EOF"
)


class FakeExtractor:
    def __init__(self, result: CVData) -> None:
        self.result = result

    def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
        assert "Backend engineer" in raw_text
        return self.result


class TestRebuildCv:
    def test_rejects_invalid_file_format(self) -> None:
        try:
            rebuild_cv(b"plain text", "cv.txt", extractor=FakeExtractor(CVData()))
        except ValueError as exc:
            assert "Only PDF and DOCX" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_rejects_corrupt_pdf_bytes(self) -> None:
        try:
            rebuild_cv(
                b"%PDF-1.4 not really a pdf",
                "cv.pdf",
                extractor=FakeExtractor(CVData()),
            )
        except ValueError as exc:
            assert "not a valid PDF" in str(exc)
        else:
            raise AssertionError("expected ValueError")

    def test_returns_expected_response_shape(self) -> None:
        cv = CVData(
            name="Nguyen Van A",
            summary="Backend engineer with 3 years of experience.",
        )
        result = rebuild_cv(
            _MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(cv)
        )
        assert result.filename == "rebuilt_cv.pdf"
        assert result.preview_json.name == "Nguyen Van A"
        assert result.pdf_base64
        assert result.thumbnail_base64

    def test_leaves_no_temp_dirs_and_no_upload_files(self, monkeypatch) -> None:
        cv = CVData(name="A")
        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", lambda html: (b"pdf", b"thumb")
        )
        temp_root = Path(tempfile.gettempdir())
        before = set(temp_root.glob("fitcv-rebuild-*"))
        rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(cv))
        after = set(temp_root.glob("fitcv-rebuild-*"))
        assert before == after

    def test_propagates_extraction_error(self, monkeypatch) -> None:
        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", lambda html: (b"pdf", b"thumb")
        )

        class BrokenExtractor:
            def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
                raise CvExtractionError("invalid structure")

        try:
            rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=BrokenExtractor())
        except CvExtractionError as exc:
            assert "invalid structure" in str(exc)
        else:
            raise AssertionError("expected CvExtractionError")

    def test_propagates_gemini_error(self, monkeypatch) -> None:
        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", lambda html: (b"pdf", b"thumb")
        )

        class BrokenExtractor:
            def extract(self, raw_text: str, *, max_attempts: int = 3) -> CVData:
                raise GeminiClientError("busy")

        try:
            rebuild_cv(_MINIMAL_PDF, "cv.pdf", extractor=BrokenExtractor())
        except GeminiClientError as exc:
            assert "busy" in str(exc)
        else:
            raise AssertionError("expected GeminiClientError")

    def test_propagates_render_error(self, monkeypatch) -> None:
        def raise_render_error(html: str) -> tuple[bytes, bytes]:
            raise PdfRenderError("no chromium")

        monkeypatch.setattr(
            orchestrator, "render_pdf_with_thumbnail", raise_render_error
        )
        try:
            rebuild_cv(
                _MINIMAL_PDF, "cv.pdf", extractor=FakeExtractor(CVData())
            )
        except PdfRenderError as exc:
            assert "no chromium" in str(exc)
        else:
            raise AssertionError("expected PdfRenderError")
```

Note: `_MINIMAL_PDF` is a valid pypdf-readable one-page PDF containing the
extracted text "Backend engineer with skills in Python and FastAPI" (>20
chars, satisfying `extract_document_text`). `test_rejects_corrupt_pdf_bytes`
passes magic-byte validation but fails when pypdf tries to parse it, so the
orchestrator must map that to a `ValueError`.

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_orchestrator.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.cv_rebuild.orchestrator'`.

- [ ] **Step 3: Implement the orchestrator**

Create `backend/app/services/cv_rebuild/orchestrator.py`:

```python
"""Stateless orchestrator for the AI Rebuild CV pipeline.

Never touches the database or long-lived storage. Upload bytes are written to
a TemporaryDirectory only while the source file is parsed, then deleted.
"""

import base64
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf.errors import PdfReadError

from app.schemas.cv_rebuild import CvRebuildResponse
from app.services.cv_rebuild.llm_extractor import CvExtractor
from app.services.cv_rebuild.pdf_renderer import render_pdf_with_thumbnail
from app.services.cv_rebuild.template_renderer import render_cv
from app.services.document_parser import extract_document_text, validate_cv_content


def rebuild_cv(
    content: bytes,
    filename: str,
    *,
    extractor: CvExtractor | None = None,
) -> CvRebuildResponse:
    file_type = validate_cv_content(filename, content)
    suffix = Path(filename).suffix.lower() or (
        ".pdf" if file_type == "PDF" else ".docx"
    )

    with TemporaryDirectory(prefix="fitcv-rebuild-") as directory:
        source_path = Path(directory) / f"uploaded{suffix}"
        source_path.write_bytes(content)
        try:
            raw_text = extract_document_text(source_path, file_type)
        except ValueError:
            raise
        except PdfReadError as exc:
            raise ValueError("The uploaded file is not a valid PDF.") from exc
        except Exception as exc:
            raise ValueError(f"Unable to read the CV file: {exc}") from exc

    cv = (extractor or CvExtractor()).extract(raw_text)
    html = render_cv(cv)
    pdf_bytes, thumbnail_bytes = render_pdf_with_thumbnail(html)

    return CvRebuildResponse(
        filename="rebuilt_cv.pdf",
        preview_json=cv,
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        thumbnail_base64=base64.b64encode(thumbnail_bytes).decode("ascii"),
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_orchestrator.py -v
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/cv_rebuild/orchestrator.py backend/tests/test_cv_rebuild_orchestrator.py
git commit -m "feat(cv-rebuild): add stateless rebuild orchestrator"
```

---

### Task 6: FastAPI route + registration

**Files:**
- Create: `backend/app/api/routes/cv_rebuild.py`
- Modify: `backend/app/main.py` (import + include_router)
- Test: `backend/tests/test_cv_rebuild_api.py`

**Interfaces:**
- Consumes: `rebuild_cv` (Task 5), `CvRebuildResponse` (Task 1), `get_current_account`, exception types from Tasks 2/4.
- Produces: `router` with `POST /rebuild` (mounted at `/api/cv`).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_cv_rebuild_api.py`:

```python
from fastapi.testclient import TestClient

from app.api.deps import get_current_account
from app.main import app
from app.schemas.cv_rebuild import CVData
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.gemini_client import GeminiClientError


class FakeAccount:
    account_id = 1


def _make_client() -> TestClient:
    app.dependency_overrides[get_current_account] = lambda: FakeAccount()
    return TestClient(app)


def _post(client: TestClient, content: bytes, filename: str = "cv.pdf"):
    return client.post(
        "/api/cv/rebuild",
        files={"file": (filename, content, "application/octet-stream")},
    )


def test_requires_auth() -> None:
    app.dependency_overrides.clear()
    client = TestClient(app)
    response = client.post(
        "/api/cv/rebuild",
        files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 401


def test_rejects_unsupported_extension() -> None:
    client = _make_client()
    response = _post(client, b"hello", filename="cv.txt")
    assert response.status_code == 400
    assert "Only PDF and DOCX" in response.json()["detail"]


def test_rejects_empty_file() -> None:
    client = _make_client()
    response = _post(client, b"")
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]


def test_rejects_oversized_file() -> None:
    client = _make_client()
    response = _post(client, b"%PDF-1.4" + b"x" * (10 * 1024 * 1024))
    assert response.status_code == 400
    assert "10 MB" in response.json()["detail"]


def test_maps_extraction_error_to_422(monkeypatch) -> None:
    def raise_extraction(content, filename):
        raise CvExtractionError("invalid structure after retries")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_extraction)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 422
    assert "invalid structure" in response.json()["detail"]


def test_maps_gemini_error_to_502(monkeypatch) -> None:
    def raise_gemini(content, filename):
        raise GeminiClientError("busy")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_gemini)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 502


def test_maps_render_error_to_502(monkeypatch) -> None:
    def raise_render(content, filename):
        raise PdfRenderError("no chromium")

    monkeypatch.setattr(orchestrator, "rebuild_cv", raise_render)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 502


def test_success_shape(monkeypatch) -> None:
    def fake_rebuild(content, filename):
        return {
            "filename": "rebuilt_cv.pdf",
            "preview_json": CVData(name="A").model_dump(),
            "pdf_base64": "cGRm",
            "thumbnail_base64": "dGh1bWI=",
        }

    monkeypatch.setattr(orchestrator, "rebuild_cv", fake_rebuild)
    client = _make_client()
    response = _post(client, b"%PDF-1.4")
    assert response.status_code == 200
    payload = response.json()
    assert payload["filename"] == "rebuilt_cv.pdf"
    assert payload["preview_json"]["name"] == "A"
    assert payload["pdf_base64"] == "cGRm"
    assert payload["thumbnail_base64"] == "dGh1bWI="
```

Note: the success test's fake returns a plain dict; FastAPI validates it
against `CvRebuildResponse` via `response_model`. `test_rejects_unsupported_extension`
runs the real `rebuild_cv` — validation fails before any LLM/browser call.

- [ ] **Step 2: Run test to verify it fails**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_api.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.api.routes.cv_rebuild'`.

- [ ] **Step 3: Implement the route**

Create `backend/app/api/routes/cv_rebuild.py`:

```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_account
from app.models.account import Account
from app.schemas.cv_rebuild import CvRebuildResponse
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.orchestrator import rebuild_cv
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.document_parser import MAX_CV_BYTES
from app.services.gemini_client import GeminiClientError

router = APIRouter()


@router.post("/rebuild", response_model=CvRebuildResponse)
def rebuild_from_cv(
    file: UploadFile = File(...),
    account: Account = Depends(get_current_account),
) -> CvRebuildResponse:
    content = file.file.read(MAX_CV_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="File is empty.")
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(status_code=400, detail="CV file must be 10 MB or smaller.")
    try:
        return rebuild_cv(content, file.filename or "cv.pdf")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CvExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (GeminiClientError, PdfRenderError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
```

Modify `backend/app/main.py`:

```python
from app.api.routes import (
    analyzer,
    applications,
    auth,
    cv_ranking,
    cv_rebuild,
    email_workflow,
    improvements,
    jobs,
    pipeline,
    profile,
)
```

and after the existing `include_router` calls:

```python
app.include_router(cv_rebuild.router, prefix="/api/cv", tags=["cv-rebuild"])
```

- [ ] **Step 4: Run test to verify it passes**

```bash
.venv\Scripts\python.exe -m pytest tests/test_cv_rebuild_api.py -v
```

Expected: PASS (8 tests).

- [ ] **Step 5: Run the whole backend suite to confirm no regressions**

```bash
.venv\Scripts\python.exe -m pytest -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/cv_rebuild.py backend/app/main.py backend/tests/test_cv_rebuild_api.py
git commit -m "feat(cv-rebuild): add POST /api/cv/rebuild endpoint"
```

---

### Task 7: Frontend types + API client

**Files:**
- Create: `src/types/cvRebuild.ts`
- Create: `src/api/cvRebuildApi.ts`
- Test: `src/api/cvRebuildApi.test.ts`

**Interfaces:**
- Consumes: `requestJson` from `src/api/httpClient.ts` (existing; auth header added when `authenticated: true`).
- Produces: types `CvRebuildData`, `CvRebuildExperienceItem`, `CvRebuildProjectItem`, `CvRebuildEducationItem`, `CvRebuildResponse`; functions `rebuildCv(file: File): Promise<CvRebuildResponse>`, `pdfBase64ToBlob(base64: string): Blob`, `thumbnailDataUrl(base64: string): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/api/cvRebuildApi.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { pdfBase64ToBlob, thumbnailDataUrl } from "./cvRebuildApi"

describe("cvRebuildApi helpers", () => {
  it("converts pdf base64 to a PDF blob", () => {
    const blob = pdfBase64ToBlob("JVBERTEtNA==")
    expect(blob.type).toBe("application/pdf")
    expect(blob.size).toBe(6)
  })

  it("builds a jpeg data url from thumbnail base64", () => {
    expect(thumbnailDataUrl("AAAA")).toBe("data:image/jpeg;base64,AAAA")
  })
})
```

Note: `atob` is not defined in jsdom by default in some setups; if `atob` is missing, the test setup needs it — check `src/test/setup.ts`; if absent, polyfill at the top of the test:

```ts
if (typeof globalThis.atob !== "function") {
  globalThis.atob = (value: string) => Buffer.from(value, "base64").toString("binary")
}
```

(jsdom 29 includes `atob`; only add the polyfill if the run fails.)

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/api/cvRebuildApi.test.ts
```

Expected: FAIL with `Cannot find module './cvRebuildApi'`.

- [ ] **Step 3: Implement types and API client**

Create `src/types/cvRebuild.ts`:

```ts
export interface CvRebuildExperienceItem {
  title: string

  company: string

  date: string

  bullets: string[]
}

export interface CvRebuildProjectItem {
  name: string

  description: string
}

export interface CvRebuildEducationItem {
  degree: string

  institution: string

  date: string
}

export interface CvRebuildData {
  name: string

  email: string

  phone: string

  summary: string

  experience: CvRebuildExperienceItem[]

  skills: string[]

  projects: CvRebuildProjectItem[]

  certifications: string[]

  education: CvRebuildEducationItem[]
}

export interface CvRebuildResponse {
  filename: string

  preview_json: CvRebuildData

  pdf_base64: string

  thumbnail_base64: string
}
```

Create `src/api/cvRebuildApi.ts`:

```ts
import type { CvRebuildResponse } from "@/types/cvRebuild"

import { requestJson } from "./httpClient"

export function rebuildCv(file: File): Promise<CvRebuildResponse> {
  const form = new FormData()

  form.append("file", file)

  return requestJson<CvRebuildResponse>("/api/cv/rebuild", {
    method: "POST",
    body: form,
    authenticated: true,
  })
}

export function pdfBase64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64)

  const byteNumbers = new Array<number>(byteCharacters.length)

  for (let index = 0; index < byteCharacters.length; index += 1) {
    byteNumbers[index] = byteCharacters.charCodeAt(index)
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" })
}

export function thumbnailDataUrl(base64: string): string {
  return `data:image/jpeg;base64,${base64}`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/api/cvRebuildApi.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/cvRebuild.ts src/api/cvRebuildApi.ts src/api/cvRebuildApi.test.ts
git commit -m "feat(cv-rebuild): add frontend types and API client"
```

---

### Task 8: CV Rebuild screen

**Files:**
- Create: `src/ui/screens/CVReBuildScreen.tsx`
- Test: `src/ui/screens/CVReBuildScreen.test.tsx`

**Interfaces:**
- Consumes: `rebuildCv`, `pdfBase64ToBlob`, `thumbnailDataUrl` (Task 7); types from Task 7.
- Produces: default-exported `CVReBuildScreen` component (no props).

- [ ] **Step 1: Write the failing tests**

Create `src/ui/screens/CVReBuildScreen.test.tsx`:

```tsx
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  rebuildCv: vi.fn(),
  pdfBase64ToBlob: vi.fn(),
  thumbnailDataUrl: vi.fn(),
}))

vi.mock("@/api/cvRebuildApi", () => apiMocks)

import ToastProvider from "@/ui/components/ToastProvider"

import CVReBuildScreen from "./CVReBuildScreen"

function makeFile(name = "cv.pdf", type = "application/pdf"): File {
  return new File(["%PDF-1.4"], name, { type })
}

const RESULT = {
  filename: "rebuilt_cv.pdf",
  preview_json: {
    name: "Nguyen Van A",
    email: "a@example.com",
    phone: "",
    summary: "Backend engineer.",
    experience: [],
    skills: ["Python"],
    projects: [],
    certifications: [],
    education: [],
  },
  pdf_base64: "cGRm",
  thumbnail_base64: "aW1n",
}

describe("CVReBuildScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.pdfBase64ToBlob.mockReturnValue(
      new Blob(["pdf"], { type: "application/pdf" }),
    )
    apiMocks.thumbnailDataUrl.mockImplementation(
      (base64: string) => `data:image/jpeg;base64,${base64}`,
    )
  })

  it("shows a skeleton while the pipeline is processing", async () => {
    apiMocks.rebuildCv.mockImplementation(() => new Promise(() => {}))

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    expect(await screen.findByText(/rebuilding/i)).toBeInTheDocument()
  })

  it("renders a thumbnail card and opens a PDF modal on click", async () => {
    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    const thumbnail = await screen.findByRole("img", {
      name: /rebuilt cv preview/i,
    })

    expect(apiMocks.thumbnailDataUrl).toHaveBeenCalledWith("aW1n")

    fireEvent.click(thumbnail)

    expect(await screen.findByTitle("Rebuilt CV")).toBeInTheDocument()
  })

  it("downloads from cached base64 without calling the API again", async () => {
    const createObjectURL = vi.fn(() => "blob:mock")
    const revokeObjectURL = vi.fn()
    const anchorClick = vi.fn()

    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
    })

    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
    })

    HTMLAnchorElement.prototype.click = anchorClick

    apiMocks.rebuildCv.mockResolvedValue(RESULT)

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    fireEvent.click(
      await screen.findByRole("img", { name: /rebuilt cv preview/i }),
    )

    const dialog = await screen.findByRole("dialog")

    fireEvent.click(
      within(dialog).getByRole("button", { name: /download pdf/i }),
    )

    await waitFor(() => {
      expect(apiMocks.pdfBase64ToBlob).toHaveBeenCalledWith("cGRm")
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(anchorClick).toHaveBeenCalledTimes(1)
      expect(apiMocks.rebuildCv).toHaveBeenCalledTimes(1)
    })
  })

  it("rejects invalid file types with an error toast", async () => {
    render(
      <>
        <ToastProvider />
        <CVReBuildScreen />
      </>,
    )

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: {
        files: [
          new File(["x"], "cv.exe", { type: "application/octet-stream" }),
        ],
      },
    })

    expect(await screen.findByText(/only pdf and docx/i)).toBeInTheDocument()
    expect(apiMocks.rebuildCv).not.toHaveBeenCalled()
  })

  it("shows the API error message on failure", async () => {
    apiMocks.rebuildCv.mockRejectedValue(
      new Error("Gemini is busy. Try again later."),
    )

    render(<CVReBuildScreen />)

    fireEvent.change(screen.getByTestId("cv-rebuild-input"), {
      target: { files: [makeFile()] },
    })

    expect(await screen.findByText(/gemini is busy/i)).toBeInTheDocument()
  })
})
```

Note: `getByTestId("cv-rebuild-input")` targets the hidden file input (the
`aria-label` route fails because `display: none` inputs are excluded from the
accessibility tree). The modal's "Download PDF" button is disambiguated with
`within(dialog)` because the card button of the same name is still in the DOM.
The invalid-file test wraps the screen in `ToastProvider` so the sonner toast
is rendered into the document.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/ui/screens/CVReBuildScreen.test.tsx
```

Expected: FAIL with `Cannot find module './CVReBuildScreen'`.

- [ ] **Step 3: Implement the screen**

Create `src/ui/screens/CVReBuildScreen.tsx`:

```tsx
import { useRef, useState } from "react"

import { CloudArrowUp, Download, FileText, X } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  pdfBase64ToBlob,
  rebuildCv,
  thumbnailDataUrl,
} from "@/api/cvRebuildApi"
import type { CvRebuildResponse } from "@/types/cvRebuild"

const ACCEPTED_TYPES =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const MAX_BYTES = 10 * 1024 * 1024

type RebuildState =
  | { phase: "idle" }
  | { phase: "processing"; file: File }
  | { phase: "done"; file: File; result: CvRebuildResponse }
  | { phase: "error"; file: File; message: string }

function isValidFile(file: File): string | null {
  if (!/\.(pdf|docx)$/i.test(file.name)) {
    return "Only PDF and DOCX files are supported."
  }

  if (file.size > MAX_BYTES) {
    return "CV file must be 10 MB or smaller."
  }

  return null
}

export default function CVReBuildScreen() {
  const [state, setState] = useState<RebuildState>({ phase: "idle" })
  const [dragOver, setDragOver] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const runRebuild = async (file: File) => {
    const validationError = isValidFile(file)

    if (validationError) {
      setState({ phase: "idle" })

      toast.error(validationError)

      return
    }

    setState({ phase: "processing", file })

    try {
      const result = await rebuildCv(file)

      setState({ phase: "done", file, result })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Rebuild failed. Try again later."

      setState({ phase: "error", file, message })

      toast.error(message)
    }
  }

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]

    if (file) void runRebuild(file)
  }

  const handleDownload = () => {
    if (state.phase !== "done") return

    const blob = pdfBase64ToBlob(state.result.pdf_base64)

    const url = URL.createObjectURL(blob)

    const anchor = document.createElement("a")

    anchor.href = url

    anchor.download = state.result.filename

    document.body.appendChild(anchor)

    anchor.click()

    anchor.remove()

    URL.revokeObjectURL(url)
  }

  const pdfDataUrl =
    state.phase === "done"
      ? `data:application/pdf;base64,${state.result.pdf_base64}`
      : null

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 56px" }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        AI Rebuild CV
      </h1>

      <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>
        Upload your CV and our AI extracts, professionalizes, and renders a new
        polished PDF you can preview and download.
      </p>

      {state.phase === "idle" && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              inputRef.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()

            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()

            setDragOver(false)

            handleFiles(event.dataTransfer.files)
          }}
          style={{
            border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 16,
            background: dragOver ? "color-mix(in srgb, var(--accent) 6%, white)" : "white",
            padding: "64px 24px",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <CloudArrowUp size={40} weight="light" color="var(--text-secondary)" />

          <p style={{ marginTop: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            Drag and drop your CV here, or browse files
          </p>

          <p style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 13 }}>
            PDF or DOCX, up to 10 MB
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            aria-label="Upload your CV"
            data-testid="cv-rebuild-input"
            style={{ display: "none" }}
            onChange={(event) => {
              handleFiles(event.target.files)

              event.target.value = ""
            }}
          />
        </div>
      )}

      {state.phase === "processing" && (
        <div
          aria-label="Rebuilding CV"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            background: "white",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div
              style={{
                width: 116,
                height: 164,
                borderRadius: 8,
                background:
                  "linear-gradient(100deg, #EEF2F7 40%, #F8FAFC 50%, #EEF2F7 60%)",
                backgroundSize: "200% 100%",
                animation: "fitcv-shimmer 1.4s infinite",
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                Rebuilding CV…{" "}
                <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                  ({state.file.name})
                </span>
              </p>

              <p
                style={{
                  marginTop: 8,
                  color: "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                Extracting details, polishing wording, and rendering the PDF.
                This usually takes a few seconds.
              </p>

              <div
                style={{
                  marginTop: 16,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "45%",
                    height: "100%",
                    borderRadius: 999,
                    background: "var(--accent)",
                    animation: "fitcv-progress 1.2s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fitcv-shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            @keyframes fitcv-progress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(320%); }
            }
          `}</style>
        </div>
      )}

      {state.phase === "error" && (
        <div
          style={{
            border: "1px solid #FECACA",
            borderRadius: 16,
            background: "#FEF2F2",
            padding: 20,
            textAlign: "center",
          }}
        >
          <p style={{ color: "#B91C1C", fontWeight: 600 }}>
            Rebuild failed: {state.message}
          </p>

          <button
            type="button"
            onClick={() => setState({ phase: "idle" })}
            style={{
              marginTop: 14,
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text-primary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try another file
          </button>
        </div>
      )}

      {state.phase === "done" && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            background: "white",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <img
              src={thumbnailDataUrl(state.result.thumbnail_base64)}
              alt="Rebuilt CV preview"
              role="img"
              onClick={() => setModalOpen(true)}
              style={{
                width: 150,
                borderRadius: 8,
                border: "1px solid var(--border)",
                cursor: "zoom-in",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
              }}
            />

            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                {state.result.preview_json.name || "Your rebuilt CV"}
              </h2>

              <p
                style={{
                  marginTop: 6,
                  color: "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                {state.result.preview_json.summary ||
                  "Your CV has been rebuilt. Click the preview to inspect the full document."}
              </p>

              <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 10,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <FileText size={16} weight="light" /> View full CV
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "white",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Download size={16} weight="light" /> Download PDF
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setState({ phase: "idle" })}
            style={{
              marginTop: 18,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "white",
              color: "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Rebuild another CV
          </button>
        </div>
      )}

      {modalOpen && state.phase === "done" && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false)
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(880px, 100%)",
              height: "min(92vh, 100%)",
              background: "white",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>
                {state.result.preview_json.name || "Rebuilt CV"}
              </strong>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Download size={15} weight="light" /> Download PDF
                </button>

                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setModalOpen(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <iframe
              title="Rebuilt CV"
              src={pdfDataUrl ?? undefined}
              style={{ flex: 1, border: "none", width: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/ui/screens/CVReBuildScreen.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/CVReBuildScreen.tsx src/ui/screens/CVReBuildScreen.test.tsx
git commit -m "feat(cv-rebuild): add CV rebuild screen with preview modal"
```

---

### Task 9: Wire navigation, replace SeekerDashboard, full verification

**Files:**
- Modify: `src/types/app.ts` (ScreenId: `"seeker-dashboard"` → `"cv-rebuild"`)
- Modify: `src/data/navigation.tsx` (Dashboard item → CV Rebuild)
- Modify: `src/app/App.tsx` (imports, defaultScreen, switch case, default branch)
- Delete: `src/ui/screens/SeekerDashboard.tsx`
- Modify: `src/app/App.test.tsx` (mock CVReBuildScreen instead of SeekerDashboard)

**Interfaces:**
- Consumes: `CVReBuildScreen` (Task 8), `ScreenId` values.

- [ ] **Step 1: Update ScreenId**

In `src/types/app.ts` line 3, replace `"seeker-dashboard"` with `"cv-rebuild"`:

```ts
export type SeekerScreenId = "cv-rebuild" | "analyzer" | "improvement" | "cv-history" | "app-tracker" | "jd-library" | "profile"
```

- [ ] **Step 2: Update navigation**

In `src/data/navigation.tsx`, replace the first seeker nav item (lines 29-35) with:

```tsx
{
  icon: <FileText size={18} weight="light" />,

  label: "CV Rebuild",

  screen: "cv-rebuild",
},
```

`FileText` is already imported (line 13).

- [ ] **Step 3: Update App.tsx**

- Replace the `SeekerDashboard` lazy import (line 22) with:

```tsx
const CVReBuildScreen = lazy(() => import("@/ui/screens/CVReBuildScreen"))
```

- Replace `defaultScreen` (lines 39-41):

```ts
function defaultScreen(portal: Portal) {
  return portal === "seeker" ? "cv-rebuild" : "hr-dashboard"
}
```

- Replace the switch case (lines 280-281):

```tsx
case "cv-rebuild":
  return <CVReBuildScreen />
```

- Replace the default branch (lines 319-321):

```tsx
default:
  return portal === "seeker" ? (
    <CVReBuildScreen />
  ) : (
    <HRDashboard onNavigate={handleNavigate} />
  )
```

- [ ] **Step 4: Update App.test.tsx**

Replace the `SeekerDashboard` mock (lines 68-70):

```tsx
vi.mock("@/ui/screens/CVReBuildScreen", () => ({
  default: () => <div>CV rebuild screen</div>,
}))
```

- [ ] **Step 5: Delete SeekerDashboard**

```bash
git rm src/ui/screens/SeekerDashboard.tsx
```

- [ ] **Step 6: Run the full frontend suite and build**

```bash
npx vitest run
npm run build
```

Expected: all tests pass; `npm run build` succeeds with no TypeScript errors.

- [ ] **Step 7: Format**

```bash
npm run format
```

- [ ] **Step 8: Commit**

```bash
git add src/types/app.ts src/data/navigation.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "feat(cv-rebuild): replace seeker dashboard with CV Rebuild screen"
```

---

### Task 10: Backend full-suite re-run + README polish

**Files:**
- Modify: `README.md` (if needed after Task 1)

- [ ] **Step 1: Run the entire backend test suite from `backend/`**

```bash
.venv\Scripts\python.exe -m pytest -q
```

Expected: all tests pass, including the new cv_rebuild tests.

- [ ] **Step 2: Verify no unexpected files were created in `backend/uploads/`**

```bash
git status --short backend/uploads
```

Expected: no new untracked files (the pipeline never writes to `uploads/`).

- [ ] **Step 3: Commit any remaining changes**

```bash
git add README.md
git commit -m "docs: document AI Rebuild CV setup"
```

(If nothing changed, skip the commit.)
