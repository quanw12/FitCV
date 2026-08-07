---
type: documentation
title: FitCV Repository Documentation Quickstart
description: Entrypoint to the FitCV repository documentation. Provides high-level overview and navigation to major systems.
tags: [repository, getting-started, navigation]
---
# FitCV Repository Documentation

FitCV is a CV screening and job matching platform using AI, serving two main user groups:
- **Students/Job Seekers**: upload CVs, analyze against job descriptions, get improvement suggestions, track applications.
- **HR/Recruiters**: manage job postings, applicant CVs, ranking, pipeline, email workflows, and reports.

## Repository Structure

The repository consists of a React 19 + Vite frontend and a FastAPI backend with SQLAlchemy and MySQL.

## Major Systems

- [Frontend Application](./frontend.md) - React 19 + Vite frontend with Tailwind CSS
- [Backend API](./backend.md) - FastAPI modular monolith with async processing
- [Database Layer](./database.md) - Schema, models, repositories, and migrations
- [Authentication & Authorization](./authentication.md) - Auth flows, Google sign-in, role-based access
- [CV Processing & Analysis Pipeline](./cv-processing.md) - Analyzer, match engine, CV rebuild, ranking, improvement reports
- [Job & Application Management](./job-management.md) - Job posts, applications, search, pipeline tracking
- [HR Functionality](./hr-functionality.md) - CV ranking, job applicant ranking, pipeline management, reports, auto email, HR dashboard
- [Profile Management](./profile-management.md) - User profile CRUD
- [Background Workers & AI Processing](./background-workers.md) - AI worker, async task processing

## Getting Started

1. **Prerequisites**: Node.js 20+, Python 3.11+, MySQL server, npm, Git
2. **Frontend Setup**:
   ```bash
   npm install
   # Create .env.local with VITE_API_BASE_URL and VITE_GOOGLE_CLIENT_ID
   npm run dev
   ```
3. **Backend Setup**:
   ```bash
   # In backend directory
   pip install -r requirements.txt
   # Set up MySQL database and update .env
   uvicorn app.main:app --reload
   ```

## Change Navigation

Use this quickstart to navigate to the relevant system documentation when making changes:
- **UI changes**: Start with [Frontend](./frontend.md)
- **API changes**: Start with [Backend API](./backend.md)
- **Data model changes**: Start with [Database Layer](./database.md)
- **Auth changes**: Start with [Authentication & Authorization](./authentication.md)
- **CV analysis changes**: Start with [CV Processing & Analysis Pipeline](./cv-processing.md)
- **Job/application changes**: Start with [Job & Application Management](./job-management.md)
- **HR features**: Start with [HR Functionality](./hr-functionality.md)
- **Profile changes**: Start with [Profile Management](./profile-management.md)
- **Background tasks**: Start with [Background Workers & AI Processing](./background-workers.md)
