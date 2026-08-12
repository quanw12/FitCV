---
type: Architecture
title: Backend Architecture
description: FastAPI backend structure, setup, and development guidelines for the FitCV application.
tags: [backend, fastapi, architecture]
---

# Backend Architecture

FitCV's backend is built with FastAPI, SQLAlchemy, and MySQL. This document outlines the backend structure, setup procedures, and development guidelines.

## Technology Stack

- **Framework**: FastAPI
- **ORM**: SQLAlchemy
- **Database**: MySQL
- **Authentication**: JWT-based with refresh tokens in HttpOnly cookies
- **AI Integration**: Google Gemini API (for CV analysis, improvement suggestions, OCR, etc.)
- **Email Service**: Resend (for transactional emails)
- **Background Workers**: For AI processing tasks
- **PDF Generation**: Headless Chromium (Playwright) for AI Rebuild CV feature
- **Language**: Python 3.11+

## File Organization

Backend code must reside in the `backend/` directory with the following structure:

```
backend/
├── app/
│   ├── api/          # API route definitions
│   ├── core/         # Core configuration and utilities
│   ├── db/           # Database connection and session management
│   ├── models/       # SQLAlchemy database models
│   ├── repositories/ # Data access layer
│   ├── schemas/      # Pydantic schemas for request/validation
│   ├── services/     # Business logic and orchestration
│   └── middleware/   # Custom middleware
├── worker/           # Background worker for AI tasks
├── requirements.txt  # Python dependencies
�└── .env              # Environment variables (not committed)
```

### Layer Responsibilities

- **backend/app/api**: Contains FastAPI route definitions and endpoint handlers
  - **auth.py**: Authentication endpoints (register, login, Google OAuth, password reset, etc.)
  - **jobs.py**: Job CRUD operations and management
  - **applications.py**: Application submission and management
  - **pipeline.py**: Recruitment pipeline stage management
  - **job_search.py**: Job search and filtering functionality (integrates with freehire.me and LinkedIn APIs)
  - **analyzer.py**: CV upload, parsing, and analysis endpoints
  - **cv_rebuild.py**: CV regeneration and improvement application
  - **cv_ranking.py**: Ranking CVs against jobs
  - **improvements.py**: CV improvement suggestion management
  - **ai_tasks.py**: Manage background AI operations
  - **email_workflow.py**: Email workflow management
  - **reports.py**: Reporting and analytics endpoints
  - **profile.py**: User profile management
- **backend/app/core**: Configuration, security settings, and utility functions
- **backend/app/db**: Database engine setup, session management, and connection handling
- **backend/app/models**: SQLAlchemy ORM models representing database tables
- **backend/app/repositories**: Data access layer that abstracts database operations
- **backend/app/schemas**: Pydantic models for request validation and response serialization
- **backend/app/services**: Business logic that orchestrates data access, external API calls, and workflows
  - **analyzer_service.py**: Orchestrates CV processing workflow
  - **match_engine.py**: Core matching algorithm implementation
  - **matching_service.py**: High-level matching operations
  - **document_parser.py**: Text extraction from PDF/DOCX
  - **cv_rebuild/**: CV regeneration and improvement application (includes modules for avatar, completeness, grounding, improvement applier, language, LLM extraction, normalization, orchestration, PDF rendering, prompts, and template rendering)
  - **gemini_analyzer.py**: AI-powered CV analysis using Google Gemini
  - **improvement_service.py**: Generates and manages improvement suggestions
  - **improvement_enricher.py**: Enriches CV improvement suggestions with job market data
  - **improvement_provider.py**: Provides improvement suggestion generation workflow
  - **ocr_service.py**: Optical character recognition for scanned documents
  - **freehire_job_search.py**: External job search integration (freehire.me aggregator)
  - **linkedin_job_search.py**: LinkedIn job scraping
  - **job_extraction_service.py**: Extracts job details from text
  - **ai_worker.py**: Background worker for AI-intensive tasks
  - **auth_service.py**: Business logic for authentication operations
  - **email_service.py**: Sends verification codes and notifications
  - **jobs_service.py**: Business logic for job operations
  - **application_service.py**: Application processing logic
  - **pipeline_service.py**: Pipeline stage management
- **backend/app/middleware**: Custom middleware for logging, error handling, etc.
- **backend/worker**: Background worker processes for AI-intensive tasks (CV analysis, improvement suggestions, etc.)

## Setup Instructions

### Prerequisites

- Python 3.11+ recommended
- MySQL server
- npm (for frontend, but backend setup is Python-only)
- Git

### Installation

1. From the repository root, navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   - Windows PowerShell:
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - bash/zsh:
     ```bash
     source .venv/bin/activate
     ```

4. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Install headless Chromium for AI Rebuild CV feature:
   ```bash
   .venv\Scripts\python.exe -m playwright install chromium
   ```

6. Create or update `backend/.env` with the following variables:
   ```env
   ENVIRONMENT=dev
   DATABASE_URL=mysql+pymysql://<db_user>:<url_encoded_password>@<db_host>:3306/fitcv
   JWT_SECRET_KEY=<local-secret>
   ACCESS_TOKEN_EXPIRE_MINUTES=15
   REFRESH_TOKEN_EXPIRE_DAYS=30
   SESSION_IDLE_TIMEOUT_MINUTES=60
   REFRESH_COOKIE_SECURE=false
   GOOGLE_CLIENT_ID=<google-oauth-client-id>
   CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","https://fit-cv.vercel.app"]
   RESEND_API_KEY=
   RESEND_FROM_EMAIL=
   AVATAR_STORAGE=local
   BACKEND_PUBLIC_URL=http://127.0.0.1:8000
   ANALYZER_PROVIDER=deterministic
   GEMINI_API_KEY=<google-ai-studio-api-key>
   GEMINI_MODEL=gemini-3.6-flash
   GEMINI_THINKING_LEVEL=high
   GEMINI_STRUCTURED_THINKING_LEVEL=low
   GEMINI_STRUCTURED_OUTPUT_TOKENS=24000
   AI_WORKER_ENABLED=true
   ```

   > **Note**: For production on Render, set `ENVIRONMENT=prod` and `REFRESH_COOKIE_SECURE=true`, and ensure `JWT_SECRET_KEY` is a random value of at least 32 characters.

### Running the Backend

Start the backend server:
```bash
python app/main.py
```

The backend runs at:
```
http://127.0.0.1:8000
```

Health check endpoint:
```
http://127.0.0.1:8000/api/health
```

### Background Worker

To run the AI worker as a separate process (recommended for production to avoid blocking the web server):
```bash
python -m app.worker
```

Then set `AI_WORKER_ENABLED=false` in the web service environment to prevent duplicate workers.

#### Worker Environment Variables

```env
AI_WORKER_ENABLED=true
AI_WORKER_POLL_SECONDS=1
AI_WORKER_LEASE_SECONDS=1800
AI_WORKER_HEARTBEAT_SECONDS=30
AI_TASK_MAX_ATTEMPTS=3
```

## Database Setup

### Schema

The main schema is located at:
```
database/full_schema.sql
```

To set up a new database:
1. Create database `fitcv`
2. Run `database/full_schema.sql` with a MySQL user that has permission to create tables/indexes
3. The backend runtime user needs `SELECT`, `INSERT`, `UPDATE`, `DELETE` permissions

### Migrations

The project uses SQL migration files located in `database/migrations/`. Important migrations include:

- `003_add_cv_jd_analyzer.sql` - Adds tables for CV/JD matching
- `004_add_application_tracker.sql` - Adds application tracker tables
- `005_add_job_archiving_and_scoring.sql` - Adds job archiving and custom scoring
- `006_add_recruiter_pipeline.sql` - Adds recruiter pipeline notes and history
- `007_add_candidate_email_workflow.sql` - Adds candidate email tracking
- `008_add_application_notifications.sql` - Adds application notifications
- `009_add_smart_reply_workflow.sql` - Adds smart reply email functionality
- `010_add_platform_hardening.sql` - Adds platform hardening tables (hr_screening_batch, etc.)
- `011_add_reliable_email_delivery.sql` - Adds email retry mechanism
- `012_add_email_campaigns.sql` - Adds email campaign functionality
- `013_add_ai_task_attempt_history.sql` - Adds AI task attempt history (runs after 010)

> **Important**: Migration 013 must run after migration 010 because it creates `ai_task_attempt_history` which references `ai_task`.

## Important Symbols and Entry Points

- **Main Entry Point**: `backend/app/main.py` - FastAPI application creation and middleware setup
- **API Routes**: Defined in `backend/app/api/` directory (e.g., `auth.py`, `jobs.py`, `applications.py`)
- **Database Models**: `backend/app/models/` directory (e.g., `account.py`, `job.py`, `cv.py`)
- **Services**: `backend/app/services/` directory contains business logic (e.g., `match_engine.py`, `auth_service.py`)
- **Background Worker**: `backend/app/worker.py` or `backend/worker/` directory

## Focused Tests

- **Backend Tests**: Run with:
  ```bash
  cd backend
  pip install -r requirements-dev.txt
  python -m pytest tests -q
  ```

- **Live Analyzer Tests**: For Gemini integration tests (requires real API key and quota):
  ```bash
  cd backend
  $env:FITCV_RUN_RAILWAY_E2E="1"
  python -m pytest tests/test_live_analyzer_improvement.py -q -s
  Remove-Item Env:FITCV_RUN_RAILWAY_E2E
  ```

## Validation Commands

- **Import Check**: 
  ```bash
  cd backend
  python -c "from app.main import app; print('BACKEND_IMPORT_OK')"
  ```

- **Health Check Endpoint**: `GET /api/health` - validates backend is running and connected to database

- **Database Connection**: Verify by checking health endpoint or running a simple query

## Change Navigation

When making backend changes:

1. **API Endpoint Changes**: Edit files in `backend/app/api/` and update corresponding service functions
2. **Database Model Changes**: Edit files in `backend/app/models/` and generate/create migration scripts
3. **Business Logic Changes**: Edit files in `backend/app/services/` and update related tests
4. **Configuration Changes**: Edit `backend/app/core/` or environment variables in `.env`
5. **Middleware Changes**: Edit files in `backend/app/middleware/`
6. **Worker Changes**: Edit files in `backend/worker/` or `backend/app/worker.py`

Always verify changes by running:
- Backend import check: `python -c "from app.main import app; print('BACKEND_IMPORT_OK')"`
- Health check: `curl http://127.0.0.1:8000/api/health`
- Test suite: `python -m pytest tests -q` (after installing requirements-dev.txt)
- For AI-related features, consider running live tests with proper API keys and quotas