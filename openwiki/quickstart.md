---
type: Documentation Homepage
title: FitCV Wiki
description: Entrypoint for the FitCV repository documentation. Provides overview and navigation to all major sections.
tags: [quickstart, navigation]
---

# FitCV Documentation

Welcome to the FitCV repository documentation. This wiki provides comprehensive information about the FitCV platform - an AI-powered CV screening and job matching platform.

## Overview

FitCV is a platform for CV screening and job suitability assessment using AI, serving two main user groups:

- **Student / Job Seeker**: Register, select role, upload CV, analyze CV against job descriptions, view improvement suggestions, CV history, and application tracker
- **HR / Recruiter / Hiring Manager / Admin**: Manage job postings, upload candidate CVs, rank applicants, manage pipelines, send emails, and generate reports

The platform consists of:
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: FastAPI + SQLAlchemy + MySQL
- **Authentication**: Register/login, Google sign-in, 4 role selection, forgot/reset password with 6-digit verification code

## Navigation

Use the links below to explore different aspects of the FitCV system:

### Core Architecture
- [Frontend Architecture](./frontend.md) - React frontend structure and setup
- [Backend Architecture](./backend.md) - FastAPI backend structure and setup
- [Database Schema](./database.md) - MySQL schema and migrations

### Key Features
- [Authentication System](./auth.md) - User registration, login, roles, and security
- [AI Improvement Suggestions](./features/ai_improvement_suggestions.md) - Generate CV improvement recommendations
- [AI Rebuild CV](./features/ai_rebuild_cv.md) - Convert CVs to standardized PDF format
- [Job Post Management](./features/job_post_management.md) - Create, manage, and archive job postings
- [Recruiter Pipeline & Email](./features/recruiter_pipeline_email.md) - Application tracking and automated email workflows
- [Application Tracker](./features/application_tracker.md) - Student job application tracking
- [CV & JD Match Analyzer](./features/cv_jd_match_analyzer.md) - CV parsing, matching, and ranking (including HR CV Ranking and Job Applicants)

### Operational Guides
<!-- openwiki: broken internal link [./setup.md] file "./setup.md" does not exist. Fix the href or restore the target, then delete this comment. -->
- [Setup & Installation](./setup.md) - Installation instructions for development and deployment
<!-- openwiki: broken internal link [./troubleshooting.md] file "./troubleshooting.md" does not exist. Fix the href or restore the target, then delete this comment. -->
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Getting Started

<!-- openwiki: broken internal link [./setup.md] file "./setup.md" does not exist. Fix the href or restore the target, then delete this comment. -->
For detailed setup instructions, see the [Setup & Installation](./setup.md) guide.

To understand how to contribute code, review the [Architecture](./frontend.md) and [Backend](./backend.md) pages which outline the code organization rules.

## Change Navigation

When making changes to the FitCV codebase:

1. **UI/Frontend changes**: Start with [Frontend Architecture](./frontend.md)
2. **Backend/API changes**: Start with [Backend Architecture](./backend.md)
3. **Database changes**: Start with [Database Schema](./database.md)
4. **Feature-specific changes**: Navigate to the relevant feature page above
<!-- openwiki: broken internal link [./setup.md] file "./setup.md" does not exist. Fix the href or restore the target, then delete this comment. -->
5. **Configuration changes**: Check [Setup & Installation](./setup.md)
<!-- openwiki: broken internal link [./troubleshooting.md] file "./troubleshooting.md" does not exist. Fix the href or restore the target, then delete this comment. -->
6. **Debugging issues**: Consult [Troubleshooting](./troubleshooting.md)

Each major section contains specific entry points, important symbols, focused tests, and validation commands for that area.