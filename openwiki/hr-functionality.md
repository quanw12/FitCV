---
type: system
title: HR Functionality
description: Comprehensive HR tools for job management, candidate ranking, pipeline management, reporting, and automated communication workflows.
tags: [hr, recruitment, reporting, pipeline, automation]
---
# HR Functionality

## Overview
FitCV provides specialized HR functionality for recruiters and hiring managers to manage the complete recruitment lifecycle, including job management, candidate screening and ranking, pipeline tracking, reporting, and automated communication workflows.

## Core Components

### Backend Routes
- **CV Ranking Routes**: `/backend/app/api/routes/cv_ranking.py` - Ranking CVs against jobs
- **Pipeline Routes**: `/backend/app/api/routes/pipeline.py` - Recruitment pipeline management
- **Reports Routes**: `/backend/app/api/routes/reports.py` - Analytics and reporting endpoints
- **Email Workflow Routes**: `/backend/app/api/routes/email_workflow.py` - Automated email sequences
- **Email Webhooks Routes**: `/backend/app/api/routes/email_webhooks.py` - Email service provider integration

### Services
- **CV Ranking Service**: `/backend/app/services/cv_ranking_service.py` - Ranking algorithms and operations
- **Pipeline Service**: `/backend/app/services/pipeline_service.py` - Pipeline stage management
- **Reports Service**: `/backend/app/services/reports_service.py` - Analytics and report generation
- **Email Workflow Service**: `/backend/app/services/email_workflow_service.py` - Automated email campaign management
- **Email Webhook Service**: `/backend/app/services/email_webhook_service.py` - Processing inbound email events
- **Jobs Service**: `/backend/app/services/jobs_service.py` - Job management (overlaps with job management system)
- **Application Service**: `/backend/app/services/application_service.py` - Application processing (overlaps with job management)

### Repositories
- **CV Ranking Repository**: `/backend/app/repositories/cv_ranking.py` - Data access for ranking operations
- **Pipeline Repository**: `/backend/app/repositories/pipeline.py` - Pipeline data access
- **Reports Repository**: `/backend/app/repositories/reports.py` - Analytics data access
- **Email Workflow Repository**: `/backend/app/repositories/email_workflow.py` - Email campaign data
- **Email Webhook Repository**: `/backend/app/repositories/email_webhooks.py` - Webhook event storage

### Frontend Components
- **CV Ranking Screen**: `/src/ui/screens/CVRankingScreen.tsx` - View and manage CV-job rankings
- **Bulk CV Ranking Panel**: `/src/ui/screens/BulkCvRankingPanel.tsx` - Rank multiple CVs against a job
- **Job Applicants Ranking Panel**: `/src/ui/screens/JobApplicantsRankingPanel.tsx` - Rank applicants for a specific job
- **Pipeline Screen**: `/src/ui/screens/PipelineScreen.tsx` - Recruitment pipeline visualization and management
- **Reports Screen**: `/src/ui/screens/ReportsScreen.tsx` - Analytics dashboard and report viewing
- **Auto Email Screen**: `/src/ui/screens/AutoEmailScreen.tsx` - Configure and manage automated email sequences
- **HR Dashboard**: `/src/ui/screens/HRDashboard.tsx` - Executive overview of recruitment metrics
- **Job Applicants Ranking Panel**: `/src/ui/screens/JobApplicantsRankingPanel.tsx` - Rank candidates for a job
- **Hiring Flow Component**: `/src/ui/components/HiringFlow.tsx` - Component for managing hiring flows

## HR-Focused Features

### CV Ranking & Screening
#### Individual CV Ranking
1. **Initiation**: HR selects a job and CV to rank
2. **Processing**: System retrieves latest parsed CV and job/JD data
3. **Matching**: Uses match engine to compute similarity scores
4. **Scoring**: 
   - Overall score (0-100) based on job-weighted categories
   - Category breakdown: skill, experience, education, soft skill scores
   - Pass probability estimation
   - Match label (e.g., "Strong Match", "Moderate Match")
5. **Evidence**: JSON evidence showing matching/missing elements
6. **Storage**: Results stored in `match_result` table
7. **Presentation**: Ranked list with scores, breakdowns, and improvement suggestions

#### Bulk CV Screening
1. **Batch Creation**: HR creates screening batch with job/JD and uploads multiple CVs
2. **Parallel Processing**: System processes all CVs through parsing and matching pipeline
3. **Scoring**: Each CV receives individual match scores against the job
4. **Ranking**: CVs ranked by overall score (highest first)
5. **Filtering**: Ability to filter by score thresholds, match labels, etc.
6. **Selection**: HR can select candidates for interview pipeline
7. **Storage**: Individual results in `hr_screening_candidate` table, batch summary in `hr_screening_batch`

### Pipeline Management
#### Pipeline Configuration
- **Stages**: Customizable recruitment stages (e.g., Applied → Screening → Interview → Offer → Hired)
- **Stage Properties**: Each stage has:
  - Entry/exit criteria
  - Required actions (e.g., schedule interview, send test)
  - Automatic transitions (based on time or conditions)
  - Notification triggers
  - SLA targets (time limits)
- **Automation Rules**: 
  - Move applications based on time in stage
  - Trigger actions based on application properties
  - Send reminders for stale applications
- **SLAs**: Configurable time targets for each stage with escalation

#### Pipeline Operations
- **Manual Movement**: Drag-and-drop or bulk select to move applications between stages
- **Bulk Actions**: 
  - Send emails to selected applications
  - Update status or add notes
  - Schedule interviews or tasks
  - Add to/remove from pipeline
- **Views**:
  - Kanban Board: Visual columns by stage with application cards
  - List View: Detailed table with filtering, sorting, and bulk selection
  - Calendar View: Interview scheduling and important dates
  - Analytics: Conversion rates, time-in-stage, bottleneck identification

#### Application Tracking in Pipeline
- **Stage History**: Each move recorded in `pipeline` table with timestamp and responsible account
- **Notes**: Stage-specific notes can be added
- **Tasks**: Follow-up tasks can be created and assigned
- **Deadlines**: Stage-specific or application-specific deadlines
- **Blocking**: Applications can be blocked pending additional information

### Reporting & Analytics
#### Pre-built Reports
- **Recruitment Funnel**: Conversion rates at each pipeline stage
- **Time-to-Hire**: Average days from application to hire
- **Source Effectiveness**: Which job sources yield best candidates
- **Reviewer Performance**: HR/hiring manager activity and decision patterns
- **Diversity Metrics**: Demographic breakdown of applicants and hires
- **Job Performance**: Which jobs attract most/applicants and fill fastest
- **Candidate Quality**: Match score distributions and hiring outcomes

#### Custom Reports
- **Ad-hoc Queries**: Flexible reporting based on available data fields
- **Filters**: Date ranges, job/department/HR filters, status filters
- **Groupings**: Group by job, HR, stage, outcome, etc.
- **Visualizations**: Charts, graphs, and tables for data presentation
- **Export**: CSV, Excel, PDF export options
- **Scheduling**: Automated report generation and email delivery

#### Real-time Dashboard
- **Live Metrics**: Active jobs, pending applications, interviews scheduled
- **Trends**: Weekly/monthly comparison of key metrics
- **Alerts**: Notifications for SLA breaches or unusual patterns
- **HR Performance**: Individual HR workload and effectiveness metrics
- **Job Market**: External job market trends if integrated

### Automated Communication
#### Email Workflows
- **Trigger-Based**: Emails sent based on application events or time delays
- **Template System**: 
  - Pre-defined templates for common communications
  - Personalization with merge fields (name, job title, company, etc.)
  - HTML and text versions
  - A/B testing capability
- **Workflow Types**:
  - Application Confirmation: Sent when application is received
  - Status Updates: Notify candidates of stage changes
  - Interview Scheduling: Coordinate interview times
  - Rejection Notifications: Professional rejection communications
  - Offer Letters: Formal job offer delivery
  - Onboarding Sequences: Post-acceptance welcome and paperwork
  - Re-engagement: Follow-up with silver medalist candidates
- **Timing Controls**:
  - Immediate triggers (on stage change)
  - Delayed triggers (X days after event)
  - Business hours only options
  - Time zone awareness
- **Tracking**: 
  - Delivery status (queued, sent, delivered, opened, clicked)
  - Engagement metrics (open rates, click-through rates)
  - Bounce and complaint handling
  - AI-generation flag for automated content
- **Email Campaigns**: 
  - Stage-driven batch email sending for targeted groups of candidates
  - Template management with JSON storage for dynamic content
  - Tracking of application stage at generation for audit and compliance
  - Campaign-level analytics (recipient count, interview date association)

#### Email Webhooks
- **Provider Integration**: Connects to email services (SendGrid, SES, etc.) for event tracking
- **Event Processing**: 
  - Email delivered
  - Email opened
  - Link clicked
  - Email bounced
  - Spam complaint
  - Unsubscribe request
- **Application to Records**: Events linked to specific email sends and applications
- **Automation Triggers**: Events can trigger workflow advances (e.g., move to next stage after email opened)
- **Engagement Scoring**: Lead scoring based on email interaction patterns

### HR Dashboard
#### Key Metrics Display
- **Overview Statistics**: 
  - Total active jobs
  - Applications this week/month
  - Interviews scheduled
  - Offers extended
  - Hires made
- **Pipeline Health**:
  - Applications by stage
  - Average time in stage
  - Bottleneck identification
  - SLA compliance rates
- **Quality Metrics**:
  - Average match scores of applicants
  - Pass rate trends
  - Offer acceptance rate
  - Retention predictions (if implemented)
- **Source Performance**:
  - Applications by source
  - Quality by source
  - Cost per hire tracking
- **Team Metrics**:
  - Applications per HR
  - Interview load distribution
  - Decision timing averages

#### Interactive Elements
- **Date Range Selection**: Customizable reporting periods
- **Drill-down Capability**: Click metrics to see underlying data
- **Filtering**: By job, department, HR, location, etc.
- **Export Options**: Download dashboard data
- **Refresh Controls**: Manual or automatic refresh intervals
- **Alert Configuration**: Set thresholds for notifications

## Data Models & Relationships

### Core HR Entities
```
Job ←→ CV Ranking (many rankings per job)
Job ←→ Pipeline (many pipeline entries per job)
Job ←→ Reports (many reports per job)
Job ←→ Email Workflows (many workflows per job)
Application ←→ Pipeline (pipeline tracks application stages)
Application ←→ Email Workflows (workflows trigger based on app events)
Application ←→ Reports (applications included in report calculations)
CV Ranking ←→ Match Result (ranking based on match results)
CV Ranking ←→ Improvement Suggestions (rankings show improvement areas)
Pipeline ←→ Application Stage History (pipeline stages map to app stages)
Email Workflows ←→ Email Templates (workflows use templates)
Email Webhooks ←→ Email Events (webhooks track email events)
HR Dashboard ←→ All Systems (dashboard aggregates data from all HR functions)
```

### Key Tables for HR Functionality

#### cv_ranking Table (Conceptual - may be match_result repurposed)
- Stores CV-job ranking results with scores and metadata
- Links to specific CV and job/job_description
- Includes ranking timestamp and ranker info (if manual override)

#### pipeline Table
- Tracks applications through recruitment pipeline stages
- Records stage transitions with timestamps and responsible accounts
- Includes notes and metadata for each stage

#### reports Table
- Stores report configurations and cached results
- Includes report type, parameters, generation timestamp
- Links to source data used in report

#### email_workflow Table
- Defines automated email sequences
- Includes trigger conditions, timing, template assignments
- Tracks workflow instances per application/candidate

#### email_template Table (Conceptual)
- Stores email templates with personalization fields
- Includes HTML/text versions, subject lines
- Tracks usage and performance metrics

#### email_event Table (from candidate_email_event)
- Tracks email service provider events (opens, clicks, etc.)
- Links to specific email sends
- Includes event type, timestamp, and provider data

## Focused Tests

### Backend Tests (`/backend/tests/`)
- **CV Ranking Service Tests**:
  - Ranking algorithm accuracy and consistency
  - Score calculation validation
  - Bulk ranking performance
  - Ranking storage and retrieval
  - Integration with match results
- **Pipeline Service Tests**:
  - Stage transition validation
  - Automation rule processing
  - Bulk operation correctness
  - SLA tracking and reporting
  - Pipeline view data preparation
- **Reports Service Tests**:
  - Report generation accuracy
  - Query performance optimization
  - Caching effectiveness
  - Export format correctness
  - Scheduled report reliability
- **Email Workflow Service Tests**:
  - Trigger condition evaluation
  - Timing and delay accuracy
  - Template personalization
  - Tracking and status updates
  - Bounce and complaint handling
- **Email Webhook Service Tests**:
  - Event parsing from various providers
  - Event-to-application linking
  - Trigger evaluation accuracy
  - Error handling for malformed events
  - Rate limiting and retry logic

### Frontend Tests
- **CV Ranking Screen Tests**:
  - Ranking list display and sorting
  - Score breakdown visualization
  - Improvement suggestion display
  - Bulk actions (select, export, etc.)
  - Detail view interaction
- **Bulk CV Ranking Panel Tests**:
  - File upload handling for screening
  - Parallel processing indication
  - Results display and ranking
  - Selection and movement to pipeline
- **Job Applicants Ranking Panel Tests**:
  - Applicant list loading
  - Ranking display and sorting
  - Individual applicant detail view
  - Pipeline movement actions
- **Pipeline Screen Tests**:
  - Kanban board drag-and-drop functionality
  - Column customization and reordering
  - Card detail expansion
  - Bulk selection and operations
  - Filtering and view switching
  - Analytics data display
- **Reports Screen Tests**:
  - Report builder interface
  - Filter and control interaction
  - Chart and graph rendering
  - Export functionality
  - Saved report management
- **Auto Email Screen Tests**:
  - Workflow creation and editing
  - Trigger condition configuration
  - Template selection and editing
  - Timing and delay settings
  - Activation and deactivation controls
- **HR Dashboard Tests**:
  - Metric display and updating
  - Date range selection
  - Drill-down interaction
  - Filtering controls
  - Alert configuration

## Validation Commands

### Backend HR Tests
```bash
# From backend directory
# Test CV ranking service
pytest -xvs backend/tests/test_cv_ranking_service.py

# Test pipeline service
pytest -xvs backend/tests/test_pipeline_service.py

# Test reports service
pytest -xvs backend/tests/test_reports_service.py

# Test email workflow service
pytest -xvs backend/tests/test_email_workflow_service.py

# Test email webhook service
pytest -xvs backend/tests/test_email_webhook_service.py
```

### Frontend HR Tests
```bash
# From root directory
# Test CV ranking screen
npm test -- src/ui/screens/CVRankingScreen.test.tsx

# Test bulk CV ranking panel
npm test -- src/ui/screens/BulkCvRankingPanel.test.tsx

# Test job applicants ranking panel
npm test -- src/ui/screens/JobApplicantsRankingPanel.test.tsx

# Test pipeline screen
npm test -- src/ui/screens/PipelineScreen.test.tsx

# Test reports screen
npm test -- src/ui/screens/ReportsScreen.test.tsx

# Test auto email screen
npm test -- src/ui/screens/AutoEmailScreen.test.tsx

# Test HR dashboard
npm test -- src/ui/screens/HRDashboard.test.tsx
```

### Manual Validation
```bash
# Test CV ranking endpoint (requires auth)
curl -X POST "http://localhost:8000/cv-ranking/rank" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cv_id": 123,
    "job_id": 456
  }'

# Test pipeline stage transition
curl -X POST "http://localhost:8000/pipeline/move" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": 789,
    "to_stage": "Interview"
  }'

# Test report generation
curl -X POST "http://localhost:8000/reports/generate" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "recruitment_funnel",
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }'
```

## Change Navigation

### Adding New Ranking Factors
1. Modify match engine to include new factor in score calculation
2. Update job weighting system if factor requires new weight category
3. Modify CV ranking service to handle new factor display
4. Update frontend to show new factor in score breakdown
5. Add tests for new factor impact on rankings
6. Consider historical data implications (may need re-ranking)
7. Update any caching mechanisms that store ranking results

### Modifying Pipeline Stages
1. Update pipeline configuration storage if adding new stage properties
2. Modify pipeline service validation for new stage transition rules
3. Update route handlers in pipeline API for new stage operations
4. Adjust frontend pipeline components to display/edit new stage properties
5. Update automation rule engine if new trigger types added
6. Modify SLA calculation logic if needed
7. Update tests for new stage behavior and transitions
8. Consider impact on existing pipelines (may need migration script)

### Adding New Report Types
1. Create new report generator function in reports service
2. Add report type to enumeration in schemas and database
3. Create frontend report builder controls for new report parameters
4. Add visualization components if new report requires special display
5. Update reports API route to handle new report type
6. Add tests for new report accuracy and performance
7. Consider adding to scheduled reports options if appropriate
8. Update documentation and user help for new report

### Enhancing Email Workflows
1. Add new trigger types to email workflow service evaluation
2. Create new template variables if needed for personalization
3. Modify workflow engine to handle new trigger logic
4. Update frontend workflow builder UI for new trigger configuration
5. Add tracking for new trigger types if they produce metrics
6. Update tests for new workflow trigger accuracy
7. Consider impact on existing workflows (backward compatibility)
8. Add any new database tables/columns via migration if needed

### Improving HR Dashboard
1. Identify new metrics needed and their data sources
2. Modify dashboard service to query/calculate new metrics
3. Update frontend dashboard components to display new metrics
4. Add any new API endpoints needed for dashboard data
5. Modify date range filtering if metrics have different availability
6. Update tests for new metric calculation accuracy
7. Consider performance impact of new metrics on dashboard load time
8. Add user configuration options if metrics are optional

## Related Systems
- **Authentication**: HR functionality requires authentication and proper role (HR/HiringManager/Admin)
- **CV Processing**: CV ranking depends on CV processing pipeline for parsing and match results
- **Job Management**: HR functionality builds on job management system for job and application data
- **Database**: All HR data stored in tables defined in `/database/full_schema.sql`
- **Background Workers**: Email workflows and report generation may use background workers
- **AI Services**: CV ranking uses AI matching; potential for AI-enhanced reporting
- **Notifications**: Email workflows integrate with notification systems
- **Analytics**: Reports system may feed into broader analytics platforms
- **Integrations**: Email webhooks connect to external email service providers

## Change Impact Summary
- **High Impact**: Changes to core HR data models, ranking algorithms, or pipeline engine logic
- **Medium Impact**: Changes to report generation, email workflow triggers, or dashboard metrics
- **Low Impact**: UI tweaks, template changes, non-core feature additions
- **Breaking Changes**: Altering ENUM values or removing required fields requires data migration
- **Performance Sensitive**: Bulk ranking operations, complex report queries, real-time dashboard updates
- **Testing Critical**: HR workflow changes require comprehensive test coverage due to complexity and compliance importance
