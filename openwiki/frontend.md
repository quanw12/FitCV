---
type: system
title: Frontend Application
description: React 19 + Vite frontend with Tailwind CSS providing the user interface for FitCV platform.
tags: [frontend, react, vite, tailwind]
---
# Frontend Application

## Overview
The FitCV frontend is a React 19 application built with Vite and styled with Tailwind CSS v4. It provides the user interface for both job seekers and HR professionals, featuring multiple screens for CV analysis, job search, application tracking, and HR dashboard functionalities.

## Entry Point
- **Main Entry Point**: `/src/main.tsx` - React 19 + Vite bootstrap
- **Root App Component**: `/src/app/App.tsx` - Application shell and routing

## Key Components

### Screens (User Interface)
Located in `/src/ui/screens/`:
- **Authentication**: `AuthScreen.tsx` - Login, registration, Google sign-in, role selection
- **Analyzer**: `AnalyzerScreen.tsx` - CV analysis against job descriptions
- **CV Builder/Rebuild**: `CVReBuildScreen.tsx` - CV creation and improvement
- **Job Search**: `JobSearchScreen.tsx` - Search and filter job postings
- **Job Posts**: `JobPostsScreen.tsx` - View and manage job listings (HR)
- **CV Ranking**: `CVRankingScreen.tsx` - Rank CVs against job descriptions (HR)
- **Auto Email**: `AutoEmailScreen.tsx` - Automated email workflows (HR)
- **Application Tracker**: 
  - `FitCVApplicationTracker.tsx` - HR view of applications
  - `PersonalApplicationTracker.tsx` - Job seeker view of applications
  - `AppTrackerScreen.tsx` - General application tracking
- **Pipeline**: `PipelineScreen.tsx` - HR recruitment pipeline management
- **Reports**: `ReportsScreen.tsx` - Analytics and reporting
- **Improvement Suggestions**: `ImprovementScreen.tsx` - CV improvement recommendations
- **HR Dashboard**: `HRDashboard.tsx` - HR overview and metrics
- **Public Job Viewing**: `PublicJobScreen.tsx` - Public access to job postings
- **JD Library**: `JDLibraryScreen.tsx` - Job description library management

### Components
Reusable UI components in `/src/ui/components/`:
- Layout components (headers, footers, sidebars)
- Form components (inputs, selects, buttons)
- Data display components (tables, cards, lists)
- Modal and dialog components
- Notification and toast components

### Services
API service layer in `/src/services/`:
- `authValidation.ts` - Authentication validation logic
- `theme.ts` - Theme initialization and management
- Other service modules for API interactions

### API Layer
API client functions in `/src/api/`:
- `authApi.ts` - Authentication endpoints
- `analyzerApi.ts` - CV analysis endpoints
- `cvApi.ts` - CV management endpoints
- `jobApi.ts` - Job posting endpoints
- `applicationApi.ts` - Application management endpoints
- Additional API modules for other features

### Types
TypeScript type definitions in `/src/types/`:
- `auth.ts` - Authentication-related types
- `cv.ts` - CV and profile types
- `job.ts` - Job posting and application types
- `api.ts` - API response types
- Domain-specific types for various features

### State/Data Management
Data layer in `/src/data/`:
- State management utilities
- Data transformation and formatting functions
- Local storage helpers

### Static Assets
- **HTML Template**: `/index.html` - Base HTML file with root div and Vite script imports
- **Global Styles**: `/src/index.css` - Tailwind CSS v4 configuration and custom utility classes
- **Public Directory**: `/public/` - Fonts and other static assets served by Vite

### Real-Time Communication
WebSocket connection attempt in `LandingScreen.tsx` (referenced in skeleton) for real-time analyzer updates, connecting to `ws://{location.host}`.

## Related Systems
- **Backend API**: Communicates with `/backend` via REST API calls
- **Authentication System**: Integrates with backend auth endpoints and Google OAuth
- **CV Processing**: Uses analyzer and CV rebuild services from backend
- **Job Management**: Interacts with job and application backend services

## Focused Tests
- Component tests in `/src/test/` (Vitest)
- Specific test files mentioned in skeleton: `/src/app/App.test.tsx`

## Validation Commands
- **Frontend Development**: `npm run dev` (starts Vite dev server)
- **Frontend Build**: `npm run build` (creates production build)
- **Frontend Preview**: `npm run preview` (previews production build)
- **Linting**: (if configured) `npm run lint`
- **Type Checking**: `npm run type-check` or via `tsc`

## Change Navigation
When modifying the frontend:
- **UI Changes**: Edit relevant screen/component in `/src/ui/`
- **API Integration**: Update service calls in `/src/services/` or `/src/api/`
- **Type Changes**: Modify types in `/src/types/`
- **State Logic**: Update data utilities in `/src/data/`
- **Styling**: Adjust Tailwind classes or `/src/index.css`
- **Authentication Flow**: Modify `AuthScreen.tsx` and related auth services