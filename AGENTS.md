# FitCV

FitCV is an AI-powered CV screening and job readiness platform for two user groups:

- Job Seekers / Students: upload CVs, compare CVs with job descriptions, view match scores, skill gaps, AI improvement suggestions, CV history, application tracking, and JD market insights.
- HR / Recruiters: create job posts, bulk upload externally sourced candidate CVs, rank candidates against an HR-supplied JD with AI-assisted evidence extraction, manage a hiring pipeline, draft candidate emails, and view reports.

This repository contains the React/Vite frontend prototype generated for the FitCV UI and a FastAPI backend foundation for the Auth & Role Selection flow. The planned backend architecture is a FastAPI modular monolith with async AI processing, MySQL, file storage, Gemini API, and Resend email.

## Current Tech Stack

- Frontend: React 19 + Vite
- Styling: Tailwind CSS v4 plus existing CSS variables and utility classes in `src/index.css`
- Icons: `lucide-react`
- Charts: `recharts`
- Package manager: npm is available; lockfiles for npm and pnpm both exist.
- Backend: FastAPI, SQLAlchemy, MySQL-ready schema, JWT auth, passlib password hashing.

## Development Server

A Vite development server is usually running in the Figma Make environment on `$PORT` (default 8443). Do not start another server unless the user asks or the existing preview is unavailable.

- Preview URL: available through the preview panel
- Hot reload: source changes reflect automatically

## Project Context Sources

The original planning documents have been removed from this repository. Use these files as the current source of project context:

- `AGENTS.md` - product summary, architecture direction, layer rules, ownership notes, and AI prompt guidance.
- `README.md` - setup instructions, environment variables, run commands, and troubleshooting.
- `database/full_schema.sql` - current database schema source.
- Existing source files in `src/` and `backend/` - current implementation details.

## Required Context Before Coding

Every team member or AI assistant must do this before changing code:

1. Read `AGENTS.md` completely.
2. Read `README.md` for local setup, environment variables, and run commands.
3. Read `database/full_schema.sql` before changing database models, repositories, migrations, or auth/user fields.
4. Inspect the existing files in the target layer before adding new files or abstractions.
5. Check current Git state and do not overwrite unrelated work.
6. Keep production code in the established layers. Do not create member-specific folders for application code.

For Auth & Role Selection work, also inspect:

- `src/ui/screens/AuthScreen.tsx`
- `src/api/authApi.ts`
- `src/types/auth.ts`
- `src/services/authValidation.ts`
- `backend/app/api/routes/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/email_service.py`
- `backend/app/schemas/auth.py`
- `backend/app/models/account.py`
- `database/full_schema.sql`

Current auth behavior:

- Account roles follow the database enum: `Student`, `HR`, `HiringManager`, `Admin`.
- Frontend portals remain `seeker` and `hr`; `HR`, `HiringManager`, and `Admin` route to the HR portal.
- Google sign-in uses Google Identity Services on the frontend and backend ID-token verification with `GOOGLE_CLIENT_ID`.
- Forgot/reset password uses a 6-digit verification code. The backend stores only the hash in `account.reset_token_hash` and expiry in `account.reset_token_expires_at`.
- If email sending is not configured, reset codes are printed in the backend terminal as `PASSWORD_RESET_CODE`.
- Do not reintroduce reset links or UI-exposed reset tokens unless the team explicitly changes the auth design.
- Profile uses only existing `account`, `candidate`, `company`, and `industry` schema fields. Students edit phone; HR, HiringManager, and Admin edit linked company and industry data.

Core MVP use cases:

- UC-01: Upload CV
- UC-02: Analyze CV against Job Description
- UC-03: View AI Improvement Suggestions
- UC-04: Create Job Post
- UC-05: Upload Candidate CVs or Collect Job Applications
- UC-06: Rank Candidates Against an HR-Supplied or Published JD

HR CV Ranking is an internal screening tool, not a second job marketplace:

- `Upload CV Batch`: HR pastes a JD or screening criteria and uploads up to 20
  externally sourced PDF/DOCX CVs. This flow does not require a published FitCV
  job or a Student application.
- `Job Applicants`: HR selects a company job post and ranks CVs already linked
  through `application`, `candidate`, and `cv`.
- The backend applies OCR/text extraction, preprocessing, structured parsing,
  evidence-based AI extraction, and the same weighted score engine to both flows.
- Job applicants reuse stored `cv_parse_result`, `jd_parse_result`, and
  `match_result` records instead of uploading or scoring the same CV again.
- Both flows provide a side-by-side raw CV and parsed-score review.
- Job Applicants can download one stored CV or all CVs for the selected job as
  a company-scoped ZIP archive.
- HR may select candidates manually or select everyone above a score threshold.
- A score supports review; it must never automatically accept or reject a candidate.

Unified matching engine rules:

- `backend/app/services/match_engine.py` is the only orchestration entry point
  for Student Analyzer, HR Batch Ranking, and Job Applicant Ranking.
- All flows use framework `fitcv-source-grounded-v2` and the same weighted
  scorer in `matching_service.py`.
- A published job is scored from Title, About the job, Responsibilities, and
  Requirements. Benefits, We Offer, Life at company, Hiring Process, deadline,
  location, employment type, and vacancy count are not weighted requirements.
- Gemini extracts source-grounded facts only. The deterministic parser then
  supplements omitted facts for both CV and JD before scoring.
- Hard eligibility rules must be represented separately from weighted fit.
  FitCV currently reports eligibility as `not_evaluated` because the schema
  does not provide verified work-authorization or other gate data.
- `match_result.evidence_json` stores normalized `matching_inputs`, engine
  version, rubric, eligibility state, and category evidence for debugging.
- AI Improvement consumes the completed `match_result`; it must not calculate
  another independent CV/JD score.

## Proposed System Architecture

Use this architecture direction for future implementation:

```text
React/Vite Frontend
        |
        v
FastAPI Backend - Modular Monolith
        |
        +-- Auth Module
        +-- CV Module
        +-- Job/JD Module
        +-- Matching/AI Module
        +-- Application/Pipeline Module
        +-- Email Module
        +-- Report Module
        |
        +-- MySQL Database
        +-- File Storage
        +-- Gemini AI API
        +-- Resend Email API
```

AI-heavy tasks should be asynchronous:

- CV parsing
- CV/JD matching
- CV improvement suggestion generation
- Candidate ranking
- Email draft generation

For MVP, a MySQL job/status table or FastAPI background task is acceptable. For a later phase, Redis Queue, RQ, or Celery can be introduced.

## Source Architecture

Source code is organized by layer under `src/`:

- `src/app/` - application composition, top-level route/screen switching, app state
- `src/ui/` - React UI components and screens
- `src/ui/components/` - reusable visual components and layout
- `src/ui/screens/` - page-level screens for Job Seeker, HR, and shared flows
- `src/api/` - API client contracts and future HTTP calls to the backend
- `src/services/` - frontend business/display logic such as score labels and score colors
- `src/data/` - static app data/configuration, mock data, navigation config
- `src/types/` - shared TypeScript types
- `src/imports/` - imported design/reference material

Keep production application code inside these layers. Do not create member-specific production folders.

Layer dependency rules:

- `src/main.tsx` should only bootstrap React and import `src/app/App.tsx`.
- `src/app/` may import from `ui`, `types`, `services`, `data`, and `api`.
- `src/ui/` may import from `types`, `services`, `data`, and `api` when needed.
- `src/services/` may import from `types` and pure `data`; it should not import React components.
- `src/api/` may import from `types`; it should not import React components.
- `src/data/` may import from `types` and icon/component primitives only when the file is explicitly UI config such as `navigation.tsx`.
- `src/types/` must stay dependency-light and should not import UI, API, services, or data.

Where to put new code:

- New screen: `src/ui/screens/<FeatureScreen>.tsx`
- New reusable component: `src/ui/components/<ComponentName>.tsx`
- New API call or request/response contract: `src/api/`
- New business/display logic: `src/services/`
- Shared mock data, constants, navigation, or large static datasets: `src/data/`
- Shared TypeScript types/interfaces: `src/types/`

Small screen-local arrays are acceptable inside a screen while the app is still a prototype. If the data is reused by more than one file, grows large, or represents domain mock data for a feature, move it to `src/data/`.

Backend code is organized under `backend/`:

- `backend/app/main.py` - FastAPI app setup, CORS, route registration
- `backend/app/api/` - API routers and dependencies
- `backend/app/core/` - config and security helpers
- `backend/app/db/` - database engine/session setup
- `backend/app/models/` - SQLAlchemy models
- `backend/app/repositories/` - database access functions
- `backend/app/schemas/` - Pydantic request/response schemas
- `backend/app/services/` - backend business logic
- `backend/app/middleware/` - guard helpers such as role requirements
- `backend/requirements.txt` - backend dependencies
- `database/` - SQL schema artifacts, especially MySQL DDL

Backend layer rules:

- API routes should validate HTTP concerns and call service functions.
- Services should own business rules and call repositories.
- Repositories should own database queries.
- Models should mirror the MySQL schema in the DB document.
- Schemas should define API request/response contracts.
- Security helpers should stay in `backend/app/core/security.py`.

Recommended ownership by feature area:

- Phuc Khang: `src/app/`, auth flow, integration, deployment coordination
- Gia Thuan: analyzer, application tracker, JD library, CV history
- Anh Quan: improvement suggestions, job post management, pipeline, auto email
- Anh Kiet: requirements, test cases, dashboard/report validation

## Key Files

- `src/app/App.tsx` - Main app routing/state between portals and screens
- `src/main.tsx` - React entry point
- `src/index.css` - Global CSS variables, shared classes, Tailwind import
- `src/ui/components/Layout.tsx` - Shared authenticated layout and navigation
- `src/ui/components/ScoreRing.tsx` - Match score ring component
- `src/ui/screens/CVRankingScreen.tsx` - HR ranking source tabs
- `src/ui/screens/BulkCvRankingPanel.tsx` - External CV batch workflow
- `src/ui/screens/JobApplicantsRankingPanel.tsx` - Job application ranking workflow
- `src/api/cvRankingApi.ts` - Both HR ranking API contracts
- `backend/app/api/routes/cv_ranking.py` - HR ranking endpoints
- `src/ui/screens/*` - The 13 FitCV screens
- `src/data/navigation.tsx` - Portal navigation configuration
- `src/services/matchScore.ts` - Score label/color logic
- `src/api/fitcvApi.ts` - API contract placeholder for backend integration
- `src/types/app.ts` - Shared portal/screen/status types
- `src/types/auth.ts` - Auth/session/user role types
- `src/api/authApi.ts` - Frontend auth API client with backend-first behavior and local fallback
- `src/services/authValidation.ts` - Auth form validation helpers
- `backend/app/api/routes/auth.py` - Backend auth endpoints
- `backend/app/services/auth_service.py` - Backend auth business logic
- `database/full_schema.sql` - Full MySQL schema for FitCV, including auth/users
- `src/imports/FitCV_Figma_AI_Prompt.md` - Original UI prompt/reference
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite config

## Screen Map

Shared:

- `AuthScreen.tsx` - Authentication and role selection

Job Seeker portal:

- `SeekerDashboard.tsx`
- `AnalyzerScreen.tsx`
- `ImprovementScreen.tsx`
- `CVHistoryScreen.tsx`
- `AppTrackerScreen.tsx`
- `JDLibraryScreen.tsx`

HR portal:

- `HRDashboard.tsx`
- `JobPostsScreen.tsx`
- `CVRankingScreen.tsx` with `Upload CV Batch` and `Job Applicants` tabs
- `PipelineScreen.tsx`
- `AutoEmailScreen.tsx`
- `ReportsScreen.tsx`

## Design System Direction

The docs define the shared design system:

- Student accent: `#2563EB`
- HR accent: `#D97706`
- App background: `#F8FAFC`
- Card background: `#FFFFFF`
- Border: `#E2E8F0`
- Text primary: `#0F172A`
- Text secondary: `#64748B`
- Success: `#16A34A`
- Warning: `#F59E0B`
- Danger: `#DC2626`

Score labels:

- 80-100: Strong Match
- 50-79: Moderate Match
- 0-49: Weak Match

The current prototype still uses an older indigo/teal visual style in several files. If asked to align UI with docs, prefer the design system above.

## Coding Guidelines

- Keep changes scoped to the requested feature or screen.
- Prefer existing components, CSS variables, and screen patterns before adding new abstractions.
- Use `lucide-react` icons for UI actions.
- Keep mock data realistic and consistent with FitCV domain examples.
- Preserve role separation between Job Seeker and HR flows.
- For score UI, always show both number and text meaning when possible; do not rely on color alone.
- Validate file upload rules in UI when implementing real upload: PDF/DOCX only, max 10MB.
- Do not treat AI output as guaranteed hiring outcome; phrase it as recommendation/support.

## Verification

Useful commands:

```bash
npm run build
npm run format
```

If dependencies are missing, run `npm install` first.

## Agent Notes

When another coding agent or AI model is used in this repo, prompt it with:

- "Read `AGENTS.md` first."
- "Read `README.md` before running the project."
- "Use `AGENTS.md`, `README.md`, and `database/full_schema.sql` as the current context sources."
- "Inspect existing files in the target layer before editing."
- "Follow the FitCV modular monolith direction unless explicitly told otherwise."
- "Keep frontend code organized by layer under `src/app`, `src/ui`, `src/api`, `src/services`, `src/data`, and `src/types`."
- "Keep backend code organized under `backend/app/api`, `core`, `db`, `models`, `repositories`, `schemas`, `services`, and `middleware`."
- "Do not overwrite unrelated work or user changes."
- "For auth, preserve the 4 database roles and the 6-digit reset-code flow."

## Prompt Templates For Members

Use these prompt starters when a team member asks another agent/model to work in this repository.

Phuc Khang - Team Lead / Integration:

```text
Read AGENTS.md and README.md first. I am working on FitCV integration/auth/app coordination.
Follow the layer architecture in src/: app, ui, api, services, data, types.
For app flow changes, prefer src/app/App.tsx and shared layout/navigation files.
For auth, preserve 4 DB roles and the 6-digit reset-code flow unless explicitly told otherwise.
Do not create member folders. Keep code in the correct layer and run npm run build when source changes.
```

Gia Thuan - Developer / Student Portal:

```text
Read AGENTS.md and README.md first. I am working on the Job Seeker portal features:
CV & JD Match Analyzer, Application Tracker, JD Library, and CV History.
UI screens belong in src/ui/screens. Reusable UI goes in src/ui/components.
Move shared mock data/config to src/data, score or validation logic to src/services,
and shared types to src/types. Preserve PDF/DOCX max 10MB upload rules.
```

Anh Quan - Developer / HR and AI Workflow:

```text
Read AGENTS.md and README.md first. I am working on AI suggestions and HR workflows:
Improvement Suggestions, Job Post Management, Candidate Pipeline, and Auto Email.
Keep HR UI in src/ui/screens, workflow/display logic in src/services,
API contracts in src/api, and shared domain types in src/types.
AI email must stay review-first: AI drafts, HR reviews, HR approves before sending.
```

Anh Kiet - BA / Tester:

```text
Read AGENTS.md and README.md first. I am validating FitCV requirements and test cases.
Map behavior back to AGENTS.md, README.md, database/full_schema.sql,
and existing source files. Check happy path, empty, loading, error,
role/permission behavior, and whether files are placed in the correct src layer.
```
