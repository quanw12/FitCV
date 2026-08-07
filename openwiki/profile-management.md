---
type: system
title: Profile Management
description: User profile management system for both job seekers and HR professionals, including personal information, CV management, and application history.
tags: [profile, user-management, settings]
---
# Profile Management

## Overview
FitCV's profile management system allows users to maintain their personal information, manage their CVs, view application history, and configure account settings. The system serves both job seekers (Students) and HR professionals with role-appropriate features.

## Core Components

### Backend Routes
- **Profile Routes**: `/backend/app/api/routes/profile.py` - Profile CRUD operations and settings management

### Services
- **Profile Service**: `/backend/app/services/profile_service.py` - Business logic for profile operations
- **Avatar Storage Service**: `/backend/app/services/avatar_storage.py` - Profile image upload and storage

### Repositories
- **Profile Repository**: `/backend/app/repositories/profiles.py` - Data access for profile operations
- **Account Repository**: `/backend/app/repositories/accounts.py` - Account data access (overlaps with auth)
- **CV Repository**: `/backend/app/repositories/cv.py` - CV data access (for profile CV management)
- **Application Repository**: `/backend/app/repositories/applications.py` - Application history data

### Frontend Components
- **Profile Screen**: `/src/ui/screens/ProfileScreen.tsx` - Main profile viewing and editing interface
- **CV Management**: Integrated within profile for viewing and managing uploaded CVs
- **Application History**: View past applications and their statuses
- **Settings**: Account preferences, notifications, and security settings

## Profile Data Structure

### Core Profile Information
- **Basic Details**: Full name, email (readonly), phone number, date of birth
- **Professional Info**: Current position, company, years of experience, industry
- **Location**: Current location, willingness to relocate, remote work preference
- **Links**: Portfolio URL, LinkedIn, GitHub, other professional profiles
- **Summary/Bio**: Professional summary or bio section
- **Skills**: Self-assessed skills list (complements CV-extracted skills)
- **Languages**: Language proficiency with levels
- **Certifications**: Professional certificates and licenses
- **Education**: Educational background (complements CV education)
- **Availability**: Availability date for new positions, notice period

### Role-Specific Fields

#### For Students (Job Seekers)
- **Career Goals**: Desired position type, industry preferences, salary expectations
- **Job Search Preferences**: Employment types, locations, remote/hybrid preferences
- **Application Settings**: Auto-apply settings, notification preferences
- **CV Management**: Uploaded CVs list with versions, latest indicator
- **Application History**: 
  - Internal applications (through FitCV jobs)
  - External applications (tracked applications)
  - Status breakdown and timeline
- **Skill Assessment**: Self-rated skill levels, skill gap analysis (from CV improvements)

#### For HR/HiringManager/Admin
- **Company Information**: Associated company, role within company
- **Recruitment Preferences**: Industries recruited for, positions typically hired
- **HR Settings**: Notification preferences, email signature, default email templates
- **Team Management**: (For Admin) Team member management permissions
- **Recruitment Stats**: Personal recruitment metrics (jobs posted, hires made, etc.)
- **Saved Searches**: Frequently used job search criteria
- **Templates**: Saved job description templates, email templates

### Account Integration
- **Auth Link**: Profile linked to `account` table via account_id
- **Role Awareness**: Profile displays and enables features based on user role
- **Avatar**: Profile image stored separately with URL reference in account
- **Preferences**: Notification, privacy, and UI preferences stored in profile or settings

## Profile Operations

### Profile Viewing
1. **Access**: User navigates to profile screen from navigation menu
2. **Loading**: System fetches profile data based on authenticated user
3. **Display**: Information organized in sections with edit capabilities
4. **Role-Based Views**: Different sections shown based on user role (Student vs HR)

### Profile Editing
1. **Edit Mode**: User clicks edit button to modify fields
2. **Field Validation**: 
   - Required field validation (name, etc.)
   - Format validation (email, phone, URLs)
   - Length and content limits
3. **Real-time Feedback**: Inline validation as user types
4. **Save Operation**: 
   - PATCH request to update only changed fields
   - Optimistic UI update with rollback on failure
   - Success/error messaging

### CV Management within Profile
- **CV List**: Display of all uploaded CVs with:
  - File name and type
  - Upload date
  - Version number
  - Latest version indicator
  - File size
  - Actions (view, download, delete, set as latest)
- **Upload**: Drag-and-drop or file picker for new CV upload
- **Versioning**: Automatic version increment on new upload
- **Latest Selection**: Ability to mark any version as the latest for applications
- **Deletion**: Soft delete or hard delete based on business rules
- **Preview**: Ability to view CV content (if parsed) or download original

### Application History
- **Internal Applications**:
  - List of applications submitted through FitCV
  - Job title, company, application date
  - Current stage and status
  - CV version used
  - Match score (if available)
  - Actions (view details, withdraw, etc.)
- **External Applications** (Tracked):
  - Manually entered applications outside FitCV
  - Company, position, application date
  - Source (job board, company site, referral, etc.)
  - Current status
  - Reminders and notes
  - Last activity timestamp
- **Timeline View**: Chronological view of all application activities
- **Statistics**: Application counts by status, success rates, etc.

### Settings Management
- **Notification Preferences**:
  - Email notifications for application updates
  - Email notifications for messages
  - Push notifications (if implemented)
  - Frequency and timing preferences
- **Privacy Settings**:
  - Profile visibility to recruiters
  - Data sharing preferences
  - CV visibility settings
- **Security Settings**:
  - Password change
  - Two-factor authentication setup (if implemented)
  - Active sessions management
  - Connected apps/services
- **Account Management**:
  - Account deletion request
  - Data export request (GDPR compliance)
  - Subscription/billing info (if applicable)

## Data Models & Relationships

### Core Entities
```
Account ←→ Profile (one-to-one)
Account ←→ CV (one-to-many)
Account ←→ Application (one-to-many, as candidate)
Account ←→ Tracked Application (one-to-many)
Profile ←→ CV (denormalized for quick access)
Profile ←→ Application History (view)
```

### Key Tables

#### Account Table (from auth system)
- Extended with profile-relevant fields:
  - avatar_url (for profile image)
  - role (determines profile features)
  - company_id (for HR users)
  - full_name (display name)

#### Profile Table (Conceptual - may be extensions of account or separate)
- **Basic Info**: phone, date_of_birth, location, willing_to_relocate, remote_preference
- **Professional**: current_position, current_company, years_experience, industry
- **Links**: portfolio_url, linkedin_url, github_url, other_links
- **Bio**: professional_summary
- **Skills & Languages**: JSON arrays for self-assessed skills and language proficiency
- **Certifications & Education**: JSON arrays for certifications and educational background
- **Preferences**: notification_settings, privacy_settings, ui_preferences (JSON)
- **Timestamps**: created_at, updated_at

#### CV Table (from CV processing system)
- Links to account for ownership
- Version history for tracking CV evolution
- File metadata for management within profile

#### Application Tables
- Links show application history for the user
- Includes both internal (FitCV) and external (tracked) applications

## Focused Tests

### Backend Tests (`/backend/tests/`)
- **Profile Service Tests**:
  - Profile creation and retrieval
  - Field validation and sanitization
  - Update operations (partial and full)
  - Role-based field access control
  - Avatar upload and storage integration
- **Avatar Storage Service Tests**:
  - File type validation (image only)
  - Size limits enforcement
  - Storage and retrieval operations
  - Thumbnail generation (if implemented)
  - CDN integration (if applicable)
- **Profile Repository Tests**:
  - CRUD operations
  - Relationship loading (account, CVs, applications)
  - Query optimization for profile views
  - Transaction handling

### Frontend Tests
- **Profile Screen Tests**:
  - Profile data loading and display
  - Edit mode toggling and field editing
  - Form validation and submission
  - CV list display and management
  - Application history viewing
  - Settings modification and saving
- **CV Management Tests** (within profile):
  - File upload handling
  - Version display and selection
  - File preview/download
  - Deletion confirmation
  - Latest version marking
- **Application History Tests**:
  - Internal application list loading
  - External application (tracked) display
  - Timeline view interaction
  - Statistics calculation and display
- **Settings Tests**:
  - Notification preference toggling
  - Privacy setting adjustments
  - Security workflows (password change, etc.)
  - Account management flows

## Validation Commands

### Backend Profile Tests
```bash
# From backend directory
# Test profile service
pytest -xvs backend/tests/test_profile_service.py

# Test avatar storage service
pytest -xvs backend/tests/test_avatar_storage.py

# Test profile repository
pytest -xvs backend/tests/test_profiles_repository.py
```

### Frontend Profile Tests
```bash
# From root directory
# Test profile screen
npm test -- src/ui/screens/ProfileScreen.test.tsx

# Test CV management within profile
# (May be part of profile screen tests or separate CV component tests)

# Test application history components
# (May be part of profile screen tests or separate)

# Test settings components
# (May be part of profile screen tests or separate)
```

### Manual Validation
```bash
# Test profile retrieval (requires auth)
curl -X GET "http://localhost:8000/profile/me" \
  -H "Authorization: Bearer <jwt_token>"

# Test profile update
curl -X PATCH "http://localhost:8000/profile/me" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+84 123 456 789",
    "current_position": "Software Engineer",
    "years_experience": 3
  }'

# Test CV upload via profile (requires auth)
curl -X POST "http://localhost:8000/profile/upload-cv" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@/path/to/sample.pdf"

# Test CV list retrieval
curl -X GET "http://localhost:8000/profile/cvs" \
  -H "Authorization: Bearer <jwt_token>"
```

## Change Navigation

### Adding New Profile Fields
1. Determine if field is account-level or profile-level (most new fields go to profile)
2. Add column to appropriate table (`account` or `profile`) via migration
3. Update SQLAlchemy model if using separate profile model
4. Update Pydantic schemas in `/backend/app/schemas/profile.py`
5. Modify route handlers in `/backend/app/api/routes/profile.py`
6. Update service layer in `/backend/app/services/profile_service.py`
7. Adjust frontend profile screen in `/src/ui/screens/ProfileScreen.tsx`
8. Update API service in `/src/api/profileApi.ts`
9. Modify types in `/src/types/profile.ts` if exists
10. Add validation rules for new field types
11. Update tests for new field persistence and validation

### Modifying Role-Based Features
1. Identify which fields or sections should be role-specific
2. Update backend service to enforce role-based field access
3. Modify frontend to conditionally display/edit sections based on user role
4. Update API responses to include/exclude fields based on role
5. Add tests for role-based access control
6. Consider impact on existing data (may need migration scripts for default values)

### Enhancing CV Management within Profile
1. Modify CV upload validation if changing accepted file types/sizes
2. Update CV listing logic if adding new metadata fields
3. Modify version management if changing versioning scheme
4. Update frontend CV list and management components
5. Adjust API endpoints if profile-specific CV operations needed
6. Update tests for CV upload, listing, versioning, and deletion
7. Consider impact on existing CVs (backward compatibility)

### Improving Application History Features
1. Extend application tracking if adding new status fields or metadata
2. Modify timeline view if adding new activity types
3. Update statistics calculations if adding new metrics
4. Enhance external application entry if adding new fields
5. Update frontend history display components
6. Adjust API endpoints if needed for new history data
7. Update tests for new history features and calculations

### Adding New Settings Categories
1. Determine storage mechanism (profile JSON field vs separate table)
2. Add storage column or table via migration
3. Update service to handle new settings category
4. Modify frontend settings UI for new category
5. Add API endpoints if needed for settings operations
6. Update types and API service for new settings
7. Add validation and default values for new settings
8. Update tests for new settings persistence and retrieval

## Related Systems
- **Authentication**: Profile is tightly coupled to account system; auth required for all profile operations
- **CV Processing**: Profile CV management uses same upload/storage mechanisms as CV processing system
- **Job Management**: Application history integrates with job management system for internal applications
- **Database**: All profile data stored in extensions of account table or separate profile table
- **Storage Services**: Avatar storage uses same infrastructure as CV file uploads
- **Notifications**: Profile notification preferences feed into notification system
- **Applications**: Both internal and external application history displayed in profile
- **Tracking**: External application tracking system provides data for profile history
- **HR Functionality**: HR users see different profile fields and metrics relevant to recruiting role

## Change Impact Summary
- **High Impact**: Changes to core profile data model, authentication integration, or CV management within profile
- **Medium Impact**: Changes to application history features, settings systems, or role-based functionality
- **Low Impact**: UI tweaks, field label changes, non-core feature additions
- **Breaking Changes**: Removing required fields or changing data types requires data migration
- **Performance Sensitive**: Profile loading with large CV lists or application histories
- **Testing Critical**: Profile changes require comprehensive test coverage due to PII handling and role-based access
