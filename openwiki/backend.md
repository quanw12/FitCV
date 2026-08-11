---
type: system
title: Backend API
description: FastAPI modular monolith with async processing providing REST APIs for the FitCV platform.
tags: [backend, fastapi, api]
---
# Backend API

## Overview
The FitCV backend is a FastAPI modular monolith with async processing capabilities. It provides RESTful APIs for all frontend functionality including authentication, CV processing, job management, and HR features.

## Main Entry Point
- **File**: `/backend/app/main.py`
- **Purpose**: FastAPI application initialization, middleware setup, route registration, and lifespan management. Includes logging initialization and inbound replies feature flag check.

## Core Architecture

### Application Lifecycle
- **Lifespan Manager**: Handles startup/shutdown events including AI worker initialization
- **AI Worker**: Background task processor for AI-intensive operations (CV analysis, matching, etc.)
- **Middleware**: CORS, authentication guards, and other HTTP middleware

### Module Organization
The backend follows a clean architectural pattern with separation of concerns:

#### Core (`/backend/app/core/`)
- **Configuration**: `/backend/app/core/config.py` - Application settings and environment variables
- **Security**: `/backend/app/core/security.py` - Password hashing, JWT token handling
- **Google Auth**: `/backend/app/core/google_auth.py` - Google OAuth2 integration

#### Database (`/backend/app/db/`)
- **Session**: `/backend/app/db/session.py` - Database session management

#### Models (`/backend/app/models/`)
SQLAlchemy models representing database tables:
- `account.py` - User accounts and authentication
- `analyzer.py` - CV analysis results and data
- `application.py` - Job applications
- `email_workflow.py` - Automated email tracking, campaigns, and smart replies
- `improvement.py` - CV improvement suggestions
- `jobs.py` - Job postings
- `platform.py` - Platform-wide settings
- Additional models for pipeline, profiles, reports, etc.

#### Schemas (`/backend/app/schemas/`)
Pydantic models for request/response validation:
- Corresponding schema files for each model (e.g., `auth.py`, `jobs.py`, `cv_ranking.py`)

#### Services (`/backend/app/services/`)
Business logic layer:
- `auth_service.py` - Authentication and user management
- `matching_service.py` / `match_engine.py` - CV-JD matching algorithms
- `cv_rebuild/` - CV rebuilding and template processing
- `analyzer_service.py` - CV analysis functionality
- `job_extraction_service.py` - Job description parsing
- `improvement_service.py` - CV improvement generation
- `email_service.py` - Email sending and templating
- `ai_worker.py` - Background AI task processing
- Additional services for pipeline, profiles, reports, etc.

#### Repositories (`/backend/app/repositories/`)
Data access layer:
- CRUD operations for each model
- Query building and data filtering
- Transaction management

#### API Routes (`/backend/app/api/routes/`)
REST endpoint definitions:
- `auth.py` - Login, registration, Google OAuth, password reset
- `jobs.py` - Job posting CRUD, search, filtering
- `applications.py` - Application submission and tracking
- `analyzer.py` - CV analysis endpoints
- `cv_rebuild.py` - CV rebuilding and improvement
- `cv_ranking.py` - CV ranking against job descriptions
- `pipeline.py` - Recruitment pipeline management
- `profile.py` - User profile management
- `reports.py` - Analytics and reporting endpoints
- `email_workflow.py` - Automated email workflows, campaigns, and smart replies
- `improvements.py` - CV improvement suggestions
- `job_search.py` - Advanced job search functionality
- `ai_tasks.py` - Background AI task management
- `email_webhooks.py` - Email event webhooks

#### Dependencies (`/backend/app/api/deps.py`)
- Database session dependency
- Current user authentication
- Permission checking utilities

#### Middleware (`/backend/app/middleware/`)
- `auth_guard.py` - Authentication and authorization middleware

## Key Features

### Authentication System
- Email/password registration and login
- Google OAuth2 integration
- Role-based access control (Student, HR, Admin, etc.)
- JWT-based stateless authentication
- Password reset via 6-digit verification codes

### CV Processing Pipeline
1. **Upload & Parsing**: Document parsing service extracts text from CV files
2. **Analysis**: AI-powered analysis against job descriptions using Gemini/OpenAI
3. **Matching**: Semantic similarity scoring between CV and JD
4. **Improvement Suggestions**: AI-generated recommendations for CV enhancement
5. **Rebuilding**: Template-based CV regeneration with improved content

### Job & Application Management
- Job posting creation with rich text support
- Advanced search and filtering capabilities
- Application tracking with status updates
- Recruitment pipeline management (stages: applied → screening → interview → offer → hired)

### HR Functionality
- CV ranking and batch processing
- Automated email workflows for candidate communication
- Reporting and analytics dashboard
- Pipeline visualization and management

### Background Processing
- AI Worker service for asynchronous heavy lifting
- Task queue for CV analysis, matching, and report generation
- Configurable worker enabling/disabling via settings

## File Upload Handling
- **Storage Directory**: `/backend/uploads/` (configured via `settings.upload_dir`)
- **Static Mount**: Served at `/uploads` endpoint for file access
- **Supported Formats**: PDF, DOCX, TXT for CV processing
- **Template Files**: CV template at `/backend/app/templates/cv_template.html`

## Related Systems
- **Frontend**: Consumes all backend APIs via `/src/services/` and `/src/api/`
- **Database**: Persists all application data through SQLAlchemy models
- **Authentication**: Integrated throughout via dependencies and middleware

## Focused Tests
- **Location**: `/backend/tests/` directory
- **Test Types**: Unit tests for services, integration tests for APIs
- **Framework**: pytest with asyncio support

## Validation Commands
- **Backend Development**: 
  ```bash
  # From backend directory
  uvicorn app.main:app --reload
  ```
- **Testing**:
  ```bash
  pytest
  ```
- **Linting**: (if configured)
  ```bash
  flake8 or pylint
  ```
- **Type Checking**:
  ```bash
  mypy app/
  ```

## Change Navigation
When modifying the backend:
- **API Changes**: Update route files in `/backend/app/api/routes/`
- **Business Logic**: Modify services in `/backend/app/services/`
- **Data Models**: Update models in `/backend/app/models/` and corresponding schemas
- **Database Queries**: Adjust repository methods in `/backend/app/repositories/`
- **Authentication**: Modify `/backend/app/core/security.py`, `/backend/app/core/google_auth.py`, or auth routes
- **Configuration**: Update `/backend/app/core/config.py` and environment variables
- **Background Tasks**: Adjust AI worker in `/backend/app/services/ai_worker.py` or task routes
- **File Handling**: Check upload configuration and static file serving in main.py
