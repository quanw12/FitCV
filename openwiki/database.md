---
type: system
title: Database Layer
description: MySQL database schema for FitCV platform with tables for accounts, jobs, applications, CV processing, and HR functionality.
tags: [database, mysql, schema]
---
# Database Layer

## Overview
FitCV uses a MySQL 8.0+ database with utf8mb4 encoding to support Vietnamese and multilingual text. The schema is defined in `/database/full_schema.sql` and managed through SQL migration files in `/database/migrations/`.

## Core Tables

### Authentication & Accounts
- **account**: Core user accounts with email, password hash, role (Student/HR/HiringManager/Admin), avatar, company association, and auth provider (Password/Google)
- **auth_session**: JWT refresh token storage with expiration and revocation tracking
- **auth_rate_limit**: Rate limiting for authentication attempts to prevent brute force attacks

### CV & Candidate Management
- **candidate**: Candidate profiles (can be HR-created or self-created)
- **cv**: CV file uploads with metadata (filename, path, type, size, SHA256, versioning)
- **cv_parse_result**: Parsed CV text and JSON structure from document processing
- **cv_improvement_suggestion**: AI-generated suggestions for CV improvement linked to match results

### Job & Application Management
- **company**: Employer information with industry association
- **position**: Job positions (abbreviation and full name)
- **level**: Experience levels (entry, mid, senior, etc.)
- **job**: Job postings with title, description, requirements, location, employment type, status, and weighted scoring criteria
- **job_hr**: Many-to-many relationship between jobs and HR accounts
- **job_description**: Detailed job descriptions (can be pasted text, uploaded file, or derived from job)
- **jd_parse_result**: Parsed job description JSON structure
- **application**: Job applications linking candidate, job, and CV with stage tracking (Applied → Screening → Interview → Offer → Hired → Rejected)
- **application_stage_history**: Audit trail of application stage changes
- **application_note**: Notes on applications by HR or hiring managers
- **candidate_email_thread**: Email conversation threads for applications
- **candidate_email**: Individual emails sent as part of workflow (with AI generation flag)
- **candidate_email_inbound**: Incoming email replies from candidates
- **candidate_email_event**: Email service provider events (opens, clicks, bounces)

### Tracking & External Applications
- **tracked_application**: Student-owned applications tracked outside FitCV's recruiter pipeline
- **tracked_application_note**: Notes on externally tracked applications
- **tracked_application_status_history**: Status change history for tracked applications
- **tracked_application_notification**: Notifications for tracked application updates

### HR Screening & Batch Processing
- **hr_screening_batch**: Batch CV screening jobs initiated by HR
- **hr_screening_candidate**: Individual CVs within a screening batch with match scores and selection status

### AI & Matching
- **match_result**: CV-JD matching results with overall score, category breakdowns (skill, experience, education, soft skill), pass probability, labels, and evidence
- **ai_task**: Background AI tasks for CV analysis, matching, improvement generation, etc.

## Key Relationships

### Core Data Flow
1. **Accounts** → **Candidates** (optional) → **CVs** → **CV Parse Results**
2. **Accounts** (HR) → **Companies** → **Jobs** → **Job Descriptions** → **JD Parse Results**
3. **CVs** + **Jobs/JDs** → **Match Results** → **Improvement Suggestions**
4. **Candidates** + **Jobs** + **CVs** → **Applications** → **Email Workflows** → **Application Notes/History**

### Weighted Scoring System
Jobs define weighted scoring criteria that must total 100%:
- **skill_weight** (default 45%)
- **experience_weight** (default 30%)
- **education_weight** (default 15%)
- **soft_skill_weight** (default 10%)

These weights are used in match calculations to compute category-specific scores.

## Indexes for Performance
The schema includes numerous indexes for query optimization:
- **account**: company_id, role, reset_token_hash
- **candidate**: account_id, created_by_hr
- **cv**: account_id, candidate_id, account_latest (for latest CV per user)
- **job**: company_id, created_by_account, company_archive_status, public_visibility
- **application**: candidate_id, job_id
- **match_result**: cv_job (for CV-JD lookups), cv_generated (for recent matches)
- **email**: company_status, application_created, thread_created, provider
- **tracking**: account_date, account_status, reminder, note_application, history_application
- **ai_task**: resource, claim, owner_created

## Constraints & Data Integrity
- **Foreign Keys**: Proper cascading deletes and set null behaviors
- **Check Constraints**: Weight validation (0-100 range), score validation (0-100), weight total = 100
- **Unique Constraints**: Email uniqueness, version per account, cv_parse/jd_parse uniqueness per algorithm
- **Not Null**: Required fields enforced at database level
- **Enum Validation**: Role, status, type fields use ENUM for data integrity

## File Storage Integration
- **CV Files**: Stored in `/backend/uploads/` with file paths recorded in `cv.file_path`
- **Hash Verification**: SHA256 hashes stored for file integrity verification
- **Template Files**: CV template stored at `/backend/app/templates/cv_template.html`

## Migration System
Schema evolution managed through SQL migration files in `/database/migrations/`:
- Example: `001_add_auth_fields_to_account.sql`
- Migration naming convention: sequential numbering with descriptive names
- Applied via application startup or manual execution

## Related Systems
- **Backend**: SQLAlchemy models in `/backend/app/models/` map directly to these tables
- **Services**: Repository layer in `/backend/app/repositories/` handles data access
- **Frontend**: Consumes data via API endpoints that query these tables

## Focused Tests
- **Location**: `/backend/tests/` directory
- **Test Types**: 
  - Repository unit tests
  - Service integration tests with database
  - Migration validation tests
- **Tools**: pytest with database fixtures

## Validation Commands
- **Schema Validation**:
  ```bash
  # Check MySQL connection and schema
  mysql -u root -p < /database/full_schema.sql
  ```
- **Migration Testing**:
  ```bash
  # Apply migrations to test database
  # (Specific migration tool commands would go here)
  ```
- **Backend Tests with DB**:
  ```bash
  # From backend directory
  pytest -xvs
  ```
- **Connection Testing**:
  ```bash
  # Test database connectivity
  mysqladmin ping -h localhost -u root -p
  ```

## Change Navigation
When modifying the database:
- **Schema Changes**: Edit `/database/full_schema.sql` and create new migration file in `/database/migrations/`
- **Model Updates**: Modify corresponding SQLAlchemy models in `/backend/app/models/`
- **Repository Changes**: Update data access methods in `/backend/app/repositories/`
- **Service Adjustments**: Modify business logic in `/backend/app/services/` to handle new fields
- **API Updates**: Adjust route handlers and schemas in `/backend/app/api/routes/` and `/backend/app/schemas/`
- **Frontend Updates**: Modify API calls in `/src/services/` and `/src/api/` if new data is needed
- **Testing**: Update or add tests in `/backend/tests/` to cover schema changes

## Index Discipline
When adding new indexes:
1. Consider query patterns from services and repositories
2. Focus on WHERE, JOIN, and ORDER BY clauses
3. Avoid over-indexing on write-heavy tables
4. Test performance impact with realistic data volumes
5. Document index purpose in migration comments
