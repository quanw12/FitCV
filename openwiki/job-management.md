---
type: system
title: Job & Application Management
description: Complete job lifecycle management including job creation, application processing, tracking, and pipeline management for both job seekers and recruiters.
tags: [job-management, applications, recruiting, pipeline]
---
# Job & Application Management

## Overview
FitCV's job and application management system handles the complete recruitment lifecycle from job posting creation through application processing, tracking, and hiring decisions. The system supports both internal job management (for HR/recruiters) and external application tracking (for job seekers).

## Core Components

### Backend Routes
- **Job Routes**: `/backend/app/api/routes/jobs.py` - Job CRUD operations and management
- **Application Routes**: `/backend/app/api/routes/applications.py` - Application submission and management
- **Pipeline Routes**: `/backend/app/api/routes/pipeline.py` - Recruitment pipeline stage management
- **Job Search Routes**: `/backend/app/api/routes/job_search.py` - Job search and filtering functionality (integrates with freehire.me and LinkedIn APIs) (integrates with freehire.me and LinkedIn APIs)
- **Job Description Routes**: Part of job management (handled in jobs/routes or separate)

### Services
- **Jobs Service**: `/backend/app/services/jobs_service.py` - Business logic for job operations
- **Job Extraction Service**: `/backend/app/services/job_extraction_service.py` - Extracts job details from text
- **FreeHire Job Search**: `/backend/app/services/freehire_job_search.py` - External job search integration (freehire.me aggregator)
- **LinkedIn Job Search**: `/backend/app/services/linkedin_job_search.py` - LinkedIn job scraping
- **Application Service**: `/backend/app/services/application_service.py` - Application processing logic
- **Pipeline Service**: `/backend/app/services/pipeline_service.py` - Pipeline stage management
- **Improvement Enricher Service**: `/backend/app/services/improvement_enricher.py` - Enriches CV improvement suggestions with job market data
- **Improvement Provider Service**: `/backend/app/services/improvement_provider.py` - Provides improvement suggestions based on job market trends

### Repositories
- **Jobs Repository**: `/backend/app/repositories/jobs.py` - Data access for job operations
- **Applications Repository**: `/backend/app/repositories/applications.py` - Data access for applications
- **Candidates Repository**: `/backend/app/repositories/candidates.py` - Candidate data access
- **CV Repository**: `/backend/app/repositories/cv.py` - CV data access (for applications)
- **Analyzer Repository**: `/backend/app/repositories/analyzer.py` - Data access for CV analysis results

### Frontend Components
- **Job Posts Screen**: `/src/ui/screens/JobPostsScreen.tsx` - View and manage job postings
- **Job Search Screen**: `/src/ui/screens/JobSearchScreen.tsx` - Search and filter jobs (includes external job search from freehire.me and LinkedIn)
- **Application Tracker Screens**:
  - `/src/ui/screens/FitCVApplicationTracker.tsx` - Internal applications (HR view)
  - `/src/ui/screens/PersonalApplicationTracker.tsx` - Personal applications (Student view)
  - `/src/ui/screens/AppTrackerScreen.tsx` - General application tracker
- **Job Applicants Ranking Panel**: `/src/ui/screens/JobApplicantsRankingPanel.tsx` - Rank applicants for a job
- **Bulk CV Ranking Panel**: `/src/ui/screens/BulkCvRankingPanel.tsx` - Rank multiple CVs against a job
- **Improvement Screen**: `/src/ui/screens/ImprovementScreen.tsx` - View and apply CV improvement suggestions
- **JD Library Screen**: `/src/ui/screens/JDLibraryScreen.tsx` - Manage job description templates
- **Reports Screen**: `/src/ui/screens/ReportsScreen.tsx` - View recruitment reports and analytics
- **Pipeline Screen**: `/src/ui/screens/PipelineScreen.tsx` - Manage recruitment pipelines
- **Auto Email Screen**: `/src/ui/screens/AutoEmailScreen.tsx` - Configure automated email workflows
- **CV History Screen**: `/src/ui/screens/CVHistoryScreen.tsx` - View CV version history

## Job Lifecycle Management

### Job Creation & Publication
1. **Job Drafting**: HR creates job with at least title, about_job (job description), responsibilities, and requirements. Other fields like location, employment_type, etc. are optional.
2. **Position & Level**: Selects from predefined positions and experience levels
3. **Weight Configuration**: Sets skill/experience/education/soft skill weights (must total 100%)
4. **Status Management**: Job starts in 'Draft' status
5. **Publication**: Job can be published when the required fields (title, about_job, responsibilities, requirements) are non-empty and the skill/experience/education/soft skill weights total 100%. Changing status to 'Published' makes job visible to candidates
6. **Closing**: Setting status to 'Closed' stops new applications but preserves existing ones
7. **Archiving**: Optional archiving for historical records

### Job Content Management
- **Job Description**: Can be managed separately via `job_description` table
- **Source Types**: Pasted text, uploaded file, or derived from job record
- **Content Hashing**: SHA256 hash for change detection and deduplication
- **Parsing**: Job descriptions processed through same AI pipeline as CVs for matching

### Job Relationships
- **Company Association**: Each job linked to a company record
- **Creator Tracking**: Tracks which account created the job
- **HR Assignments**: Multiple HR accounts can be assigned to a job via `job_hr` table
- **Position/Level**: Standardized positions and levels for consistency

## Application Processing

### Application Submission
1. **Job Seeker Flow**: 
   - Student finds job via search or browsing
   - Selects CV to apply with (must be verified/latest)
   - Submits application through Apply button
2. **Application Creation**:
   - Creates record in `application` table linking candidate, job, and CV
   - Sets initial stage to 'Applied'
   - Records application timestamp
   - Sets status to 'Active'
3. **Notification**: Triggers application received notification (if enabled)

### Application Tracking & Stages
- **Stage Progression**: Applied → Screening → Interview → Offer → Hired → Rejected
- **Stage History**: Each change recorded in `application_stage_history`
- **Status Management**: Active, Withdrawn, Rejected, Hired (separate from stage)
- **Notes & Communication**: 
  - Application notes via `application_note` table
  - Email threads via `candidate_email_thread` and related tables
  - Inbound email tracking and event processing

### Application Lifecycle
- **Withdrawal**: Candidate can withdraw application (sets status to 'Withdrawn')
- **Rejection**: HR can reject application (sets stage to 'Rejected', status to 'Rejected')
- **Offer**: HR can move to offer stage, then to hired upon acceptance
- **Hired**: Final successful outcome
- **Audit Trail**: All changes tracked with timestamps and responsible accounts

## Pipeline Management

### Pipeline Configuration
- **Pipeline Stages**: Applied, Screening, Interview, Offer, Hired, Rejected
- **Stage Notes**: Each stage can have notes and history tracking
- **Stage Transitions**: Configured transitions between stages with validation
- **Automation Triggers**: Events that can trigger automatic stage changes or notifications

### Pipeline Usage
1. **View Pipeline**: HR sees all applications for their jobs organized by stage
2. **Update Stage**: Move applications between stages as they progress
3. **Add Notes**: Add notes to applications at any stage
4. **Track History**: View complete history of each application
5. **Email Integration**: Send emails to candidates at specific stages
6. **Smart Reply**: Use AI to draft replies to candidate emails (requires configuration)

## Job Search Functionality

### External Job Search
FitCV integrates with external job search APIs to provide students with job recommendations based on their CVs:

#### FreeHire.me Integration
- **Service**: `/backend/app/services/freehire_job_search.py`
- **Function**: Queries the freehire.me public API for tech job listings
- **Features**: 
  - Search by skills, experience level, location, remote preference
  - Job age filtering (default 30 days)
  - Best-effort service - continues if one source fails

#### LinkedIn Integration
- **Service**: `/backend/app/services/linkedin_job_search.py`
- **Function**: Scrapes LinkedIn's public guest endpoint for job recommendations
- **Features**:
  - Similar search parameters to freehire.me
  - Guest endpoint access (no authentication required)
  - Best-effort service with error handling

### Job Search Endpoint
- **Endpoint**: `POST /job-search/recommendations`
- **Authentication**: Requires verified Student account
- **Input**: 
  - CV ID (must be successfully parsed)
  - Optional manual query keywords
  - Optional experience level filter
  - Optional location filter
  - Optional remote work preference
  - Optional job age filter (days)
  - Optional result limit
- **Process**:
  1. Retrieves parsed CV data for the given CV ID
  2. Derives search keywords from CV metadata (skills, experience, etc.)
  3. Falls back to AI-generated query from full CV text if needed
  4. Queries both freehire.me and LinkedIn APIs
  5. Deduplicates results by title/company
  6. Returns merged, deduplicated job recommendations
- **Output**: Array of job hits with source attribution (freehire/linkedin)

### Error Handling
- **Partial Results**: If one search source fails, results from the working source are still returned
- **Complete Failure**: If both sources fail, returns appropriate error message
- **Validation**: Validates that CV exists and is successfully parsed before searching
- **Query Requirements**: Requires either derivable skills from CV or manual query input

## Improvement Enrichment

### Improvement Enricher Service
The improvement enricher service enhances CV improvement suggestions with current job market data:

#### Function
- **Service**: `/backend/app/services/improvement_enricher.py`
- **Purpose**: Enriches generic CV improvement suggestions with specific, actionable advice based on current job market trends
- **Process**:
  1. Takes baseline improvement suggestions from Gemini analysis
  2. Queries external job markets (freehire.me, LinkedIn) for current demand
  3. Identifies high-demand skills, technologies, and qualifications
  4. Modifies suggestions to emphasize market-relevant improvements
  5. Returns enriched suggestions with job market context

#### Integration
- **Used by**: Improvement provider service when generating improvement reports
- **Trigger**: When a student requests improvement suggestions for a CV-JD match
- **Configuration**: Controlled by feature flags and service availability

### Improvement Provider Service
The improvement provider service orchestrates the generation of CV improvement suggestions:

#### Function
- **Service**: `/backend/app/services/improvement_provider.py`
- **Purpose**: Provides the main improvement suggestion generation workflow
- **Process**:
  1. Receives match result ID from improvement suggestion request
  2. Retrieves the completed match result (CV-JD analysis)
  3. Generates baseline improvement suggestions using Gemini AI
  4. Enriches suggestions with job market data via improvement enricher (if available)
  5. Returns final improvement report to frontend

#### Integration
- **Called by**: Improvement routes (`/backend/app/api/routes/improvements.py`)
- **Depends on**: Match engine results, Gemini API, external job search services
- **Fallback**: If enrichment services unavailable, returns baseline Gemini suggestions

## Focused Tests

### Backend Tests
- **Job Search Route Tests**: `/backend/tests/test_job_search_route.py` - Tests job search endpoint functionality and error handling
- **CV Rebuild Apply Improvements**: `/backend/tests/test_cv_rebuild_apply_improvements.py` - Tests applying improvement suggestions to CV rebuild
- **Improvement Enricher Tests**: `/backend/tests/test_improvement_enricher.py` - Tests job market data enrichment functionality
- **Improvement Provider Tests**: `/backend/tests/test_improvement_provider.py` - Tests improvement suggestion generation workflow

### Frontend Tests
- **Improvement Screen Tests**: `/src/ui/screens/ImprovementScreen.test.tsx` - Tests improvement suggestion UI and interaction
- **App Tests**: `/src/app/App.test.tsx` - Main application component tests

## Validation Commands

### Backend Validation
```bash
# Test job search functionality
cd backend
python -m pytest tests/test_job_search_route.py -v

# Test improvement enrichment
cd backend
python -m pytest tests/test_improvement_enricher.py -v

# Test improvement provider
cd backend
python -m pytest tests/test_improvement_provider.py -v

# Test CV rebuild with improvements
cd backend
python -m pytest tests/test_cv_rebuild_apply_improvements.py -v
```

### Frontend Validation
```bash
# Test improvement screen
npm test src/ui/screens/ImprovementScreen.test.tsx

# Run all frontend tests
npm test
```