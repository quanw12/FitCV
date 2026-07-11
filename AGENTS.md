# FitCV

FitCV is an AI-powered CV screening and job readiness platform for two user groups:

- Job Seekers / Students: upload CVs, compare CVs with job descriptions, view match scores, skill gaps, AI improvement suggestions, CV history, application tracking, and JD market insights.
- HR / Recruiters: create job posts, upload candidate CVs, rank candidates with AI, manage a hiring pipeline, draft candidate emails, and view reports.

This repository currently contains the React/Vite frontend prototype generated for the FitCV UI. The planned backend architecture is a FastAPI modular monolith with async AI processing, MySQL, file storage, Gemini API, and Resend email.

## Current Tech Stack

- Frontend: React 19 + Vite
- Styling: Tailwind CSS v4 plus existing CSS variables and utility classes in `src/index.css`
- Icons: `lucide-react`
- Charts: `recharts`
- Package manager: npm is available; lockfiles for npm and pnpm both exist.

## Development Server

A Vite development server is usually running in the Figma Make environment on `$PORT` (default 8443). Do not start another server unless the user asks or the existing preview is unavailable.

- Preview URL: available through the preview panel
- Hot reload: source changes reflect automatically

## Important Project Documents

Read the docs before making architecture, data, or product decisions:

- `docs/FitCV_Project_Proposal.docx`
- `docs/FitCV_Use_Case_Specification.docx`
- `docs/FitCV_DB_Schema.docx`
- `docs/FitCV_Shared_Design_System.docx`
- `docs/Project plan_Group06.docx`
- `docs/Vision document_Group06.docx`

Core MVP use cases:

- UC-01: Upload CV
- UC-02: Analyze CV against Job Description
- UC-03: View AI Improvement Suggestions
- UC-04: Create Job Post
- UC-05: Upload Candidate CV
- UC-06: View Candidate Ranking

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
- `src/ui/screens/*` - The 13 FitCV screens
- `src/data/navigation.tsx` - Portal navigation configuration
- `src/services/matchScore.ts` - Score label/color logic
- `src/api/fitcvApi.ts` - API contract placeholder for backend integration
- `src/types/app.ts` - Shared portal/screen/status types
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
- `CVRankingScreen.tsx`
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
- "Read the relevant docs in `docs/` before changing architecture or product behavior."
- "Follow the FitCV modular monolith direction unless explicitly told otherwise."
- "Keep frontend code organized by layer under `src/app`, `src/ui`, `src/api`, `src/services`, `src/data`, and `src/types`."
- "Do not overwrite unrelated work or user changes."

## Prompt Templates For Members

Use these prompt starters when a team member asks another agent/model to work in this repository.

Phuc Khang - Team Lead / Integration:

```text
Read AGENTS.md first. I am working on FitCV integration/auth/app coordination.
Follow the layer architecture in src/: app, ui, api, services, data, types.
For app flow changes, prefer src/app/App.tsx and shared layout/navigation files.
Do not create member folders. Keep code in the correct layer and run npm run build when source changes.
```

Gia Thuan - Developer / Student Portal:

```text
Read AGENTS.md first. I am working on the Job Seeker portal features:
CV & JD Match Analyzer, Application Tracker, JD Library, and CV History.
UI screens belong in src/ui/screens. Reusable UI goes in src/ui/components.
Move shared mock data/config to src/data, score or validation logic to src/services,
and shared types to src/types. Preserve PDF/DOCX max 10MB upload rules.
```

Anh Quan - Developer / HR and AI Workflow:

```text
Read AGENTS.md first. I am working on AI suggestions and HR workflows:
Improvement Suggestions, Job Post Management, Candidate Pipeline, and Auto Email.
Keep HR UI in src/ui/screens, workflow/display logic in src/services,
API contracts in src/api, and shared domain types in src/types.
AI email must stay review-first: AI drafts, HR reviews, HR approves before sending.
```

Anh Kiet - BA / Tester:

```text
Read AGENTS.md first. I am validating FitCV requirements and test cases.
Map behavior back to docs in docs/: proposal, use case specification, vision,
database schema, and design system. Check happy path, empty, loading, error,
role/permission behavior, and whether files are placed in the correct src layer.
```
