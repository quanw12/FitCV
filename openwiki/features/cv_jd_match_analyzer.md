---
type: Feature
title: CV & JD Match Analyzer
description: Feature that analyzes CVs against job descriptions using AI to compute match scores and provide evidence-based feedback.
tags: [feature, analyzer, cv, job description, matching]
---

# CV & JD Match Analyzer

The CV & JD Match Analyzer feature enables students to upload a CV and provide a job description (JD) to get a match score and detailed feedback on how well the CV matches the job requirements. It also powers the HR CV Ranking and Job Applicants features for recruiters.

## Overview

This feature provides:
- CV parsing and text extraction (from PDF/DOCX)
- JD parsing and text extraction
- AI-powered evidence extraction (when using Gemini) or deterministic parsing
- Weighted scoring based on four categories: Skills (45%), Experience (30%), Education (15%), Soft Skills (10%)
- Evidence-based matching that highlights strengths and weaknesses
- Reusable scoring engine used by:
  - Student-facing CV & JD Match Analyzer
  - HR CV Ranking (for screening external CV batches)
  - Job Applicants (for ranking students who applied to a published job)

The feature is designed to be source-grounded: the AI (Gemini) only extracts evidence, and the final scoring is done by a deterministic engine in FitCV, ensuring that unsupported evidence is not used.

## How It Works

### Processing Pipeline (Unified Scoring Engine)

Whether accessed via the Student Analyzer, HR CV Ranking, or Job Applicants, the flow converges on the same backend orchestrator:

```
Input (CV + JD)
        → Text Extraction (native text or OCR for scans)
        → Structured Parsing (local parser)
        → Optional: Gemini Evidence Extraction (if ANALYZER_PROVIDER=gemini)
        → Evidence Validation (Pydantic, source grounding)
        → Weighted Score Calculation (fixed rubric)
        → Output: match result with score, evidence_json, strengths, weaknesses, etc.
```

### Key Characteristics

- **Framework Version**: `fitcv-source-grounded-v2`
- **Fixed Weights**: Skills 45%, Experience 30%, Education 15%, Soft Skills 10%
- **Weight Normalization**: If a JD lacks information for a category, the remaining weights are scaled proportionally to sum to 100%.
- **Gemini Role**: When enabled, Gemini performs semantic extraction of skills, experience, education, and soft skills from the CV and JD, providing quotes from the source as evidence.
- **Source Grounding**: The local parser adds facts (e.g., contact-free text) to both the CV and JD semantic data, ensuring that LLM omissions do not remove verified source evidence.
- **Evidence JSON**: The `match_result.evidence_json` field records:
  - `matching_inputs`: The inputs used for matching
  - Engine metadata (algorithm/model version)
  - Rubric (weights used)
  - Eligibility state
  - Strengths and weaknesses
  - Category-level evidence (skills, experience, education, soft skills)
- **Improvement Suggestions**: The AI Improvement Suggestions feature uses the completed `match_result` and does not recompute the score.

### Scoring Details

For a published job, only these sections of the JD are used for scoring:
- Title
- About the job
- Responsibilities
- Requirements

Other sections (We Offer, Benefits, Life at company, Hiring Process, location, employment type, deadline, openings count) are kept for display/workflow but do not affect candidate fit.

Existing successful `match_result` rows retain their historical score. To recompute them with the current scoring engine (`fitcv-source-grounded-v2`), use the "Re-analyze/Retry Analysis" feature, which updates the stored algorithm/model version before processing.

## API Endpoints

The feature provides the following endpoints:

### CV Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cvs` | Upload a new CV (PDF/DOCX). |
| `GET` | `/api/cvs` | Get a list of the user's CVs. |
| `GET` | `/api/cvs/{cv_id}` | Get details of a specific CV. |
| `DELETE` | `/api/cvs/{cv_id}` | Delete a CV. |

### Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyzer/matches` | Analyze a CV against a JD (requires CV ID and JD text). Returns a match result ID. |
| `GET` | `/api/analyzer/matches/{match_result_id}` | Get the match result by ID (includes score, evidence, etc.). |

### HR CV Ranking (Upload CV Batch)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/hr/cv-ranking/parse` | Start parsing and scoring a batch of CVs against a JD (returns batch ID). |
| `GET` | `/api/hr/cv-ranking/batches` | List CV ranking batches for the user's company. |
| `GET` | `/api/hr/cv-ranking/batches/{batch_id}` | Get details of a specific batch (including status and results). |
| `PATCH` | `/api/hr/cv-ranking/batches/{batch_id}/selection` | Update manual selection of candidates in a batch. |
| `GET` | `/api/hr/cv-ranking/batches/{batch_id}/candidates/{candidate_id}/cv` | Download the CV file for a candidate in a batch. |
| `GET` | `/api/ai/tasks/{task_id}` | Get the status of an AI task (used for polling batch processing). |

### Job Applicants
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs/manage` | Get jobs managed by the user (HR/HiringManager/Admin). |
| `GET` | `/api/hr/cv-ranking/jobs/{job_id}/applications` | Get applications for a specific job (for ranking). |
| `GET` | `/api/hr/cv-ranking/jobs/{job_id}/cvs/archive` | Get archived CVs for a job (if applicable). |
| `GET` | `/api/applications/{application_id}/cv/download` | Download the CV for a specific application. |
| `POST` | `/api/applications/{application_id}/retry-analysis` | Trigger a re-analysis of an application's CV against the job's JD. |

## Usage Flow (Student - CV & JD Match Analyzer)

1. Log in as a Student.
2. Go to the **CV & JD Match Analyzer** page.
3. Upload a CV (PDF/DOCX) or select an existing one.
4. Paste a job description (minimum 50 characters).
5. Click **Analyze match**.
6. Wait for processing (the backend extracts text, optionally uses Gemini for evidence extraction, computes the score, and returns a match result).
7. View the match result:
   - Overall score (0-100%)
   - Breakdown by category (Skills, Experience, Education, Soft Skills)
   - Evidence found for each category (with source quotes)
   - Strengths and weaknesses
8. Optionally, click **Get improvement suggestions** to generate an AI Improvement Suggestions report (see related documentation).

## Usage Flow (HR - CV Ranking / Upload CV Batch)

1. Log in as HR, HiringManager, or Admin.
2. Go to the **HR CV Ranking** or **Upload CV Batch** section.
3. Enter a job description or screening criteria (minimum 50 characters).
4. Upload 1-20 CV files (PDF/DOCX, max 10 MB each).
5. Click **Parse** (or equivalent) to start processing.
6. The backend returns a batch ID; the frontend polls `/api/ai/tasks/{task_id}` for status.
7. When processing completes (`Completed`, `Partial`, or `Failed`):
   - View the ranked list of candidates.
   - See matched/missing evidence for each candidate.
   - Manually select candidates or use a score threshold to shortlist.
   - Download individual CVs or a ZIP of all CVs in the batch.

## Usage Flow (HR - Job Applicants)

1. Log in as HR, HiringManager, or Admin.
2. Go to the **Job Applicants** section for a specific job.
3. View the list of students who have applied to the job.
4. For each applicant, see:
   - Their CV (downloadable)
   - The match score and evidence (computed when they applied or can be re-run)
5. Optionally, trigger a re-analysis for an applicant via `POST /api/applications/{application_id}/retry-analysis`.
6. Manually select applicants or use a score threshold to shortlist.

## Configuration

The feature is configured in `backend/.env`:

### Analyzer Provider
```env
# Deterministic (default, no external AI calls)
ANALYZER_PROVIDER=deterministic

# Gemini (requires API key)
ANALYZER_PROVIDER=gemini
GEMINI_API_KEY=<your-secret-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
GEMINI_STRUCTURED_THINKING_LEVEL=low
GEMINI_STRUCTURED_OUTPUT_TOKENS=24000
GEMINI_TIMEOUT_SECONDS=90
GEMINI_MAX_RETRIES=2
```

> **Note**: To enable Gemini for the Analyzer, you must also run the migration `database/migrations/003_add_cv_jd_analyzer.sql` (if not already present) and restart the backend.

### OCR for Scanned PDFs
If you want to enable OCR for scanned PDFs (used in CV parsing), add:
```env
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
OCR_PROVIDER=gemini
OCR_TIMEOUT_SECONDS=120
OCR_MAX_OUTPUT_TOKENS=20000
```
> **Note**: Leave `OCR_MODEL` empty to use the same model as `GEMINI_MODEL`. Set `OCR_PROVIDER=disabled` to skip OCR.

## Database Migrations

The following migrations are required for this feature:
- `database/migrations/003_add_cv_jd_analyzer.sql` - Adds tables for CV, JD, and match results.
- `database/migrations/004_reconcile_improvement_runtime.sql` - Can be run to backfill data for the improvement runtime (optional but recommended if missing columns).

> **Note**: If creating a new database from `database/full_schema.sql`, these tables are already included.

## Focused Tests

- **Unit Tests**: Likely include tests for CV upload, match generation, scoring logic, and evidence validation.
- **Integration Tests**: May test the full flow from CV upload to match result.
- **Live Analyzer Tests**: There is a live test that uses real Gemini API and a test database (requires rotating credentials and running migration 004 first):
  ```bash
  cd backend
  $env:FITCV_RUN_RAILWAY_E2E="1"
  python -m pytest tests/test_live_analyzer_improvement.py -q -s
  Remove-Item Env:FITCV_RUN_RAILWAY_E2E
  ```
  > **Warning**: This test uses real API quota and modifies a test database.

## Validation Commands

- **Endpoint Test**: After setting up the backend and frontend, test the Analyzer endpoint (requires auth):
  ```bash
  # Replace <access_token> with a valid Student token
  curl -X POST 'http://127.0.0.1:8000/api/analyzer/matches' \
    -H "Authorization: Bearer <access_token>" \
    -H "Content-Type: application/json" \
    -d '{"cv_id": "<cv_id>", "job_description": "Software Engineer with 3 years of experience in Python and Django."}'
  ```
  > First, you need a CV ID (obtained by uploading a CV via `/api/cvs`).

- **Batch Processing Test**: Test the HR CV Ranking batch endpoint (requires HR role):
  ```bash
  # Replace <access_token> with a valid HR token
  curl -X POST 'http://127.0.0.1:8000/api/hr/cv-ranking/parse' \
    -H "Authorization: Bearer <access_token>" \
    -F "job_description=Software Engineer with 3 years of experience in Python and Django." \
    -F "files=@/path/to/cv1.pdf" \
    -F "files=@/path/to/cv2.pdf"
  ```
  > Returns a batch ID; then poll `/api/ai/tasks/{task_id}` for status.

## Change Navigation

When making changes related to the CV & JD Match Analyzer:

1. **Endpoint Changes**: Edit files in `backend/app/api/` (e.g., `cvs.py`, `analyzer.py`, `hr/cv_ranking.py`) and update the service layer.
2. **Scoring Engine**: Edit the core match engine logic (likely in `backend/app/services/match_engine.py`).
3. **Evidence Extraction**: If modifying what data is extracted from CV/JD, update the Gemini prompt and response handling in the service.
4. **Database Model**: If changing CV, JD, or match result-related tables, edit models in `backend/app/models/` and create a migration.
5. **Schema**: Update Pydantic schemas in `backend/app/schemas/` for CV, analyzer, and HR CV ranking if request/response structure changes.
6. **OCR Configuration**: If modifying OCR behavior, update the environment variables and related service code.
7. **AI Provider Switching**: If changing how the analyzer provider is selected, update the configuration logic and service instantiation.

Always verify changes by:
- Running the backend test suite: `python -m pytest tests -q` (after installing requirements-dev.txt).
- Testing the feature end-to-end for students (upload CV, add JD, analyze, view results).
- Testing the HR CV Ranking flow (upload batch, parse, view results, select candidates).
- Testing the Job Applicants flow (view applicants, see scores, retry analysis).
- Checking that the scoring weights are applied correctly and normalized when JD categories are missing.
- Ensuring that the feature still requires authentication and that users can only access their own data (where appropriate).
- Verifying that the Gemini integration (if enabled) still works and that the evidence is properly validated.