---
type: system
title: Authentication & Authorization System
description: Complete authentication system supporting email/password, Google OAuth, role-based access control, and session management.
tags: [authentication, security, oauth, rbac]
---
# Authentication & Authorization System

## Overview
FitCV implements a comprehensive authentication system with multiple providers, role-based access control, secure session management, and rate limiting to protect user accounts.

## Core Components

### Backend Authentication
- **Main Entry Point**: `/backend/app/api/routes/auth.py` - Handles all authentication endpoints including login, registration, Google OAuth, password reset, token refresh, session activity recording, and logout.
- **Auth Service**: `/backend/app/services/auth_service.py` - Business logic for authentication operations
- **Auth Models**: `/backend/app/models/account.py` - SQLAlchemy model for user accounts
- **Auth Schemas**: `/backend/app/schemas/auth.py` - Pydantic models for request/validation
- **Email Service**: `/backend/app/services/email_service.py` - Sends verification codes and notifications
- **Security Core**: `/backend/app/core/security.py` - Password hashing, token generation, verification
- **Google Auth**: `/backend/app/core/google_auth.py` - Google OAuth2 integration

### Frontend Authentication
- **Auth Screen**: `/src/ui/screens/AuthScreen.tsx` - Login/registration interface
- **Auth Validation**: `/src/services/authValidation.ts` - Frontend auth validation helpers
- **Auth Types**: `/src/types/auth.ts` - TypeScript interfaces for auth data
- **Auth API**: `/src/api/authApi.ts` - API calls to backend auth endpoints

## Authentication Flow

### User Registration
1. User submits registration form with email, password, full name, role selection
2. Frontend validates input and calls `/api/auth/register` endpoint
3. Backend:
   - Checks if email already exists
   - Hashes password using bcrypt
   - Creates account record with `auth_provider = 'Password'`
   - Sends verification email with 6-digit code
   - Returns success response
4. User enters verification code via `/api/auth/verify-email`
5. Backend validates code and marks email as verified

### Login Flow
1. User submits email and password
2. Frontend calls `/api/auth/login`
3. Backend:
   - Validates credentials against database
   - Checks rate limiting via `auth_rate_limit` table
   - Verifies password hash
   - Generates access token (JWT) and refresh token
   - Stores refresh token hash in `auth_session` table
   - Returns tokens to frontend
4. Frontend stores tokens securely (access token in memory, refresh token in httpOnly cookie if applicable)

### Google OAuth Flow
1. User clicks "Sign in with Google"
2. Frontend redirects to Google OAuth consent screen
3. Google redirects back to backend callback endpoint
4. Backend:
   - Validates Google ID token
   - Checks if account exists with Google provider
   - If new: creates account with `auth_provider = 'Google'`
   - If existing: links Google provider to account
   - Generates and returns JWT tokens
5. Frontend receives tokens and establishes session

### Token Refresh
1. Frontend sends refresh token to `/api/auth/refresh-token`
2. Backend:
   - Validates refresh token hash against `auth_session` table
   - Checks if token is revoked or expired
   - Generates new access token
   - Returns new access token (refresh token rotation optional)
3. Frontend updates access token

### Session Idle Timeout
- **Purpose**: Automatically log out users after a period of inactivity to enhance security.
- **Implementation**: 
  - Backend: `/backend/app/services/auth_rate_limit.py` (also handles rate limiting) and `/backend/app/repositories/auth_sessions.py` track session creation and last activity.
  - Frontend: `/src/api/sessionActivity.ts` and `/src/api/authSession.ts` manage session heartbeat and timeout warnings.
  - Configuration: Timeout duration is set in `/backend/app/core/config.py` (e.g., `SESSION_IDLE_TIMEOUT_MINUTES`).
  - Tests: `/backend/tests/test_session_idle_timeout.py` verifies timeout behavior and extension on activity.

### Password Reset
1. User submits email for password reset
2. Backend:
   - Generates 6-digit reset code
   - Stores hash in `account.reset_token_hash` with expiration
   - Sends reset code via email
3. User submits reset code and new password
4. Backend:
   - Validates reset code hash and expiration
   - Updates password hash
   - Clears reset token fields
   - Returns success

## Role-Based Access Control (RBAC)
FitCV implements role-based access control to restrict system access based on user roles. The platform defines four primary roles:

### Roles
- **Student**: Job seeker role with access to CV tools, job search, application tracking, and improvement suggestions
- **HR**: Human resources role with access to job management, candidate screening, and recruitment workflows
- **HiringManager**: Role with similar permissions to HR but potentially more limited in scope
- **Admin**: Administrative role with full system access including user management and system configuration

### Role-Based Access Implementation
- **Backend**: Route protections and service layer checks validate user roles before permitting access to specific functionality
- **Frontend**: UI components conditionally render based on user role, and API calls include role validation
- **Database**: The `account.role` field stores the user's role, used for authorization checks throughout the system

### Session Idle Timeout
- **Purpose**: Automatically log out users after a period of inactivity to enhance security.
- **Implementation**: 
  - Backend: `/backend/app/services/auth_rate_limit.py` (also handles rate limiting) and `/backend/app/repositories/auth_sessions.py` track session creation and last activity.
  - Frontend: `/src/api/sessionActivity.ts` and `/src/api/authSession.ts` manage session heartbeat and timeout warnings.
  - Configuration: Timeout duration is set in `/backend/app/core/config.py` (e.g., `SESSION_IDLE_TIMEOUT_MINUTES`).
  - Tests: `/backend/tests/test_session_idle_timeout.py` verifies timeout behavior and extension on activity.