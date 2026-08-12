---
type: Feature
title: Job Post Management API
description: API endpoints for managing job postings, including creation, publishing, archiving, and scoring configuration.
tags: [feature, api, job, management]
---

# Job Post Management API

The Job Post Management API provides endpoints for HR, HiringManager, and Admin roles to create, manage, and configure job postings in the FitCV platform.

## Overview

This API allows authorized users to:
- Create new job postings
- Extract job details from text using AI (Gemini)
- Publish, close, archive, and unarchive jobs
- Configure custom scoring weights for CV matching
- Retrieve public job listings (no authentication required for public endpoints)

Access to these endpoints requires the user to have the role `HR`, `HiringManager`, or `Admin`. Additionally, users can only manage jobs that belong to their own company (identified by `company_id` in their account).

## Key Features

### Job Lifecycle
Jobs can be in one of several recruitment statuses: `Draft`, `Published`, `Closed`. Archiving a job does not change its recruitment status but hides it from public listings.

### AI-Assisted Job Creation
The `/api/jobs/extract` endpoint uses Google Gemini to parse a job description and suggest a structured job posting draft, which the user can then review and save.

### Custom Scoring Weights
When creating or updating a job, users can specify custom weights for the four scoring categories:
- Skills (default: 45%)
- Experience (default: 30%)
- Education (default: 15%)
- Soft Skills (default: 10%)

The weights must be integers between 0 and 100 and must sum to 100. If a job description lacks information for a category, the weights are redistributed proportionally among the remaining categories during scoring.

### Archiving
Archiving a job (`POST /api/jobs/{job_id}/archive`) hides it from:
- Public job list (`GET /api/jobs/public`)
- Public job detail (`GET /api/jobs/public/{job_id}`)
- Receiving new applications

However, archived jobs remain accessible via the management endpoints for the owning company and retain their applications and data.

## API Endpoints

All endpoints requiring authentication are prefixed with `/api/jobs` and require the user to be logged in with an appropriate role.

### Management Endpoints (Require HR/HiringManager/Admin role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs/manage?archived=false` | Retrieve a paginated list of jobs for the user's company. Use `archived=true` to see archived jobs, or omit to see only non-archived. |
| `GET` | `/api/jobs/public` | Retrieve a list of published, non-archived jobs that are not past their deadline. No authentication required. |
| `GET` | `/api/jobs/public/{job_id}` | Retrieve details of a specific published, non-archived job that is not past its deadline. No authentication required. |
| `POST` | `/api/jobs/extract` | Use Gemini to extract a job draft from raw text (minimum 50 characters). Returns a suggested job structure for review. Does not save the job. Requires management role. |
| `POST` | `/api/jobs` | Create a new job posting. Accepts optional custom scoring weights. |
| `PATCH` | `/api/jobs/{job_id}` | Update an existing job posting. Can update fields including custom scoring weights. |
| `POST` | `/api/jobs/{job_id}/publish` | Change a job's recruitment status from `Draft` to `Published`. |
| `POST` | `/api/jobs/{job_id}/close` | Change a job's recruitment status to `Closed` (stops accepting new applications but remains visible if not archived). |
| `POST` | `/api/jobs/{job_id}/archive` | Archive a job (hides it from public listings but does not change recruitment status). |
| `POST` | `/api/jobs/{job_id}/unarchive` | Unarchive a job (makes it visible in public listings again if recruitment status is `Published` and not past deadline). |

### Important Notes on Endpoints

- The `extract` endpoint uses server-side Gemini AI and does not save the job; it returns a draft for the user to review and then save via the `POST /api/jobs` endpoint.
- When creating or updating a job, if custom scoring weights are provided, they are validated to ensure they are between 0-100 and sum to 100.
- The public endpoints (`/api/jobs/public` and `/api/jobs/public/{job_id}`) only return jobs that are:
  - Recruitment status: `Published`
  - Not archived (`archived_at` is NULL)
  - Not past the deadline (if a deadline is set)

## Usage Flow (HR/HiringManager/Admin)

1. **Create a Job Draft**:
   - Option 1: Call `POST /api/jobs/extract` with raw job description text to get an AI-suggested draft.
   - Option 2: Directly call `POST /api/jobs` with the job details.

2. **Review and Save** (if using extract):
   - Review the suggested draft from the extract endpoint.
   - Adjust as needed, then call `POST /api/jobs` to save the job.

3. **Publish**:
   - Once the job is ready, call `POST /api/jobs/{job_id}/publish` to change its status to `Published`.

4. **Manage Applications**:
   - Use the HR CV Ranking features (see related documentation) to review and rank applicants.

5. **Update or Close**:
   - Update the job details at any time with `PATCH /api/jobs/{job_id}`.
   - To stop accepting applications but keep the job visible, use `POST /api/jobs/{job_id}/close`.
   - To hide the job from public listings (while keeping applications accessible), use `POST /api/jobs/{job_id}/archive`.

6. **Archiving and Unarchiving**:
   - Archive a job when you no longer want it to receive applications or appear in public searches.
   - Unarchive later if you wish to make it active again (provided it's still within the deadline and status is `Published`).

## Configuration

The feature relies on the following backend configuration in `backend/.env`:
- `GOOGLE_CLIENT_ID`: For Google OAuth (used in authentication, but the extract endpoint uses Gemini AI which requires `GEMINI_API_KEY`).
- `GEMINI_API_KEY`, `GEMINI_MODEL`, etc.: For the `/api/jobs/extract` endpoint to function.

> **Note**: The `/api/jobs/extract` endpoint requires the Gemini AI configuration to be set in `backend/.env` and the backend to be restarted after changes.

## Focused Tests

- **Unit Tests**: Likely include tests for each endpoint, covering validation, role-based access, and business logic.
- **Integration Tests**: May test the full job lifecycle from creation to archiving.

## Validation Commands

- **Endpoint Availability**: After setting up the backend, you can test the public endpoint (no auth required):
  ```bash
  curl -X GET 'http://127.0.0.1:8000/api/jobs/public'
  ```
  Should return an empty list or list of published jobs.

- **Management Endpoint Test** (requires auth):
  1. Log in as an HR, HiringManager, or Admin user to get an access token.
  2. Test the manage endpoint:
     ```bash
     curl -X GET 'http://127.0.0.1:8000/api/jobs/manage' \
       -H "Authorization: Bearer <access_token>"
     ```

## Change Navigation

When making changes related to Job Post Management:

1. **Endpoint Changes**: Edit `backend/app/api/jobs.py` (or similar) and update the service layer.
2. **Business Logic**: Edit the service responsible for job operations (likely in `backend/app/services/`).
3. **AI Extraction**: If modifying the `/api/jobs/extract` endpoint, update the Gemini prompt and response handling.
4. **Validation**: If changing weight validation or job field rules, update the validation in the endpoint or service.
5. **Database Model**: If adding or changing job-related fields, edit `backend/app/models/job.py` and create a migration.
6. **Schema**: Update Pydantic schemas in `backend/app/schemas/job.py` if request/response structure changes.
7. **Role Access**: Ensure that any changes maintain the role-based access control (HR/HiringManager/Admin only) and company scoping.

Always verify changes by:
- Running the backend test suite: `python -m pytest tests -q` (after installing requirements-dev.txt).
- Testing the endpoints manually with appropriate roles.
- Verifying that custom scoring weights are validated correctly (sum to 100, each 0-100).
- Checking that archiving hides jobs from public endpoints but not management endpoints.
- Ensuring that the AI extraction endpoint still functions correctly after changes (if modified).
- Confirming that unauthorized users (e.g., Students) cannot access management endpoints.