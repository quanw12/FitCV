---
type: wiki-skeleton
title: FitCV Repository Wiki Skeleton
description: Structural overview of the FitCV repository for documentation planning
tags: [repository, architecture, skeleton]
---
# FitCV Repository Wiki Skeleton

## Core Systems

### 1. Frontend Application (`/src`)
- **Overview**: React 19 + Vite frontend with Tailwind CSS
- **Entry Point**: `/src/main.tsx` (React 19 + Vite bootstrap)
- **Root App Component**: `/src/app/App.tsx` with test `/src/app/App.test.tsx` (application shell and routing)
- **HTML Template**: `/index.html` (base HTML file with root div and script imports for Vite)
- **Global Styles**: `/src/index.css` (Tailwind CSS v4 configuration and custom utility classes)
- **Static Assets**: `/public/` directory (containing fonts and other static assets served by Vite)
- **Pages**: 
  - Authentication flow (`/src/ui/screens/AuthScreen.tsx`)
  - Analyzer (`/src/ui/screens/AnalyzerScreen.tsx`)
  - CV Builder/Rebuild (`/src/ui/screens/CVReBuildScreen.tsx`)
  - Job Search (`/src/ui/screens/JobSearchScreen.tsx`)
  - Job Posts (`/src/ui/screens/JobPostsScreen.tsx`)
  - CV Ranking (`/src/ui/screens/CVRankingScreen.tsx`)
  - Auto Email (`/src/ui/screens/AutoEmailScreen.tsx`)
  - Application Tracker (`/src/ui/screens/FitCVApplicationTracker.tsx`, `/src/ui/screens/PersonalApplicationTracker.tsx`, `/src/ui/screens/AppTrackerScreen.tsx`)
  - Pipeline (`/src/ui/screens/PipelineScreen.tsx`)
  - Reports (`/src/ui/screens/ReportsScreen.tsx`)
  - Improvement Suggestions (`/src/ui/screens/ImprovementScreen.tsx`)
  - HR Dashboard (`/src/ui/screens/HRDashboard.tsx`)
  - Public Job Viewing (`/src/ui/screens/PublicJobScreen.tsx`)
  - JD Library (`/src/ui/screens/JDLibraryScreen.tsx`)
- **Components**: Reusable UI components (`/src/ui/components/`)
- **Services**: API services (`/src/services/` and `/src/api/` for API client functions)
- **Types**: TypeScript type definitions (`/src/types/`)
- **State/Data Management**: (`/src/data/`)
- **Real-Time Communication**: WebSocket connection attempt in `LandingScreen.tsx` for real-time analyzer updates (connects to `ws://{location.host}`)

### 2. Backend API (`/backend`)
- **Overview**: FastAPI modular monolith with async processing
- **Main Entry Point**: `/backend/app/main.py`
- **Core Modules**:
  - Configuration (`/backend/app/core/`)
  - Database (`/backend/app/db/`)
  - Models (`/backend/app/models/`)
  - Schemas (`/backend/app/schemas/`)
  - Services (`/backend/app/services/`)
  - Repositories (`/backend/app/repositories/`)
  - Middleware (`/backend/app/middleware/`)
  - API Routes (`/backend/app/api/routes/`)
  - Dependencies (`/backend/app/api/deps.py`)
  - Security and Google Authentication (`/backend/app/core/security.py`, `/backend/app/core/google_auth.py`)
- **Templates**: CV template file (`/backend/app/templates/cv_template.html`) used for generating CVs in CV rebuild functionality
- **File Upload Storage**: `/backend/uploads/` directory (configured in `/backend/app/main.py` via `settings.upload_dir` and mounted at `/uploads`)

### 3. Database Layer
- **Schema**: `/database/full_schema.sql`
- **Models**: SQLAlchemy models in `/backend/app/models/`
- **Repositories**: Data access layer in `/backend/app/repositories/`
- **Migrations**: SQL migration files in `/database/migrations/` (e.g., 001_add_auth_fields_to_account.sql) for schema evolution.

### 4. Authentication & Authorization System
- **Auth Routes**: `/backend/app/api/routes/auth.py`
- **Auth Service**: `/backend/app/services/auth_service.py`
- **Auth Models**: `/backend/app/models/account.py`
- **Auth Schemas**: `/backend/app/schemas/auth.py`
- **Email Service**: `/backend/app/services/email_service.py` (for verification codes)
- **Frontend Auth**: `/src/ui/screens/AuthScreen.tsx`, `/src/services/authValidation.ts`, `/src/types/auth.ts`, `/src/api/authApi.ts`

### 5. CV Processing & Analysis Pipeline
- **Analyzer Routes**: `/backend/app/api/routes/analyzer.py`
- **Match Engine**: `/backend/app/services/match_engine.py`
- **Matching Service**: `/backend/app/services/matching_service.py`
- **CV Routes**: `/backend/app/api/routes/cv_rebuild.py`, `/backend/app/api/routes/cv_ranking.py`
- **Improvement Reports**: `/backend/app/api/routes/improvements.py`
- **Frontend**: Analyzer screen, CV rebuild screen, improvement screen

### 6. Job & Application Management
- **Job Routes**: `/backend/app/api/routes/jobs.py`
- **Application Routes**: `/backend/app/api/routes/applications.py`
- **Pipeline Routes**: `/backend/app/api/routes/pipeline.py`
- **Job Search**: `/backend/app/api/routes/job_search.py`
- **Frontend**: Job posts screen, job search screen, application tracker screens

### 7. HR Functionality
- **CV Ranking**: `/backend/app/api/routes/cv_ranking.py` + `/src/ui/screens/BulkCvRankingPanel.tsx`, `/src/ui/screens/CVRankingScreen.tsx`
- **Job Applicants Ranking**: `/src/ui/screens/JobApplicantsRankingPanel.tsx`
- **Pipeline Management**: `/backend/app/api/routes/pipeline.py` + `/src/ui/screens/PipelineScreen.tsx`
- **Reports**: `/backend/app/api/routes/reports.py` + `/src/ui/screens/ReportsScreen.tsx`
- **Auto Email**: `/backend/app/api/routes/email_workflow.py` + `/src/ui/screens/AutoEmailScreen.tsx`
- **Email Webhooks**: `/backend/app/api/routes/email_webhooks.py`
- **HR Dashboard**: `/src/ui/screens/HRDashboard.tsx`

### 8. Profile Management
- **Profile Routes**: `/backend/app/api/routes/profile.py`
- **Profile Screen**: `/src/ui/screens/ProfileScreen.tsx`

### 9. Background Workers & AI Processing
- **AI Worker**: `/backend/app/services/ai_worker.py`
- **AI Tasks Routes**: `/backend/app/api/routes/ai_tasks.py`
- **Worker Entry Point**: `/backend/app/worker.py` (entry point for starting the AI worker, referenced in `/backend/app/main.py` lifespan)
- **CV Parse Results**: Database tables for parsed CV/JD data
- **Job Description Parsing**: Related to job_description and jd_parse_result tables

### 10. Infrastructure & Configuration
- **Configuration**: `/backend/app/core/config.py`
- **Environment Variables**: `.env`, `.env.example`, `.env.local`
- **Requirements**: `/backend/requirements.txt`, `/backend/requirements-dev.txt`
- **Frontend Deps**: `package.json`, `package-lock.json`
- **Vite Config**: `/vite.config.ts`
- **TS Config**: `/tsconfig.json`
- **Vitest Config**: `/vitest.config.ts`
- **Vite Types**: `/src/vite-env.d.ts` (TypeScript declaration file for Vite asset imports)

### 11. Testing
- **Backend Tests**: `/backend/tests/` (unit and integration tests for services, APIs, and workflows)
- **Frontend Tests**: `/src/test/`, `/src/app/App.test.tsx`, various `.test.tsx` files in `/src/ui/screens/`
- **Sprite Tests**: `/testsprite_tests/` (test artifact directory)

### 12. Generated Documentation and Artifacts
- **Output Directory**: `/output/` containing generated artifacts such as:
  - ERD generation script: `build_fitcv_erd.py`
  - Use case diagrams: `fitcv_overall_usecase_diagram.png`
  - Documentation: `/output/doc/` and `/output/docx/`

## Major Workflows

### 1. User Authentication Flow
- Registration/Login with email/password
- Google OAuth sign-in
- Role selection (Student, HR, HiringManager, Admin)
- Email verification (6-digit code for password reset)
- JWT token management

### 2. CV Analysis Workflow (Student/Job Seeker)
- Upload CV (PDF/DOCX)
- Select or paste Job Description
- AI analysis of CV vs JD
- View match score and skill gaps
- Get AI improvement suggestions
- Track CV history and applications

### 3. Job Posting & Management (HR/Recruiter)
- Create job post with title, description, requirements
- Set weightings for skills, experience, education, soft skills
- Publish/close/archive jobs
- Manage job lifecycle

### 4. Candidate Application & Tracking
- Students apply to jobs with their CV
- HR views applications and candidate details
- Track application stages (Applied, Screening, Interview, Offer, Hired, Rejected)
- Add notes to applications
- Manage email communication with candidates

### 5. CV Ranking & Screening (HR)
- Bulk upload externally sourced CVs
- Paste JD or screening criteria
- Rank candidates against JD using AI
- Manual or threshold-based candidate selection
- Download CVs as ZIP archive
- Side-by-side raw CV and parsed-score review

### 6. Pipeline Management (HR)
- View hiring pipeline for each job
- Move candidates between stages
- Track conversion metrics
- Generate pipeline reports

### 7. Reporting & Analytics (HR/Admin)
- View hiring reports and metrics
- Analyze job performance
- Track team activity
- Export reports

### 8. CV Rebuild & Improvement
- AI-powered CV rebuilding based on JD analysis
- View improvement suggestions
- Generate enhanced CV versions
- Compare original vs improved CV

## Extension Points & Integration Areas

### 1. Authentication Extension
- Additional OAuth providers (beyond Google)
- Social login integrations
- Multi-factor authentication

### 2. AI/Model Integration
- Different parsing engines for CV/JD
- Alternative matching algorithms
- Custom scoring models
- LLM provider swapping (beyond Gemini)

### 3. Notification & Communication
- Additional email templates
- SMS/WhatsApp integration
- In-app notification system
- Webhook extensibility

### 4. File Storage & Processing
- Alternative storage backends (AWS S3, Google Cloud Storage)
- Different file format support
- Virus scanning integration
- CV template library

### 5. Reporting & Export
- Additional report formats (PDF, Excel)
- Custom report builder
- Data export APIs
- Analytics dashboard customization

### 6. UI/Theming
- Theme customization
- Component library extension
- Dark/light mode enhancements
- Responsive design adjustments