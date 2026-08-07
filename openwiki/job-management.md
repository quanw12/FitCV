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
- **Job Search Routes**: `/backend/app/api/routes/job_search.py` - Job search and filtering functionality
- **Job Description Routes**: Part of job management (handled in jobs/routes or separate)

### Services
- **Jobs Service**: `/backend/app/services/jobs_service.py` - Business logic for job operations
- **Job Extraction Service**: `/backend/app/services/job_extraction_service.py` - Extracts job details from text
- **FreeHire Job Search**: `/backend/app/services/freehire_job_search.py` - External job search integration
- **LinkedIn Job Search**: `/backend/app/services/linkedin_job_search.py` - LinkedIn job scraping
- **Application Service**: `/backend/app/services/application_service.py` - Application processing logic
- **Pipeline Service**: `/backend/app/services/pipeline_service.py` - Pipeline stage management

### Repositories
- **Jobs Repository**: `/backend/app/repositories/jobs.py` - Data access for job operations
- **Applications Repository**: `/backend/app/repositories/applications.py` - Data access for applications
- **Candidates Repository**: `/backend/app/repositories/candidates.py` - Candidate data access
- **CV Repository**: `/backend/app/repositories/cv.py` - CV data access (for applications)

### Frontend Components
- **Job Posts Screen**: `/src/ui/screens/JobPostsScreen.tsx` - View and manage job postings
- **Job Search Screen**: `/src/ui/screens/JobSearchScreen.tsx` - Search and filter jobs
- **Application Tracker Screens**:
  - `/src/ui/screens/FitCVApplicationTracker.tsx` - Internal applications (HR view)
  - `/src/ui/screens/PersonalApplicationTracker.tsx` - Personal applications (Student view)
  - `/src/ui/screens/AppTrackerScreen.tsx` - General application tracker
- **Job Applicants Ranking Panel**: `/src/ui/screens/JobApplicantsRankingPanel.tsx` - Rank applicants for a job
- **Bulk CV Ranking Panel**: `/src/ui/screens/BulkCvRankingPanel.tsx` - Rank multiple CVs against a job

## Job Lifecycle Management

### Job Creation & Publication
1. **Job Drafting**: HR creates job with title, description, requirements, location, etc.
2. **Position & Level**: Selects from predefined positions and experience levels
3. **Weight Configuration**: Sets skill/experience/education/soft skill weights (must total 100%)
4. **Status Management**: Job starts in 'Draft' status
5. **Publication**: Changing status to 'Published' makes job visible to candidates
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
- **Custom Stages**: Organizations can define custom recruitment pipeline stages
- **Stage Configuration**: Each stage has entry/exit criteria, required actions, and notifications
- **Automation**: Rules for automatic stage movement based on conditions
- **SLAs**: Time targets for each stage to prevent bottlenecks

### Pipeline Operations
- **Bulk Operations**: Move multiple applications between stages simultaneously
- **Bulk Actions**: Send emails, schedule interviews, update status for multiple applications
- **Reporting**: Pipeline analytics showing conversion rates, time-in-stage, bottlenecks
- **Forecasting**: Predictive analytics based on historical pipeline data

### Pipeline Views
- **Kanban Board**: Visual representation of applications by stage
- **List View**: Detailed table view with filtering and sorting
- **Calendar View**: Interview scheduling and important dates
- **Analytics Dashboard**: Metrics and KPIs for recruitment performance

## Job Search & Discovery

### Search Functionality
- **Text Search**: Full-text search on title, description, requirements
- **Filters**: Location, employment type, experience level, position, company, industry
- **Salary Range**: Min/max salary filtering (if implemented)
- **Date Filters**: Posted within, application deadline
- **Remote/Hybrid**: Work arrangement filtering
- **Saved Searches**: Users can save frequently used search criteria

### Search Algorithms
- **Keyword Matching**: Basic text matching with stemming
- **Relevance Scoring**: Boosts for exact matches, recent postings, etc.
- **Personalization**: Job recommendations based on user profile and CV
- **Trending Jobs**: Popular or rapidly filling positions
- **Similar Jobs**: Recommendations based on current job view

### External Job Integration
- **FreeHire Integration**: Import jobs from FreeHire platforms
- **LinkedIn Integration**: Scrape and import public LinkedIn job postings
- **API Integrations**: Potential for other job board APIs
- **Deduplication**: Detection and handling of duplicate jobs from multiple sources
- **Refresh Cycles**: Periodic updating of external job listings

## Application Tracking (External)

### Student Application Tracking
- **Manual Entry**: Students can manually track applications outside FitCV
- **Automatic Detection**: Potential for automatic tracking via email parsing (future)
- **Company & Position**: Tracks where applications were submitted
- **Application Date**: When the application was submitted
- **Source**: Where the application was submitted (job board, company site, referral, etc.)
- **Job URL**: Link to original job posting
- **Reminders**: Follow-up reminders for application status checks
- **Status Tracking**: Applied, Screening, Interview, Offer, Rejected (mirrors internal stages)
- **Last Activity**: Timestamp of last known activity on application
- **Notes**: Free-form notes about the application process
- **Notifications**: Status change reminders and follow-up prompts

## Data Models & Relationships

### Core Entities
```
Job ←→ Company (many jobs per company)
Job ←→ Position (many-to-one)
Job ←→ Level (many-to-one)
Job ←→ HR Accounts (many-to-many via job_hr)
Job ←→ Job Description (one-to-one or one-to-many)
Job Description ←→ JD Parse Result (one-to-one)
Job ←→ Applications (one-to-many)
Application ←→ Candidate (many-to-one)
Application ←→ Job (many-to-one)
Application ←→ CV (many-to-one)
Application ←→ Application Stage History (one-to-many)
Application ←→ Application Notes (one-to-many)
Application ←→ Candidate Email Thread (one-to-one)
Candidate Email Thread ←→ Candidate Emails (one-to-many)
Candidate Email Thread ←→ Inbound Emails (one-to-many)
Candidate ←→ Tracked Applications (one-to-many)
Tracked Application ←→ Tracked Application Notes (one-to-many)
Tracked Application ←→ Status History (one-to-many)
Tracked Application ←→ Notifications (one-to-many)
```

### Key Fields & Constraints

#### Job Table
- **status**: ENUM('Draft', 'Published', 'Closed') with archiving timestamp
- **weights**: skill_weight, experience_weight, education_weight, soft_skill_weight (must sum to 100)
- **timestamps**: created_at, updated_at, archived_at, deadline
- **relationships**: company_id (FK), created_by_account_id (FK), position_id (FK), level_id (FK)

#### Application Table
- **current_stage**: ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected')
- **status**: ENUM('Active', 'Withdrawn', 'Rejected', 'Hired')
- **timestamps**: applied_at, updated_at
- **relationships**: candidate_id (FK), job_id (FK), cv_id (FK with RESTRICT on delete)

#### Tracked Application Table
- **status**: ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Rejected')
- **timestamps**: applied_on (date), reminder_at, last_activity_at, created_at, updated_at
- **relationships**: account_id (FK), company_name (denormalized for quick access)

## Focused Tests

### Backend Tests (`/backend/tests/`)
- **Job Service Tests**:
  - Job creation, validation, and persistence
  - Status transition logic (Draft → Published → Closed)
  - Weight validation and normalization
  - Company and creator associations
  - Job search and filtering accuracy
- **Application Service Tests**:
  - Application submission validation
  - Stage transition logic and validation
  - Duplicate prevention (same candidate/job/CV)
  - Withdrawal and rejection handling
  - Notification triggering
- **Pipeline Service Tests**:
  - Stage configuration and validation
  - Bulk operation correctness
  - Automation rule processing
  - SLA tracking and reporting
- **Job Search Tests**:
  - Text search relevance and accuracy
  - Filter combinations and performance
  - Personalization and recommendation logic
  - External integration and deduplication
- **Repository Tests**:
  - CRUD operations for all entities
  - Relationship loading and cascading
  - Query optimization and indexing effectiveness
  - Transaction handling and rollback behavior

### Frontend Tests
- **Job Posts Screen Tests**:
  - Job creation form validation
  - Draft/publish/close workflow
  - Job listing and sorting
  - Job detail view
- **Job Search Screen Tests**:
  - Search input handling and debouncing
  - Filter application and persistence
  - Search results display and pagination
  - Saved search functionality
- **Application Tracker Tests**:
  - Application submission flow
  - Stage tracking and history display
  - Withdrawal and status update
  - Note taking and email integration
- **Pipeline Tests**:
  - Kanban board drag-and-drop
  - Bulk selection and operations
  - Filtering and view switching
  - Analytics data display

## Validation Commands

### Backend Job/Application Tests
```bash
# From backend directory
# Test job service
pytest -xvs backend/tests/test_jobs_service.py

# Test application service
pytest -xvs backend/tests/test_application_service.py

# Test pipeline service
pytest -xvs backend/tests/test_pipeline_service.py

# Test job search
pytest -xvs backend/tests/test_job_search.py

# Test repositories
pytest -xvs backend/tests/test_jobs_repository.py
pytest -xvs backend/tests/test_applications_repository.py
```

### Frontend Job/Application Tests
```bash
# From root directory
# Test job posts screen
npm test -- src/ui/screens/JobPostsScreen.test.tsx

# Test job search screen
npm test -- src/ui/screens/JobSearchScreen.test.tsx

# Test application tracker
npm test -- src/ui/screens/FitCVApplicationTracker.test.tsx
npm test -- src/ui/screens/PersonalApplicationTracker.test.tsx

# Test pipeline screen
npm test -- src/ui/screens/PipelineScreen.test.tsx

# Test ranking panels
npm test -- src/ui/screens/JobApplicantsRankingPanel.test.tsx
npm test -- src/ui/screens/BulkCvRankingPanel.test.tsx
```

### Manual Validation
```bash
# Test job creation (requires auth)
curl -X POST "http://localhost:8000/jobs/" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Software Engineer",
    "description": "We are looking for a skilled software engineer...",
    "requirements": "3+ years experience in Python, Django...",
    "location": "Ho Chi Minh City, Vietnam",
    "employment_type": "Full-time",
    "position_id": 1,
    "level_id": 2,
    "company_id": 1,
    "skill_weight": 45.0,
    "experience_weight": 30.0,
    "education_weight": 15.0,
    "soft_skill_weight": 10.0
  }'

# Test job search
curl -X GET "http://localhost:8000/job-search/?keyword=engineer&location=hcmc" \
  -H "Authorization: Bearer <jwt_token>"

# Test application submission
curl -X POST "http://localhost:8000/applications/" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": 123,
    "job_id": 456,
    "cv_id": 789
  }'
```

## Change Navigation

### Adding New Job Fields
1. Add column to `job` table in `/database/full_schema.sql`
2. Create migration script in `/database/migrations/`
3. Update SQLAlchemy model in `/backend/app/models/jobs.py`
4. Update Pydantic schemas in `/backend/app/schemas/jobs.py`
5. Modify route handlers in `/backend/app/api/routes/jobs.py`
6. Update service layer in `/backend/app/services/jobs_service.py`
7. Adjust frontend forms in `/src/ui/screens/JobPostsScreen.tsx`
8. Update API service in `/src/api/jobsApi.ts` if needed
9. Modify types in `/src/types/jobs.ts` if exists
10. Update tests for new field validation and persistence

### Modifying Application Workflow
1. Update `current_stage` ENUM in application table if adding/removing stages
2. Modify stage transition validation in `/backend/app/services/application_service.py`
3. Update route handlers in `/backend/app/api/routes/applications.py`
4. Adjust frontend application tracker components
5. Update email workflow triggers if stage changes affect notifications
6. Modify pipeline service if new stages require special handling
7. Update tests for new stage logic and transition rules
8. Consider impact on existing applications (may need migration script)

### Changing Search Functionality
1. Modify search query logic in `/backend/app/services/jobs_service.py` or search service
2. Update route handler in `/backend/app/api/routes/job_search.py`
3. Adjust search result formatting and pagination
4. Update frontend search components in `/src/ui/screens/JobSearchScreen.tsx`
5. Modify API service in `/src/api/jobSearchApi.ts`
6. Update search type definitions in `/src/types/jobSearch.ts`
7. Add/update tests for search relevance and performance
8. Consider adding search analytics or tracking if needed

### Implementing New Pipeline Features
1. Extend pipeline configuration in database if needed (new tables/columns)
2. Update pipeline service logic in `/backend/app/services/pipeline_service.py`
3. Modify route handlers in `/backend/app/api/routes/pipeline.py`
4. Update frontend pipeline components in `/src/ui/screens/PipelineScreen.tsx`
5. Adjust API service in `/src/api/pipelineApi.ts`
6. Update types in `/src/types/pipeline.ts`
7. Add tests for new pipeline automation, reporting, or visualization features
8. Consider impact on existing pipeline configurations

### Integrating New Job Sources
1. Create new service class following pattern of existing job search services
2. Add service to dependency injection or factory pattern
3. Update job search orchestrator to include new source
4. Implement deduplication logic for new source
5. Add configuration for API keys or credentials if needed
6. Create frontend components for source-specific controls if needed
7. Add tests for new integration including error handling and rate limiting
8. Update documentation and any admin configuration interfaces

## Related Systems
- **Authentication**: Users must be authenticated to manage jobs or submit applications
- **CV Processing**: Applications require verified CVs; match scores inform screening decisions
- **Database**: All job/application data stored in tables defined in `/database/full_schema.sql`
- **HR Functionality**: Job management is core HR functionality; pipeline management overlaps significantly
- **Reports**: Job and application analytics feed into reports system
- **Email System**: Application status changes trigger email notifications
- **AI Worker**: Background processing for job search integrations and bulk operations
- **Notifications**: Real-time updates for application status changes
- **Analytics**: Job performance and application conversion metrics

## Change Impact Summary
- **High Impact**: Changes to job/application data models, core workflow logic, or stage transitions
- **Medium Impact**: Changes to search algorithms, pipeline configuration, or integration methods
- **Low Impact**: UI tweaks, minor validation changes, non-core feature additions
- **Breaking Changes**: Altering ENUM values or removing required fields requires data migration
- **Performance Sensitive**: Search queries, bulk operations, pipeline analytics on large datasets
- **Testing Critical**: Workflow changes require comprehensive test coverage due to state complexity
