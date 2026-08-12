---
type: Architecture
title: Authentication System
description: User authentication, authorization, and session management in the FitCV application.
tags: [auth, authentication, authorization, security]
---

# Authentication System

FitCV implements a secure authentication system with multiple login methods, role-based access control, and session management using JWT and refresh tokens.

## Overview

The authentication system supports:
- Email/password registration and login
- Google OAuth sign-in
- Role selection (Student, HR, HiringManager, Admin)
- Password reset via 6-digit verification code
- Session management with short-lived access tokens and long-lived refresh tokens
- Role-based access control for different portal views

## Technology Stack

- **Authentication**: JWT (JSON Web Tokens) for access tokens
- **Refresh Tokens**: Stored in HttpOnly cookies
- **Password Hashing**: bcrypt or similar (inferred from security practices)
- **OAuth**: Google Identity Services for Google sign-in
- **Rate Limiting**: Database-backed rate limiting for auth endpoints
- **Session Idle Timeout**: 60 minutes of inactivity

## File Organization

Authentication-related code is spread across the backend:
- `backend/app/api/auth.py` - Auth API endpoints
- `backend/app/services/auth_service.py` - Authentication business logic (inferred)
- `backend/app/core/security.py` - Security utilities, token creation/validation (inferred)
- `backend/app/middleware/` - Authentication middleware (inferred)
- `backend/app/models/account.py` - Account model with auth fields
- `backend/app/schemas/auth.py` - Pydantic schemas for auth requests/responses

## Key Features

### User Registration and Login

**Endpoints**:
- `POST /api/auth/register` - Register a new account
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/oauth/google` - Login with Google OAuth

### Role Selection

After initial login (email/password or Google), users must select a role:
- `POST /api/auth/select-role` - Select user role (Student, HR, HiringManager, Admin)

This determines which portal the user accesses:
- **Student** -> Job Seeker portal
- **HR, HiringManager, Admin** -> HR portal

### Token Management

- **Access Token**: Short-lived, stored in `sessionStorage` (frontend)
- **Refresh Token**: Long-lived, stored in HttpOnly cookie, rotated on use
- **Logout**: `POST /api/auth/logout` - revokes session server-side
- **Session Activity**: `POST /api/auth/activity` - updates last activity timestamp to prevent idle timeout

### Password Reset

Flow using 6-digit verification code:
1. `POST /api/auth/forgot-password` - User submits email, backend generates and stores hash of 6-digit code
2. User receives code (via email or dev terminal warning)
3. `POST /api/auth/verify-reset-code` - User submits code, backend verifies hash
4. `POST /api/auth/reset-password` - User sets new password, backend deletes reset token hash

**Environment-specific behavior**:
- **Development (`ENVIRONMENT=dev`)**: If email not configured, backend logs reset code to terminal as warning
- **Production (`ENVIRONMENT=prod`)**: Requires Resend email configuration; backend refuses requests if email setup missing

### Google Sign-In

Uses Google Identity Services:
1. Frontend obtains credential from Google
2. Frontend sends credential to `/api/auth/oauth/google`
3. Backend verifies credential using `GOOGLE_CLIENT_ID`
4. **Important**: Backend does **not** use email/name from frontend; relies on verified Google token

**Google Cloud Console Configuration**:
- Add Authorized JavaScript origins:
  ```
  http://localhost:5173
  http://127.0.0.1:5173
  https://<your-vercel-domain>
  https://fit-cv.vercel.app
  ```
- If OAuth consent screen is in Testing mode, add test user emails

### Session Security

- **Idle Timeout**: Session expires after 60 minutes of no real user interaction (`SESSION_IDLE_TIMEOUT_MINUTES=60`)
- **Frontend Activity Tracking**: Frontend sends `/api/auth/activity` on pointer, keyboard, touch, or tab focus events
- **Cookie Settings**:
  - Development: `REFRESH_COOKIE_SECURE=false`
  - Production: `REFRESH_COOKIE_SECURE=true` (requires HTTPS)
  - Production cookies use `SameSite=None; Secure` for cross-site requests (Vercel frontend to Render backend)
- **Token Rotation**: Refresh token rotated on each use, absolute lifetime of 30 days (no extension)

### Rate Limiting

Auth endpoints use database-backed rate limiting to prevent brute-force attacks. Limits persist across API restarts.

### CORS Configuration

Backend accepts requests from specific origins defined in `CORS_ORIGINS` environment variable:
```env
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","https://fit-cv.vercel.app"]
```
Update this when frontend domain changes (especially important for Vercel preview deployments).

## Important Symbols and Entry Points

- **Auth Router**: `backend/app/api/auth.py` - contains all auth endpoint definitions
- **Account Model**: `backend/app/models/account.py` - includes auth-relevant fields:
  - `password_hash`
  - `role`
  - `auth_provider`
  - `reset_token_hash`
  - `reset_token_expires_at`
- **Security Utilities**: Likely in `backend/app/core/security.py` (token creation, validation, password hashing)
- **Auth Service**: Likely in `backend/app/services/auth_service.py` (business logic for auth operations)
- **Middleware**: Authentication middleware likely in `backend/app/middleware/` (e.g., for validating access tokens)

## Focused Tests

- **Auth Endpoint Tests**: Likely in `backend/tests/` directory (e.g., `test_auth.py`)
- **Token Validation**: Tests for access/refresh token creation, validation, and rotation
- **Password Reset Flow**: Tests for forgot password, verify code, and reset password endpoints
- **Google OAuth**: Tests for Google credential verification (may be mocked)
- **Rate Limiting**: Tests for auth endpoint rate limiting
- **Role-based Access**: Tests ensuring roles restrict access to appropriate endpoints

## Validation Commands

- **Health Check**: `GET /api/health` - while not auth-specific, a healthy backend is required for auth to function
- **Auth Endpoint Smoke Test**: 
  ```bash
  # Example: Test registration endpoint (replace with actual data)
  curl -X POST http://127.0.0.1:8000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "securepassword123"}'
  ```
- **Google OAuth Verification**: Requires actual Google credentials; typically tested manually or with mocks in test suite

## Change Navigation

When making authentication-related changes:

1. **Endpoint Modifications**: Edit `backend/app/api/auth.py` and update corresponding service functions
2. **Model Changes**: Edit `backend/app/models/account.py` and create migration if adding/removing fields
3. **Security Logic**: Edit security utilities (likely `backend/app/core/security.py`) and update tests
4. **Business Logic**: Edit auth service (likely `backend/app/services/auth_service.py`)
5. **Middleware Changes**: Edit authentication middleware in `backend/app/middleware/`
6. **Schema Updates**: Edit Pydantic schemas in `backend/app/schemas/auth.py` if request/response structure changes
7. **Environment Variables**: Update `backend/.env` documentation if new auth-related variables are added

Always verify changes by:
- Running the backend test suite: `python -m pytest tests -q` (after installing requirements-dev.txt)
- Testing auth endpoints manually or with automated tests
- Verifying token behavior (access token expiry, refresh token rotation)
- Checking role-based access control works correctly
- Testing password reset flow in both dev and prod configurations (if possible)
- Ensuring Google OAuth still works after changes