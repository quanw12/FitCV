---
type: Architecture
title: Database Schema and Migrations
description: MySQL database schema, migration files, and database setup instructions for the FitCV application.
tags: [database, mysql, schema, migrations]
---

# Database Schema and Migrations

FitCV uses MySQL as its primary database. This document outlines the database schema, migration files, setup instructions, and important migration notes.

## Schema Overview

The main database schema is defined in:
```
database/full_schema.sql
```

This file contains the complete schema for a fresh database installation.

### Key Tables

Based on the README.md, important tables include (but are not limited to):

- `account`: Stores user information (id, email, password_hash, role, auth_provider, etc.)
- `job`: Stores job postings (id, company_id, title, description, etc.)
- `cv`: Stores candidate CVs (id, account_id, file data, parsed data, etc.)
- `match_result`: Stores CV-JD matching results
- `application`: Stores job applications (for students applying to jobs)
- `hr_screening_batch` and `hr_screening_candidate`: For external CV batch processing
- `auth_session`: For session management
- `ai_task` and `ai_task_attempt_history`: For AI processing tasks and their attempt history
- Tables for recruiter pipeline, email workflows, smart replies, email campaigns, etc.

## Migrations

Migration scripts are located in the `database/migrations/` directory. These are SQL files that modify the database schema incrementally.

### Important Migrations

1. **003_add_cv_jd_analyzer.sql**
   - Adds tables for CV/JD matching functionality
   - **Prerequisite**: Run this before enabling the CV/JD Analyzer API

2. **004_add_application_tracker.sql**
   - Adds tables for the Application Tracker feature
   - **Prerequisite**: Run this before using the Application Tracker

3. **005_add_job_archiving_and_scoring.sql**
   - Adds archiving timestamp and custom scoring weights to job postings
   - **Note**: Migration can be re-run, but backup database first as MySQL DDL auto-commits
   - **Rollback**: Use `005_rollback_job_archiving_and_scoring.sql` (will delete archived data and custom weights)

4. **006_add_recruiter_pipeline.sql**
   - Adds notes and history for recruiter pipeline stages (Applied, Screening, Interview, Offer, Hired, Rejected)

5. **007_add_candidate_email_workflow.sql**
   - Adds tables for tracking candidate email workflows (drafts, sent emails, etc.)

6. **008_add_application_notifications.sql**
   - Adds tables for application notifications (reminders, etc.)

7. **009_add_smart_reply_workflow.sql**
   - Adds tables for smart reply email functionality (inbound/outbound email tracking)

8. **010_add_platform_hardening.sql**
   - Adds tables for platform hardening: `hr_screening_batch`, `hr_screening_candidate`, `auth_session`, `auth_rate_limit`
   - Extends `ai_task` to be a durable queue

9. **011_add_reliable_email_delivery.sql**
   - Adds `retryable`, `retry_count`, and `last_attempt_at` columns for email retry mechanism

10. **012_add_email_campaigns.sql**
    - Adds tables for email campaign functionality (stage-based campaigns, templates)

11. **013_add_ai_task_attempt_history.sql**
    - **Important**: Must run **after** migration 010
    - Creates `ai_task_attempt_history` table which references `ai_task`
    - **Do not deploy code that reads/writes ai_task_attempt_history before this migration completes**

### Migration Dependencies

- Migration 013 depends on migration 010 (must run after 010)
- Other migrations can generally be run in numerical order, but always check the migration comments for specific dependencies

## Database Setup

### For a New Database

1. Create the database:
   ```sql
   CREATE DATABASE fitcv;
   ```

2. Run the full schema:
   ```bash
   mysql -u <db_user> -p fitcv < database/full_schema.sql
   ```

3. Ensure the backend runtime user has `SELECT`, `INSERT`, `UPDATE`, `DELETE` permissions on the `fitcv` database.

### For an Existing Database

When deploying updates, run the necessary migration files in order. For example, to update to the latest schema:
```bash
mysql -u <db_user> -p fitcv < database/migrations/001_initial.sql
mysql -u <db_user> -p fitcv < database/migrations/002_next.sql
# ... continue through to the latest migration
```

> **Note**: Always backup your database before running migrations, especially in production.

## Environment Configuration

Database connection is configured via the `DATABASE_URL` environment variable in `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://<db_user>:<url_encoded_password>@<db_host>:3306/fitcv
```

> **Important**: The password must be URL-encoded. For example, if your password contains `!`, it should be encoded as `%21`.

## Platform Hardening

If you have an existing MySQL database and need to enable platform hardening features (AI task attempt history, etc.), you must run the following migrations **in order**:

1. `database/migrations/010_add_platform_hardening.sql`
2. `database/migrations/013_add_ai_task_attempt_history.sql`

> **Warning**: Do not deploy code that depends on `ai_task_attempt_history` until after migration 013 has successfully completed.

## Job Post Archiving and Scoring

To enable job archiving and custom scoring weights on an existing database, run:
```bash
mysql -u <db_user> -p fitcv < database/migrations/005_add_job_archiving_and_scoring.sql
```

This migration:
- Keeps the existing recruitment statuses (`Draft`, `Published`, `Closed`)
- Adds an `archived_at` timestamp (nullable)
- Adds four default scoring weights:
  - Skills: 45%
  - Experience: 30%
  - Education: 15%
  - Soft Skills: 10%

> **Note**: The four weights must always be between 0-100 and sum to 100.

## Recruiter Pipeline and Email Workflows

To enable the recruiter pipeline and email workflows, run these migrations in order:
```bash
mysql -u <db_user> -p fitcv < database/migrations/006_add_recruiter_pipeline.sql
mysql -u <db_user> -p fitcv < database/migrations/007_add_candidate_email_workflow.sql
mysql -u <db_user> -p fitcv < database/migrations/009_add_smart_reply_workflow.sql
mysql -u <db_user> -p fitcv < database/migrations/011_add_reliable_email_delivery.sql
mysql -u <db_user> -p fitcv < database/migrations/012_add_email_campaigns.sql
```

## Application Tracker

To enable the Application Tracker feature, run:
```bash
mysql -u <db_user> -p fitcv < database/migrations/004_add_application_tracker.sql
mysql -u <db_user> -p fitcv < database/migrations/008_add_application_notifications.sql
```

## Validation Commands

- **Health Check Endpoint**: The backend provides a health check at `/api/health` which verifies database connectivity.
- **Manual Connection Test**: You can test the database connection directly with:
  ```bash
  mysql -u <db_user> -p -h <db_host> fitcv
  ```

## Change Navigation

When making database changes:

1. **Schema Changes**: Create a new migration file in `database/migrations/` with a sequential number and descriptive name.
2. **Modify Existing Migrations**: Avoid modifying existing migration files that have already been run in production. Instead, create a new migration.
3. **Testing Migrations**: Test migration scripts on a copy of production data before applying to production.
4. **Documentation**: Update this document if you add or modify important tables or migration procedures.

Always verify migrations by:
- Checking the backend health endpoint after migration
- Running application tests that depend on the changed schema
- Verifying that the expected tables/columns exist in the database