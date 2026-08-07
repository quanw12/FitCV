---
type: system
title: Background Workers & AI Processing
description: Asynchronous processing system for AI-intensive tasks including CV analysis, matching, improvement generation, and external job search integrations.
tags: [background-workers, ai-processing, async, task-queue]
---
# Background Workers & AI Processing

## Overview
FitCV uses a background worker system to handle AI-intensive and long-running operations asynchronously, preventing request timeouts and enabling scalable processing of CV analysis, job matching, improvement generation, and external data integrations.

## Core Components

### Worker Setup
- **AI Worker**: `/backend/app/services/ai_worker.py` - Main worker implementation for AI tasks
- **Worker Entrypoint**: `/backend/app/worker.py` - Worker initialization and process management
- **AI Tasks Routes**: `/backend/app/api/routes/ai_tasks.py` - API endpoints for task management

### Services Utilizing Workers
- **Gemini Analyzer**: `/backend/app/services/gemini_analyzer.py` - AI-powered CV and JD analysis
- **Gemini Client**: `/backend/app/services/gemini_client.py` - Low-level Google Gemini API client
- **Improvement Provider**: `/backend/app/services/improvement_provider.py` - Generates CV improvement suggestions
- **Improvement Enricher**: `/backend/app/services/improvement_enricher.py` - Enhances basic suggestions with details
- **Improvement Report Mapper**: `/backend/app/services/improvement_report_mapper.py` - Maps improvements to report formats
- **Improvement Validator**: `/backend/app/services/improvement_validator.py` - Validates improvement suggestions
- **Job Extraction Service**: `/backend/app/services/job_extraction_service.py` - Extracts job details from text
- **FreeHire Job Search**: `/backend/app/services/freehire_job_search.py` - External job search integration
- **LinkedIn Job Search**: `/backend/app/services/linkedin_job_search.py` - LinkedIn job scraping
- **CV Rebuild Services**: Multiple services in `/backend/app/services/cv_rebuild/` for CV regeneration
- **OCR Service**: `/backend/app/services/ocr_service.py` - Optical character recognition for scanned documents
- **Document Parser**: `/backend/app/services/document_parser.py` - Text extraction from PDF/DOCX
- **Match Engine**: `/backend/app/services/match_engine.py` - Core matching algorithm (can be AI-enhanced)
- **Matching Service**: `/backend/app/services/matching_service.py` - High-level matching operations
- **Analyzer Service**: `/backend/app/services/analyzer_service.py` - Orchestrates CV processing workflow
- **CV Ranking Service**: `/backend/app/services/cv_ranking_service.py` - Ranking operations
- **Reports Service**: `/backend/app/services/reports_service.py` - Report generation tasks
- **Email Workflow Service**: `/backend/app/services/email_workflow_service.py` - Email campaign processing

### Task Management
- **AI Task Model**: `/backend/app/models/ai_tasks.py` - Database model for tracking AI tasks
- **AI Task Schemas**: `/backend/app/schemas/ai_tasks.py` - Pydantic models for task API
- **AI Task Service**: `/backend/app/services/ai_task_service.py` - Service for task creation and management
- **AI Task Repository**: `/backend/app/repositories/ai_tasks.py` - Data access for AI tasks

### Configuration
- **Worker Settings**: `/backend/app/core/config.py` - Configuration for worker behavior
- **Task Routing**: Configuration for which tasks go to which workers/queues
- **Rate Limiting**: Settings for external API rate limits (Gemini, job search APIs, etc.)

## Task Types & Processing

### CV Analysis Tasks
1. **CV Parsing Task**: 
   - Input: CV file path or raw text
   - Processing: Text extraction → AI parsing (Gemini) → Structured JSON output
   - Output: Parsed CV data stored in `cv_parse_result` table
   - Triggers: CV upload, re-parsing request
2. **CV Analysis Task**:
   - Input: Parsed CV data
   - Processing: Skill extraction, experience calculation, education assessment, feature engineering
   - Output: Analyzed CV profile for matching
   - Triggers: After CV parsing, before matching

### Job Description Processing Tasks
1. **JD Parsing Task**:
   - Input: Job description text or file
   - Processing: Text extraction → AI parsing → Structured JSON output
   - Output: Parsed JD data stored in `jd_parse_result` table
   - Triggers: Job creation, JD upload/update
2. **Job Analysis Task**:
   - Input: Parsed JD data
   - Processing: Requirement extraction, weight normalization, feature preparation
   - Output: Analyzed job profile for matching
   - Triggers: After JD parsing, before matching

### Matching Tasks
1. **CV-JD Matching Task**:
   - Input: Analyzed CV and analyzed JD profiles
   - Processing: Multi-dimensional similarity scoring (skills, experience, education, soft skills)
   - Output: Match result with scores, labels, evidence stored in `match_result` table
   - Triggers: Explicit match request, bulk screening, application submission
2. **Batch Matching Task**:
   - Input: Multiple CVs and single JD (or vice versa)
   - Processing: Parallel matching operations
   - Output: Multiple match results ranked by score
   - Triggers: HR bulk screening, CV ranking operations

### Improvement Generation Tasks
1. **Improvement Suggestion Task**:
   - Input: Match result (CV-JD comparison)
   - Processing: Gap analysis → Suggestion generation (type, category, priority) → Enrichment with details
   - Output: Improvement suggestions stored in `cv_improvement_suggestion` table
   - Triggers: Match completion, user request for improvements
2. **CV Rebuild Task**:
   - Input: CV + accepted improvement suggestions
   - Processing: Content generation using AI while preserving facts → Template application → Output generation
   - Output: New CV file generated and stored, new version in `cv` table
   - Triggers: User applies improvements and requests CV regeneration

### External Integration Tasks
1. **Job Search Tasks**:
   - Input: Search criteria (keywords, location, etc.)
   - Processing: API calls to external job boards (FreeHire, LinkedIn, etc.) → Data normalization → Deduplication
   - Output: Job listings stored or made available for import
   - Triggers: User-initiated search, scheduled sync, HR job sourcing
2. **Job Extraction Task**:
   - Input: Raw job text (from email, web scraping, etc.)
   - Processing: Structured data extraction (title, company, location, requirements, etc.)
   - Output: Standardized job data for creation or matching
   - Triggers: Inbound job emails, web scraping results

### Report Generation Tasks
1. **Analytics Report Task**:
   - Input: Report parameters (date range, filters, report type)
   - Processing: Database queries → Data aggregation → Statistical calculations → Visualization preparation
   - Output: Report data (JSON, CSV, etc.) ready for delivery
   - Triggers: User report request, scheduled report generation
2. **Export Task**:
   - Input: Report data or raw data selection
   - Processing: Format conversion (CSV, Excel, PDF) → Styling and formatting
   - Output: Downloadable file in requested format
   - Triggers: Report export request

### Email Processing Tasks
1. **Email Campaign Task**:
   - Input: Email workflow definition + target applications/candidates
   - Processing: Template personalization → Send queue management → Tracking setup
   - Output: Email sends queued, tracking records created
   - Triggers: Workflow activation, time-based triggers, event-based triggers
2. **Email Event Processing Task**:
   - Input: Webhook data from email service provider
   - Processing: Event parsing → Application/linking → Trigger evaluation → State updates
   - Output: Updated email status, potential workflow advances
   - Triggers: Inbound webhook from email provider (SendGrid, SES, etc.)

## Worker Architecture

### Task Queue System
- **Task Creation**: Services create AI task records with `status = 'Pending'`
- **Task Claiming**: Workers periodically poll for pending tasks, claim them by setting `locked_by` and updating status to 'Processing'
- **Task Execution**: Workers execute task logic based on `task_type` and `payload_json`
- **Task Completion**: Upon success, set status to 'Success' with `completed_at` timestamp; on failure, set status to 'Failed' with error message
- **Heartbeat**: Workers update `heartbeat_at` during long tasks to prevent premature reclamation
- **Retry Logic**: Failed tasks can be retried up to `max_attempts` times based on `attempt_count`

### Task Lifecycle
```
Pending → [Worker Claims] → Processing → [Execution] → Success/Failed
                                 � ↓
                         [Retry if failed & attempts < max] → Processing
                                 � ↓
                             [Max retries exceeded] → Failed
```

### Concurrency & Scaling
- **Multiple Workers**: Can run multiple worker instances for parallel processing
- **Task Type Routing**: Different worker pools can specialize in task types if needed
- **Resource Limits**: Configurable concurrency limits to prevent resource exhaustion
- **Priority Handling**: Priority can be implemented via task ordering or separate queues
- **Scheduled Tasks**: Future-dated tasks via `available_at` field

## Key Services in Detail

### AI Worker (`/backend/app/services/ai_worker.py`)
- **Main Loop**: Continuously polls for pending tasks
- **Task Claiming**: Uses database locking to prevent duplicate processing
- **Execution Dispatch**: Routes tasks to appropriate service handlers based on `task_type`
- **Error Handling**: Catches exceptions, records error messages, manages retries
- **Resource Management**: Handles timeouts, memory usage, and graceful shutdown
- **Configuration**: Reads worker settings from config (polling interval, batch size, etc.)

### Gemini Analyzer & Client
- **Gemini Client**: Low-level wrapper for Google Gemini API with:
  - API key management
  - Request formatting and response parsing
  - Rate limiting and retry logic
  - Safety settings configuration
- **Gemini Analyzer**: High-level analysis functions:
  - CV analysis: Extracts skills, experience, education, etc.
  - JD analysis: Extracts requirements, responsibilities, qualifications
  - Matching assistance: Provides semantic similarity insights
  - Improvement generation: Generates targeted suggestions based on gaps
  - Content rewriting: Creates improved versions of CV sections

### CV Rebuild Services (in `/backend/app/services/cv_rebuild/`)
- **Orchestrator**: Coordinates the CV rebuild process
- **Language Services**: Handles multilingual content (Vietnamese/English)
- **Grounding**: Ensures AI-generated content stays factual and truthful
- **LLM Extractor**: Extracts structured data from CV sections for processing
- **Normalization**: Standardizes formats (dates, locations, etc.)
- **Prompts**: Manages prompt templates for different AI operations
- **PDF Renderer**: Generates PDF output from processed CV data
- **Template Renderer**: Applies CV templates to structured data
- **Avatar Handling**: Manages profile picture integration in CVs

### External Job Search Services
- **FreeHire Search**: 
  - API integration with FreeHire job platforms
  - Handles authentication, rate limiting, and data format conversion
  - Returns standardized job listings
- **LinkedIn Search**:
  - Web scraping or API integration for LinkedIn jobs
  - Handles session management, anti-bot measures
  - Extracts job data from LinkedIn postings
  - Returns standardized format for processing

## Data Flow & Task Management

### Task Creation Process
1. **Service Decision**: Service determines operation should be asynchronous
2. **Payload Preparation**: Creates `payload_json` with necessary input data
3. **Task Record**: Creates `ai_task` record with:
   - `task_type`: Identifier for what kind of processing to do
   - `resource_id`: ID of primary resource being processed (CV ID, job ID, etc.)
   - `owner_account_id`: User who initiated the task (if applicable)
   - `company_id`: Company context (for HR-initiated tasks)
   - `payload_json`: Serialized input data
   - `idempotency_key`: Prevents duplicate task creation
4. **Initial State**: Task starts with `status = 'Pending'`, `attempt_count = 0`

### Task Execution Process
1. **Worker Polling**: Worker queries for tasks with `status = 'Pending'` and `available_at <= now()`
2. **Task Claiming**: Atomically updates task to set `locked_by = worker_id`, `status = 'Processing'`, `heartbeat_at = now()`
3. **Payload Deserialization**: Parses `payload_json` for task execution
4. **Service Dispatch**: Calls appropriate handler function based on `task_type`
5. **Progress Updates**: Long-running tasks may update `heartbeat_at` periodically
6. **Completion Handling**:
   - **Success**: Sets `status = 'Success'`, `completed_at = now()`, clears `locked_by`
   - **Failure**: Increments `attempt_count`, sets `status = 'Failed'` if max attempts reached, else back to 'Pending'
   - **Error Recording**: Stores error message in `error_message` field

### Task Monitoring & Management
- **API Endpoints**: `/backend/app/api/routes/ai_tasks.py` for:
  - Listing tasks with filtering (by type, status, resource, owner)
  - Getting task details including payload and results
  - Canceling pending tasks
  - Retrying failed tasks manually
  - Cleaning up old completed/failed tasks
- **Frontend Monitoring**: UI components showing task progress for long operations
- **WebSocket Updates**: Real-time progress updates for user-facing tasks (if implemented)
- **Logging**: Comprehensive logging of task lifecycle for debugging

## Focused Tests

### Backend Tests (`/backend/tests/`)
- **AI Worker Tests**:
  - Task claiming and locking mechanism
  - Task execution dispatch based on type
  - Error handling and retry logic
  - Heartbeat and timeout handling
  - Graceful shutdown behavior
- **AI Task Service Tests**:
  - Task creation with proper validation
  - Task querying and filtering
  - Task cancellation and retry operations
  - Idempotency protection
  - Cleanup operations
- **Service-Specific AI Task Tests**:
  - Gemini analyzer task execution and result handling
  - CV rebuild task processing and file generation
  - Job search task execution and data processing
  - Improvement generation task quality and relevance
  - Report generation task accuracy and formatting
  - Email processing task handling and tracking
- **Integration Tests**:
  - End-to-end task flow from creation to completion
  - Database state transitions throughout task lifecycle
  - API endpoint integration with task service
  - Frontend-backend communication for task progress

### Frontend Tests
- **Task Monitoring Tests**:
  - Task list loading and filtering
  - Task detail viewing
  - Progress indication for long operations
  - Error state handling
  - Retry and cancel functionality
- **Service Integration Tests**:
  - CV upload triggering analysis tasks
  - Match request triggering matching tasks
  - Improvement request triggering generation tasks
  - Report request triggering generation tasks
  - Email workflow activation triggering processing tasks

## Validation Commands

### Backend Worker Tests
```bash
# From backend directory
# Test AI worker
pytest -xvs backend/tests/test_ai_worker.py

# Test AI task service
pytest -xvs backend/tests/test_ai_task_service.py

# Test AI task repository
pytest -xvs backend/tests/test_ai_tasks_repository.py

# Test Gemini analyzer
pytest -xvs backend/tests/test_gemini_analyzer.py

# Test CV rebuild services
pytest -xvs backend/tests/test_cv_rebuild/

# Test job search services
pytest -xvs backend/tests/test_freehire_job_search.py
pytest -xvs backend/tests/test_linkedin_job_search.py

# Test improvement services
pytest -xvs backend/tests/test_improvement_service.py
pytest -xvs backend/tests/test_improvement_provider.py
```

### Frontend Worker-Related Tests
```bash
# From root directory
# Test analyzer screen (triggers CV processing tasks)
npm test -- src/ui/screens/AnalyzerScreen.test.tsx

# Test CV rebuild screen (triggers CV rebuild tasks)
npm test -- src/ui/screens/CVReBuildScreen.test.tsx

# Test improvement screen (displays improvement generation results)
npm test -- src/ui/screens/ImprovementScreen.test.tsx

# Test reports screen (triggers report generation tasks)
npm test -- src/ui/screens/ReportsScreen.test.tsx

# Test auto email screen (triggers email workflow tasks)
npm test -- src/ui/screens/AutoEmailScreen.test.tsx
```

### Manual Validation
```bash
# Test task creation endpoint (requires auth)
curl -X POST "http://localhost:8000/ai-tasks/" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "cv_analysis",
    "resource_id": 123,
    "payload_json": {"cv_path": "/uploads/sample.pdf"}
  }'

# Test task listing
curl -X GET "http://localhost:8000/ai-tasks/?status=Pending&limit=10" \
  -H "Authorization: Bearer <jwt_token>"

# Test task details
curl -X GET "http://localhost:8000/ai-tasks/456" \
  -H "Authorization: Bearer <jwt_token>"
```

## Change Navigation

### Adding New Task Types
1. Add new `task_type` constant to task type definitions
2. Update AI task schemas to validate new task type if needed
3. Modify AI worker dispatcher to route new task type to appropriate handler
4. Create or modify service to handle the new task processing
5. Update service layer to create tasks of new type when needed
6. Add API endpoint if task needs manual triggering or monitoring
7. Update frontend to initiate new task type if user-facing
8. Add comprehensive tests for new task type execution
9. Consider adding task type to monitoring/dashboard if appropriate
10. Update documentation and any worker configuration

### Modifying Task Processing Logic
1. Identify which service handles the task type to modify
2. Update the service implementation with new logic
3. Modify task payload structure if input/output changes
4. Update task creation code to prepare new payload format
5. Update any result handling or storage logic
6. Add/modify tests for new processing behavior
7. Consider backward compatibility for existing pending tasks
8. Update any caching or optimization related to the task type
9. Monitor performance impact of changes

### Changing Worker Configuration
1. Modify worker settings in `/backend/app/core/config.py`
2. Update polling intervals, batch sizes, or concurrency limits
3. Adjust timeout settings based on task type requirements
4. Modify retry logic parameters if needed
5. Update any resource limit configurations (memory, CPU)
6. Test changes with representative task loads
7. Monitor system behavior after changes
8. Update any worker deployment or scaling configurations
9. Consider impact on task latency and throughput

### Enhancing Task Monitoring
1. Add new fields to AI task model if more tracking needed
2. Create migration script for database changes
3. Update service to populate new tracking fields
4. Modify API endpoints to expose new fields
5. Update frontend monitoring components to display new info
6. Add any new API endpoints for advanced task operations
7. Update tests for new tracking fields
8. Consider adding task analytics or metrics collection
9. Update any task alerting or notification systems

### Optimizing Task Processing
1. Identify bottlenecks in current task processing (profiling/logging)
2. Implement caching for frequent operations within tasks
3. Optimize database queries in task processing logic
4. Consider batching similar tasks for efficiency
5. Add async processing within tasks for I/O operations
6. Optimize AI prompt design to reduce token usage/API calls
7. Implement result caching for deterministic tasks
8. Consider specialized workers for different task types
9. Update load balancing or routing logic if needed
10. Test optimizations with realistic task volumes

## Related Systems
- **Authentication**: Tasks can be owner-account specific for security and quota tracking
- **CV Processing**: Many AI tasks are extensions of CV processing pipeline (analysis, matching, improvement)
- **Job Management**: Job search and analysis tasks support job management functionality
- **Database**: AI ø tasks stored in `ai_task` table defined in `/database/full_schema.sql`
- **Storage Services**: Task input/output may reference files in `/backend/uploads/` or other storage
- **API Services**: All task-creating services interact with worker system through task creation
- **Frontend**: User actions often trigger tasks; UI shows progress and results
- **Reports**: Report generation is a major consumer of background worker capacity
- **Email System**: Email workflow processing and event handling use background workers
- **Integrations**: External API calls (job search, Gemini, etc.) are prime candidates for background processing
- **Notifications**: Task completion can trigger notifications to users
- **Security**: Task isolation and data protection important for sensitive CV/job data

## Change Impact Summary
- **High Impact**: Changes to worker architecture, task locking mechanism, or core execution logic
- **Medium Impact**: Adding new task types, modifying task payload structures, or changing service integrations
- **Low Impact**: Task parameter adjustments, minor logic changes, non-core feature additions
- **Breaking Changes**: Changing task type identifiers or removing required payload fields
- **Performance Sensitive**: Worker polling frequency, task execution time, concurrent worker count
- **Testing Critical**: Task system requires comprehensive test coverage due to complexity and concurrency concerns
