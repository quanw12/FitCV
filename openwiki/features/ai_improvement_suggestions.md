---
type: Feature
title: AI Improvement Suggestions
description: Feature that generates AI-powered suggestions for improving CVs based on job description analysis.
tags: [feature, ai, improvement, suggestions]
---

# AI Improvement Suggestions

The AI Improvement Suggestions feature generates personalized recommendations for improving a CV based on its match with a specific job description (JD). This helps students/job seekers understand how to better align their CV with job requirements.

## Overview

When a student analyzes a CV against a JD using the CV & JD Match Analyzer, they can request an improvement report that provides actionable feedback on how to enhance their CV to better match the job requirements.

## How It Works

1. **Prerequisite**: The CV & JD Match Analyzer must have successfully processed a CV and JD pair, producing a `match_result_id`.
2. **Request Generation**: The frontend calls `POST /api/match-results/{match_result_id}/improvement-report/generate` to request an improvement report.
3. **Backend Processing**:
   - The backend uses the completed match result (which includes parsed CV and JD data, evidence, and scoring).
   - It sends a prompt to Google Gemini (configured via `backend/.env`) to generate improvement suggestions based on the match analysis.
   - Gemini returns structured feedback (strengths, weaknesses, specific suggestions).
   - The backend stores and returns this report.
4. **Frontend Display**: The frontend retrieves and displays the report via `GET /api/match-results/{match_result_id}/improvement-report`.

## Key Characteristics

- **Always Uses Real Backend**: The feature relies entirely on backend processing and real Gemini API calls; there are no frontend mocks or hard-coded results.
- **Source-Grounded**: Suggestions are based on evidence extracted from the actual CV and JD documents.
- **Structured Output**: Uses Pydantic validation to ensure Gemini's response conforms to the expected schema.
- **Safe Failure**: If Gemini returns output that doesn't match the schema or includes evidence not found in the source documents, the request fails safely.

## Configuration

The feature is configured in `backend/.env`:

```env
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
```

> **Note**: The same Gemini configuration is used for the Analyzer, AI Rebuild CV, and OCR features.

## API Endpoints

- **Generate Report**:
  ```http
  POST /api/match-results/{match_result_id}/improvement-report/generate
  ```
  - Requires authentication (Student role).
  - Triggers the generation of an improvement report for the given match result.
  - Returns `202 Accepted` if processing starts asynchronously (or immediate if synchronous).

- **Get Report**:
  ```http
  GET /api/match-results/{match_result_id}/improvement-report
  ```
  - Requires authentication (Student role, and the match result must belong to the user).
  - Returns the generated improvement report or indicates if it's still processing.

## Improvement Report Content

The report typically includes:
- **Strengths**: Areas where the CV strongly matches the JD.
- **Weaknesses**: Areas where the CV lacks evidence or falls short of JD requirements.
- **Specific Suggestions**: Actionable advice on how to improve the CV (e.g., "Add more details about your experience with X", "Include measurable results for Y").
- **Evidence-Based**: All suggestions are tied to evidence found in the original CV or JD.

## Usage Flow (Student)

1. Log in as a Student.
2. Go to the **CV & JD Match Analyzer** page.
3. Upload a CV (PDF/DOCX) and paste a job description (minimum 50 characters).
4. Click **Analyze match**.
5. Once analysis completes, click **Get improvement suggestions** (or similar button).
6. Wait for the report to generate (may take a moment).
7. View the improvement report with strengths, weaknesses, and suggestions.

## Important Notes

- The feature **does not** automatically accept or reject applicants; it purely provides guidance.
- The backend **does not** send the CV, JD, or API key to the frontend; all processing happens server-side.
- To use this feature, the `GEMINI_API_KEY` must be set in `backend/.env` and the backend must be restarted after changing the configuration.
- In development, if you encounter `Analyzer backend is not configured`, ensure `VITE_API_BASE_URL` is set correctly in `.env.local` and restart the frontend.

## Focused Tests

- **Live Analyzer Improvement Tests**: There is a live test that uses real Gemini API and a test database (requires rotating credentials and running migration 004 first):
  ```bash
  cd backend
  $env:FITCV_RUN_RAILWAY_E2E="1"
  python -m pytest tests/test_live_analyzer_improvement.py -q -s
  Remove-Item Env:FITCV_RUN_RAILWAY_E2E
  ```
  > **Warning**: This test uses real API quota and modifies a test database.

- **Unit Tests**: Likely include tests for the improvement report generation endpoint, service functions, and validation of Gemini responses.

## Validation Commands

- **Endpoint Availability**: After setting up the backend and frontend, you can test the endpoint by:
  1. Creating a match result via the Analyzer.
  2. Calling the generate endpoint with the returned `match_result_id`.
  3. Polling the get endpoint until the report is ready.

- **Backend Health**: Ensure the backend is running and the health check passes: `GET /api/health`.

## Change Navigation

When making changes related to AI Improvement Suggestions:

1. **Endpoint Changes**: Modify `backend/app/api/match_results.py` (or similar) and update the service layer.
2. **Service Logic**: Edit the service responsible for calling Gemini and processing the response (likely in `backend/app/services/`).
3. **Prompt Engineering**: If changing the prompt sent to Gemini, update the relevant service code.
4. **Response Handling**: If modifying the expected response structure, update Pydantic schemas and validation logic.
5. **Configuration**: If adding new environment variables, update `backend/.env` documentation and ensure they are loaded correctly.
6. **Frontend Calls**: If the API contract changes, update the frontend service calls in `src/api/` or `src/services/`.

Always verify changes by:
- Running the backend test suite (especially live tests if modifying Gemini integration).
- Manually testing the feature end-to-end (upload CV, add JD, analyze, get suggestions).
- Checking that error cases (invalid match result, missing Gemini config) are handled appropriately.
- Ensuring that the feature still requires authentication and that users can only access their own match results.