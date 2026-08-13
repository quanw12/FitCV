---
type: Feature
title: Application Tracker
description: Feature that allows students to track their job applications and status changes.
tags: [feature, application, tracker, student]
---

# Application Tracker

The Application Tracker feature enables students (users with role `Student`) to track their job applications, update application status, add notes, and view status history.

## Overview

This feature is exclusively for students and allows them to:
- Create new job applications (by applying to a job via the HR CV Ranking or Job Applicants flow)
- View a list of their applications
- Update the status of their applications
- Add notes to applications
- View the history of status changes for each application
- Receive notifications for stale applications (no updates for 30 days)

Access is restricted to the authenticated student, and students can only access their own applications.

## Key Features

### Application Statuses
Applications can be in one of the following statuses:
- `Applied`: Initial application submitted.
- `Screening`: Application is being reviewed by the employer.
- `Interview`: Candidate is in the interview process.
- `Offer`: Job offer has been received.
- `Rejected`: Application has been rejected.

> **Note**: The `Offer` and `Rejected` statuses do not trigger stale application notifications.

### Stale Application Notifications
- Applications in `Applied`, `Screening`, or `Interview` status that have not been updated for 30 days are considered stale.
- The frontend will show a warning for stale applications.
- Users can set a custom reminder date for an application; if set, the stale check uses that date instead of the 30-day default.

## API Endpoints

All endpoints require authentication and the user must have the role `Student`. Additionally, users can only access their own applications.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/applications` | Create a new application (typically called when applying to a job). |
| `GET` | `/api/applications` | Retrieve a paginated list of the user's applications. |
| `GET` | `/api/applications/stats` | Get statistics about the user's applications (counts by status). |
| `GET` | `/api/applications/{application_id}` | Retrieve details of a specific application. |
| `PATCH` | `/api/applications/{application_id}` | Update an application (e.g., change status, update other fields). |
| `DELETE` | `/api/applications/{application_id}` | Delete an application. |
| `POST` | `/api/applications/{application_id}/notes` | Add a note to an application. |
| `PATCH` | `/api/applications/{application_id}/notes/{note_id}` | Update a note on an application. |
| `DELETE` | `/api/applications/{application_id}/notes/{note_id}` | Delete a note from an application. |

## Usage Flow (Student)

1. **Apply to a Job**:
   - When a student applies to a job (via the HR CV Ranking or Job Applicants flow), the backend creates an application record via `POST /api/applications`.
   - The initial status is typically `Applied`.

2. **View Applications**:
   - Use `GET /api/applications` to see a list of all applications.
   - Use `GET /api/applications/stats` to see a summary (e.g., how many applications are in each status).

3. **Update Application Status**:
   - As the application progresses, update the status using `PATCH /api/applications/{application_id}`.
   - For example, change from `Applied` to `Screening` when the employer starts reviewing.

4. **Add Notes**:
   - Add notes to an application for personal reminders or to record information from interactions with the employer.
   - Use `POST /api/applications/{application_id}/notes` to add a note.
   - Edit or delete notes as needed.

5. **View History**:
   - Each status change is recorded in the application's history.
   - Retrieve the history with `GET /api/applications/{application_id}/history`.

6. **Handle Stale Applications**:
   - If an application in `Applied`, `Screening`, or `Interview` has no updates for 30 days, the frontend will show a warning.
   - To reset the stale timer, update the application (e.g., add a note or change status) or set a custom reminder date.

## Important Notes
- **Data Isolation**: Students can only access their own applications. The backend enforces this by filtering by the authenticated user's ID.
- **Status Changes**: Every status change is recorded in the application's history, providing an audit trail.
- **Notes**: Notes are optional and can be used for any purpose the student desires (e.g., interview preparation, follow-up dates).
- **Deletion**: Applications can be deleted, but this action is typically irreversible (consider archiving instead if the feature existed).

## Configuration
The feature requires the following database migrations to be run:
- `database/migrations/004_add_application_tracker.sql`
- `database/migrations/008_add_application_notifications.sql`

> **Note**: If creating a new database from `database/full_schema.sql`, these tables are already included and the migrations are not required.

## Focused Tests
- **Unit Tests**: Likely include tests for application creation, status updates, note management, and data isolation.
- **Integration Tests**: May test the full lifecycle of an application from creation to status changes and notes.

## Validation Commands
- **Endpoint Test**: After setting up the backend and frontend, test as a student:
  ```bash
  # Replace <access_token> with a valid Student token
  curl -X GET 'http://127.0.0.1:8000/api/applications' \
    -H "Authorization: Bearer <access_token>"
  ```
  Should return an empty list or list of the student's applications.

- **Application Creation**: Test applying to a job (via the frontend or by simulating the backend call that occurs when applying).

## Change Navigation
When making changes related to the Application Tracker:

1. **Endpoint Changes**: Edit `backend/app/api/applications.py` (or similar) and update the service layer.
2. **Business Logic**: Edit the service responsible for application operations (likely in `backend/app/services/`).
3. **Database Model**: If changing application-related fields, edit `backend/app/models/application.py` and create a migration.
4. **Schema**: Update Pydantic schemas in `backend/app/schemas/application.py` if request/response structure changes.
5. **Notifications**: If modifying stale application logic, check the backend service and any related notification mechanisms.
6. **Frontend Integration**: If the API contract changes, update the frontend service calls in `src/api/` or `src/services/`.

Always verify changes by:
- Running the backend test suite: `python -m pytest tests -q` (after installing requirements-dev.txt).
- Testing the endpoints manually with a student account.
- Verifying that students can only access their own applications.
- Checking that status transitions and history recording work correctly.
- Ensuring that notes can be added, updated, and deleted.
- Confirming that stale application detection functions as expected (if applicable).