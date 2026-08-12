---
type: Feature
title: Recruiter Pipeline and Candidate Email
description: Feature that enables recruiters to manage application pipelines and send automated emails to candidates.
tags: [feature, recruiter, pipeline, email, workflow]
---

# Recruiter Pipeline and Candidate Email

The Recruiter Pipeline and Candidate Email feature provides tools for HR, HiringManager, and Admin users to track job applicants through hiring stages and communicate with them via automated and manual emails.

## Overview

This feature consists of two main components:
1. **Recruiter Pipeline**: Track applications through stages (Applied, Screening, Interview, Offer, Hired, Rejected) with notes and history.
2. **Candidate Email Workflow**: Send, track, and manage emails to candidates, including templates, campaigns, and smart replies.

Access to these features requires the user to have the role `HR`, `HiringManager`, or `Admin`. Additionally, users can only manage applications and emails for jobs belonging to their own company.

## Recruiter Pipeline

### Stages
Applications can be in one of the following stages:
- `Applied`: Candidate has submitted an application.
- `Screening`: Application is being reviewed.
- `Interview`: Candidate is in the interview process.
- `Offer`: Job offer has been extended.
- `Hired`: Candidate has accepted the offer.
- `Rejected`: Application has been rejected.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/hr/pipeline` | Retrieve pipeline applications for the user's company, with optional filters. |
| `PATCH` | `/api/hr/pipeline/applications/{application_id}/stage` | Update the stage of a specific application. |
| `GET` | `/api/hr/pipeline/applications/{application_id}/notes` | Get notes for a specific application. |
| `POST` | `/api/hr/pipeline/applications/{application_id}/notes` | Add a note to a specific application. |
| `GET` | `/api/hr/pipeline/applications/{application_id}/history` | Get the stage history of a specific application. |

### Features
- **Notes**: Recruiters can add notes to applications at any stage.
- **History**: Each stage change is recorded in the application's history.
- **Company Scoping**: Only applications from jobs belonging to the recruiter's company are accessible.

## Candidate Email Workflow

This feature allows recruiters to send emails to candidates, track their status, and use templates and campaigns for efficiency.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/hr/emails/templates` | Get email templates. |
| `GET` | `/api/hr/emails/drafts` | Get email drafts. |
| `GET` | `/api/hr/emails/audience?stage={stage}&job_id={job_id}` | Get the audience (candidates) for a specific stage and job. |
| `POST` | `/api/hr/emails/campaigns` | Create an email campaign. |
| `POST` | `/api/hr/emails/drafts/generate` | Generate an email draft using AI (Gemini). |
| `PATCH` | `/api/hr/emails/drafts/{email_id}` | Update an email draft. |
| `POST` | `/api/hr/emails/drafts/{email_id}/approve` | Approve a draft for sending. |
| `POST` | `/api/hr/emails/drafts/{email_id}/reopen` | Reopen an approved draft for editing. |
| `POST` | `/api/hr/emails/drafts/{email_id}/send` | Send an approved email draft. |
| `POST` | `/api/hr/emails/bulk-send` | Send multiple approved email drafts (used for campaigns). |
| `GET` | `/api/hr/emails/threads` | Get email threads (for smart replies). |
| `GET` | `/api/hr/emails/threads/{thread_id}` | Get a specific email thread. |
| `PATCH` | `/api/hr/emails/threads/{thread_id}/read` | Mark a thread as read. |
| `POST` | `/api/hr/emails/threads/{thread_id}/smart-reply` | Generate a smart reply for a thread (requires HR approval to send). |
| `POST` | `/api/hr/emails/threads/smart-reply/batch` | Generate smart replies for multiple threads. |
| `POST` | `/api/webhooks/email/resend` | Webhook endpoint for Resend email events (inbound and delivery). |

### Email Lifecycle
An email goes through the following states:
1. `Draft`: Initially created (manually or via AI generation).
2. `Approved`: Reviewed and approved by HR for sending.
3. `Sent`: Successfully sent to the candidate.

Drafts that are not approved cannot be sent. If sending fails, the email can be reopened, edited, and re-approved for another attempt.

### Smart Reply
The Smart Reply feature allows HR to generate AI-suggested replies to candidate emails:
1. Candidate replies to a recruiter's email (sent via FitCV with a unique Reply-To).
2. Resend sends an inbound webhook to `/api/webhooks/email/resend`.
3. FitCV retrieves and sanitizes the email body, verifies the sender matches the candidate's email.
4. Gemini generates a reply based on the application and conversation context.
5. HR reviews, edits, approves, and sends the reply (backend never auto-sends AI replies).

### Configuration
The email workflow requires configuration in `backend/.env` for Resend:
```env
RESEND_API_KEY=<server-side-key>
RESEND_FROM_EMAIL=Recruiting <recruiting@verified-sender-domain>
RESEND_WEBHOOK_SECRET=<whsec-from-resend-webhook>
RESEND_INBOUND_DOMAIN=replies.example.com
RESEND_TIMEOUT_SECONDS=15
RESEND_MAX_RETRIES=2
```

> **Important**: 
> - The `RESEND_FROM_EMAIL` domain must be verified in Resend (cannot use `*.vercel.app` or `gmail.com`).
> - To receive replies, configure MX records for the inbound subdomain and set up the webhook URL in Resend.
> - The webhook secret must match the one set in Resend for the `email.received` event.

### Reliable Email Delivery
To handle temporary email sending failures, the system includes:
- `retryable`: Flag indicating if an email should be retried on failure.
- `retry_count`: Number of retry attempts made.
- `last_attempt_at`: Timestamp of the last sending attempt.

Emails that fail due to configuration issues (e.g., invalid API key) are marked as non-retryable and require manual intervention (Reopen → Approve → Send) after fixing the configuration.

## Usage Flow (HR/HiringManager/Admin)

### Managing the Pipeline
1. View applications in the pipeline via `GET /api/hr/pipeline`.
2. Update an application's stage (e.g., from `Applied` to `Screening`) using the PATCH endpoint.
3. Add notes to an application for context.
4. Review the stage history to see how an application has progressed.

### Sending Emails
1. **Option A (Manual Draft)**:
   - Create a draft via the email drafting interface (likely calls `POST /api/hr/emails/drafts` indirectly).
   - Edit the draft as needed.
   - Send for approval (`POST /api/hr/emails/drafts/{email_id}/approve`).
   - Send the approved draft (`POST /api/hr/emails/drafts/{email_id}/send`).

2. **Option B (AI-Generated Draft)**:
   - Generate a draft using Gemini (`POST /api/hr/emails/drafts/generate` with context like stage and job).
   - Review and edit the AI-generated draft.
   - Approve and send as above.

3. **Option C (Campaign)**:
   - Create a campaign for a stage and job (`POST /api/hr/emails/campaigns`).
   - The system generates drafts for the audience (candidates in that stage for the job).
   - Approve and send the drafts in bulk (`POST /api/hr/emails/bulk-send`).

### Handling Replies (Smart Reply)
1. Ensure the email was sent with a unique Reply-To (FitCV does this automatically).
2. When a candidate replies, Resend sends a webhook to `/api/webhooks/email/resend`.
3. FitCV processes the inbound email and stores it in a thread.
4. To generate a smart reply:
   - Call `POST /api/hr/emails/threads/{thread_id}/smart-reply` to get an AI suggestion.
   - HR reviews, edits, and approves the suggestion.
   - Send the reply via `POST /api/hr/emails/drafts/{email_id}/send` (the smart reply is saved as a draft first).

## Important Notes
- **Company Scoping**: All pipeline and email operations are scoped to the recruiter's company (via `company_id` in the job and application).
- **Email Content**: Candidate emails should never be used as model instructions; all AI-generated content is reviewed by HR before sending.
- **Webhook Security**: The Resend webhook endpoint verifies the request signature using `RESEND_WEBHOOK_SECRET` and the raw request body.
- **Rate Limiting**: Email sending may be subject to Resend rate limits; the system includes retry logic for temporary failures.
- **Template Placeholders**: Email templates use placeholders that are replaced with candidate-specific data (only allowed placeholders are substituted).

## Focused Tests
- **Unit Tests**: Likely include tests for pipeline stage updates, email drafting, sending, and webhook handling.
- **Integration Tests**: May test the full email lifecycle from draft to send, and the smart reply flow.

## Validation Commands
- **Endpoint Test**: After setting up the backend, test the pipeline endpoint (requires auth):
  ```bash
  curl -X GET 'http://127.0.0.1:8000/api/hr/pipeline' \
    -H "Authorization: Bearer <access_token>"
  ```
  Replace `<access_token>` with a token for an HR, HiringManager, or Admin user.

- **Email Health**: There is no specific email health endpoint, but the backend health check (`/api/health`) indicates overall system health.

## Change Navigation
When making changes related to the Recruiter Pipeline and Candidate Email:

1. **Pipeline Endpoints**: Edit `backend/app/api/hr/pipeline.py` (or similar) and update the service layer.
2. **Email Endpoints**: Edit `backend/app/api/hr/email.py` (or similar) and update the service layer.
3. **Webhook Handler**: Edit the Resend webhook handler in `backend/app/api/webhooks/email.py` (or similar).
4. **Business Logic**: Edit services in `backend/app/services/` related to pipeline and email.
5. **Database Model**: If changing pipeline or email-related tables, edit models in `backend/app/models/` and create a migration.
6. **Schema**: Update Pydantic schemas in `backend/app/schemas/` for pipeline and email if request/response structure changes.
7. **AI Integration**: If modifying smart reply or draft generation, update the Gemini prompt and response handling.
8. **Configuration**: If adding new email-related environment variables, update the documentation in `backend/.env` and ensure they are loaded.

Always verify changes by:
- Running the backend test suite: `python -m pytest tests -q` (after installing requirements-dev.txt).
- Testing the pipeline and email endpoints manually with appropriate roles.
- Verifying that stage transitions and notes work correctly.
- Testing email draft generation, approval, and sending.
- Checking that the webhook endpoint properly handles inbound emails and delivery events.
- Ensuring that company scoping is respected (users can only see their company's data).
- Confirming that smart replies are generated correctly and require HR approval before sending.