# AI Rebuild CV — Design

Date: 2026-07-31
Status: Approved for planning

## Goal

Add an "AI Rebuild CV" feature to FitCV. A user uploads a CV (PDF/DOCX); the
backend extracts text, sends it to Gemini for structured extraction + professional
rewrite, validates the output with Pydantic, renders it into a fixed Jinja2 HTML
template, converts to PDF with Playwright (headless Chromium), generates a
first-page thumbnail, and returns everything in one synchronous response.

The pipeline is fully **stateless**: no database reads/writes, no long-lived
file storage. Temp files live in a `TemporaryDirectory` that is always cleaned
up.

## Context

- A previous `cv_build` implementation existed in git history (TeX compilation,
  DB-backed background jobs, polling API) but its source was removed from the
  working tree. This feature replaces it with the stateless approach.
- Existing infra to reuse: `GeminiClient.generate_structured` (JSON-schema
  constrained output), `document_parser.validate_cv_content` +
  `extract_document_text` (pypdf, python-docx, Gemini OCR fallback for scanned
  PDFs), JWT guard in `app/api/deps.py`.
- New backend dependencies: `jinja2`, `playwright` (+ `playwright install
  chromium`), `pillow`. No OCR-only path: existing fallback covers scans.

## Scope decisions (confirmed with user)

- Frontend: the Seeker "Dashboard" nav item is replaced by a "CV Rebuild"
  screen (`CVReBuildScreen.tsx`). `SeekerDashboard` content is removed.
- Auth: `POST /cv/rebuild` requires JWT (`get_current_account`). No DB use.
- LLM: **single** Gemini call (extract + polish in one structured response).
- Template: English headings, content kept in source language.
- Renderer: Playwright for Python (not Puppeteer).

## Endpoint contract

`POST /api/cv/rebuild` — multipart form, `file: UploadFile` (required).

Validation (reuses `document_parser.validate_cv_content`):
- PDF/DOCX only, max 10 MB, magic-byte/DOCX-ZIP check.
- Empty file → 400.

Response `200` (synchronous):

```json
{
  "filename": "rebuilt_cv.pdf",
  "preview_json": { "name": "Nguyen Van A", "email": "a@example.com", "phone": "+84 912 345 678",
                    "summary": "...",
                    "experience": [{"title": "Software Engineer", "company": "Acme", "date": "2020-2023", "bullets": ["..."]}],
                    "skills": ["Python", "FastAPI"], "projects": [{"name": "FitCV", "description": "..."}],
                    "certifications": ["AWS Certified"], "education": [{"degree": "BSc", "institution": "HCMUS", "date": "2016-2020"}] },
  "pdf_base64": "...",
  "thumbnail_base64": "..."
}
```

Errors:
- 400 invalid file / unreadable text / LLM output invalid after retries.
- 502 Gemini unavailable.
- Error details are user-readable strings; never a silent fallback to fake data.

## CVData schema (Pydantic, `backend/app/schemas/cv_rebuild.py`)

```python
class CvExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    date: str = ""
    bullets: list[str] = []

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
    experience: list[CvExperienceItem] = []
    skills: list[str] = []
    projects: list[CvProjectItem] = []
    certifications: list[str] = []
    education: list[CvEducationItem] = []
```

Only `name` is required by the LLM prompt; every field defaults to empty, never
to fabricated placeholder values. LLM instructions forbid inventing facts.

## LLM step

One Gemini call (`responseMimeType: application/json` +
`responseJsonSchema` from `gemini_client.py`) with prompt rules:

- Extract only facts present in the source text; keep numbers, dates, titles
  verbatim. Do not infer or invent.
- Rewrite summary and bullet points to be professional, concise, grammatically
  correct, and stylistically consistent — without changing meaning and without
  adding skills/experience/numbers absent from the extracted data.
- Output must match the CVData JSON schema exactly (empty strings / empty
  arrays where absent).

Validation & retry:
1. Parse LLM text → JSON → `CVData.model_validate` (tolerate missing fields;
   reject wrong types).
2. On `ValidationError`, retry up to **2** times, appending the Pydantic error
   message to the prompt.
3. After 3 total attempts fail, raise a clear error (HTTP 422) — no fallback.

## HTML template (Jinja2, `backend/app/templates/cv_template.html`)

- Fixed layout, styled with CSS custom properties (`--accent`, `--text`,
  `--muted`, etc.) in an inline `<style>` block (single file, self-contained).
- Sections: Header (name/contact), Summary, Experience, Projects, Skills,
  Certifications, Education — each wrapped in `{% if ... %}` so a heading
  (and its whole section) is omitted when the field/list is empty.
- `page-break-inside: avoid` on experience/project/education items to prevent
  mid-item breaks; `@page { size: A4; margin: ... }` for print/PDF.
- Template receives the validated `CVData` model; rendering happens in
  `template_renderer.py` with a cached `Jinja2Templates`-style environment.

## PDF + thumbnail (`backend/app/services/cv_rebuild/pdf_renderer.py`)

- Use Playwright sync API inside the async route via `run_in_executor` (or a
  dedicated thread) so the event loop is not blocked.
- Load the rendered HTML via `set_content` (no file:// or network fetch).
- `page.pdf(...)` → PDF bytes in memory (format A4, margins matching template).
- Screenshot: same page, viewport sized to A4 at 96 dpi (≈794×1123 px),
  `full_page=False` captures page 1; resize to width 300 px (≈424 px tall, A4
  ratio) with Pillow, save as JPEG quality ~80 → bytes → base64.
- Browser lifecycle: launch once per process (module-level lazy singleton),
  context/page per request, always closed; installs are documented in README.

## Orchestrator (`backend/app/services/cv_rebuild/orchestrator.py`)

`rebuild_cv(file_bytes, filename) -> CvRebuildResponse`:

1. `validate_cv_content` + `extract_document_text` (writes upload to
   `TemporaryDirectory`; text-only path avoids persisting the file).
2. Single Gemini call (prompts.py) → Pydantic retry loop.
3. `template_renderer.render(cv)` → HTML string.
4. `pdf_renderer.render(html)` → `(pdf_bytes, thumbnail_bytes)`.
5. Build response; `finally` ensures temp cleanup.

The route (`backend/app/api/routes/cv_rebuild.py`) is thin: read upload,
validate presence/size, call orchestrator, map exceptions to HTTP responses.
Registered in `main.py` at prefix `/api/cv`, tags `["cv-rebuild"]`. No DB
session is ever created.

## Frontend

### Types + API (`src/types/cvRebuild.ts`, `src/api/cvRebuildApi.ts`)

- `CvRebuildResponse` mirrors the backend JSON (base64 strings).
- `rebuildCv(file)` posts multipart with JWT header via existing `httpClient`
  pattern; helpers `pdfBase64ToBlob`, `thumbnailDataUrl`.

### Screen (`src/ui/screens/CVReBuildScreen.tsx`)

- Replaces SeekerDashboard: nav item label "CV Rebuild", icon `FileText`-like
  (phosphor icon per current nav style). New screen id `cv-rebuild` added to
  `ScreenId` in `src/types/app.ts`; `defaultScreen` in `App.tsx` returns
  `cv-rebuild` for the seeker portal (replacing `seeker-dashboard`).
- Flow:
  1. Upload dropzone (PDF/DOCX, ≤10 MB client-side check).
  2. On submit → skeleton/loading placeholder (animated card) while the
     pipeline runs (LLM + render takes seconds).
  3. Result card shows thumbnail image (from `thumbnail_base64`).
  4. Click thumbnail → modal with PDF viewer: `<iframe src=data:application/pdf;base64,...>` (browser built-in viewer; no PDF.js dependency, no page navigation).
  5. Modal "Download PDF" button → anchor with `download` + Blob URL built from
     the already-returned `pdf_base64` (no second API call).
- Errors shown inline (toast + inline message); error retry allowed.

## Testing (`backend/tests/test_cv_rebuild.py`)

1. **Parse errors**: invalid extension, fake PDF bytes, corrupt DOCX,
   empty file → clear ValueError/400 messages.
2. **Pydantic rejection**: `CVData.model_validate` rejects wrong types
   (e.g. `skills` as string, `experience` missing `bullets` type); retry loop
   count and error-message propagation verified with a fake LLM client.
3. **Template rendering**: empty CV omits all section headings; partial CV
   renders only present sections; `page-break-inside: avoid` present in output.
4. **No side effects**: orchestrator monkeypatched with fake LLM + fake renderer
   leaves no files in `settings.upload_dir` and never touches a DB session;
   `TemporaryDirectory` contents cleaned after run.

Frontend tests (existing vitest setup): thumbnail card renders, modal opens,
Download button triggers a download from cached base64 (no second fetch).

## Dependencies to add

- `backend/requirements.txt`: `jinja2`, `playwright`, `pillow`.
- README: `pip install -r requirements.txt` + `playwright install chromium`.
- No new npm packages (iframe PDF viewer).

## Out of scope

- OCR-only path for scans (existing Gemini OCR fallback covers it).
- Persisting rebuilt CVs, history, or download endpoints.
- PDF.js embedding, text-layer search inside the viewer.
- HR portal usage.
