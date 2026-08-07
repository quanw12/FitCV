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
- **Main Entry Point**: `/backend/app/api/routes/auth.py` - Handles all authentication endpoints
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

### Roles
- **Student**: Job seekers who upload CVs, apply for jobs, track applications
- **HR**: Recruiters who manage jobs, screen CVs, communicate with candidates
- **HiringManager**: Managers who review applications, make hiring decisions
- **Admin**: System administrators with full access

### Role Enforcement
- **Backend**: Route-level dependencies in `/backend/app/api/deps.py` check user role
- **Frontend**: Route guards and UI component visibility based on user role
- **Database**: Account.role field stores ENUM value with proper constraints

## Security Features

### Rate Limiting
- Implemented via `auth_rate_limit` table
- Tracks failed login attempts by email/IP
- Temporary blocking after threshold exceeded
- Configurable window and attempt limits

### Session Management
- Refresh tokens stored as hashes in database (never plain text)
- Access tokens are short-lived JWTs
- Refresh token rotation on use (optional)
- Manual revocation via logout (sets revoked_at timestamp)
- Automatic cleanup of expired sessions

### Password Security
- bcrypt hashing with configurable salt rounds
- Password strength validation (length, complexity)
- Secure password reset with time-limited tokens
- No password logging or exposure in error messages

### Token Security
- JWT access tokens signed with strong secret
- Short expiration (15-30 minutes recommended)
- Refresh tokens stored securely, rotated on use
- HTTPS enforced in production
- CSRF protection for state-changing operations

## API Endpoints

### Auth Routes (`/backend/app/api/routes/auth.py`)
- `POST /auth/register` - User registration
- `POST /auth/login` - Email/password login
- `POST /auth/google` - Google OAuth callback
- `POST /auth/refresh-token` - Token refresh
- `POST /auth/verify-email` - Email verification
- `POST /auth/forgot-password` - Initiate password reset
- `POST /auth/reset-password` - Complete password reset
- `POST /auth/logout` - Invalidate refresh token
- `GET /auth/me` - Get current user profile

## Frontend Integration

### Auth Context
- React context for managing auth state across application
- Provides current user, login/logout functions, role checking

### Protected Routes
- Route wrappers that redirect unauthenticated users to login
- Role-based route protection for admin/HR-only sections

### API Service Layer
- Automatic token attachment to requests
- Token refresh on 401 responses
- Error handling for auth failures

## Data Models

### Account Model (`/backend/app/models/account.py`)
```python
class Account(Base):
    __tablename__ = "account"
    
    account_id = Column(BigInteger, primary_key=True, index=True)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)  # Null for Google-only users
    full_name = Column(String(150), nullable=False)
    role = Column(ENUM('Student', 'HR', 'HiringManager', 'Admin'), nullable=True)
    avatar_url = Column(String(400), nullable=True)
    company_id = Column(BigInteger, ForeignKey("company.company_id"), nullable=True)
    auth_provider = Column(ENUM('Password', 'Google'), nullable=False, default='Password')
    reset_token_hash = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=True, onupdate=func.now())
```

### Auth Session Model
```python
class AuthSession(Base):
    __tablename__ = "auth_session"
    
    session_id = Column(String(36), primary_key=True)  # UUID
    account_id = Column(BigInteger, ForeignKey("account.account_id"), nullable=False)
    refresh_token_hash = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=func.now())
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(String(50), nullable=True)
```

## Focused Tests

### Backend Tests (`/backend/tests/`)
- **Auth Service Tests**: Unit tests for auth_service.py functions
- **Auth Route Tests**: Integration tests for auth endpoints
- **Security Tests**: Password hashing, token generation validation
- **Rate Limiting Tests**: Attempt tracking and blocking behavior
- **Google OAuth Tests**: Mock OAuth flow validation

### Frontend Tests (`/src/test/` or `/src/ui/screens/__tests__/`)
- **AuthScreen Tests**: Form validation, submission handling
- **Auth Service Tests**: API call mocking, token storage
- **Route Protection Tests**: Redirect behavior for unauthenticated/role-restricted access

## Validation Commands

### Backend Auth Tests
```bash
# From backend directory
pytest -xvs backend/tests/test_auth_service.py
pytest -xvs backend/tests/test_auth_routes.py
pytest -xvs backend/tests/test_security.py
```

### Frontend Auth Tests
```bash
# From root directory
npm test -- src/ui/screens/AuthScreen.test.tsx
npm test -- src/services/authValidation.test.ts
```

### Manual Validation
```bash
# Test registration endpoint
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"securepass123","full_name":"Test User","role":"Student"}'

# Test login endpoint
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"securepass123"}'
```

## Change Navigation

### Adding New Auth Providers
1. Update `auth_provider` ENUM in account model and database
2. Add provider-specific validation in `/backend/app/core/security.py` or new module
3. Extend Google auth pattern in `/backend/app/core/google_auth.py`
4. Add route handler in `/backend/app/api/routes/auth.py`
5. Update frontend AuthScreen to include new provider button
6. Add corresponding types in `/src/types/auth.ts`
7. Update auth service methods in `/backend/app/services/auth_service.py`
8. Add tests for new provider flow

### Modifying Role System
1. Update role ENUM in account model and database migration
2. Modify role-checking dependencies in `/backend/app/api/deps.py`
3. Update frontend role constants and checks in `/src/types/auth.ts` and UI components
4. Adjust route protections in frontend routing
5. Update any role-based business logic in services
6. Update tests to reflect new role structure

### Changing Token Settings
1. Modify JWT secret/expiration in `/backend/app/core/config.py` and security.py
2. Update refresh token storage/hashing if needed
3. Modify frontend token storage/handling if format changes
4. Update any token validation logic in middleware
5. Update tests with new token parameters

### Adding Security Features
1. Implement new security measure in appropriate service/core module
2. Add necessary database tables/columns via migration
3. Update API endpoints to enforce new security
4. Modify frontend to handle new security requirements
5. Add comprehensive tests for new security features
6. Update documentation and any user-facing security notices

## Related Systems
- **Backend**: All protected routes depend on authentication
- **Frontend**: UI components show/hide based on auth state and role
- **Database**: Account and auth_session tables store auth data
- **Email Service**: Used for verification and password reset emails
- **Rate Limiting**: Protects auth endpoints from abuse
- **API Services**: All services require authenticated user context
