---
type: Operations Guide
title: Setup & Installation
description: Installation and setup instructions for the FitCV development environment.
tags: [setup, installation, development]
---

# Setup & Installation

This guide provides step-by-step instructions for setting up the FitCV development environment.

## Prerequisites

- Node.js 20+ (recommended)
- Python 3.11+ (recommended)
- MySQL server
- npm
- Git

## Frontend Setup

### Installation

From the repository root:

```bash
npm install
```

### Environment Variables

Create or update `.env.local` in the root directory:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

### Running the Frontend

```bash
npm run dev
```

The frontend will typically run at:
- http://localhost:5173
- http://127.0.0.1:5173

> **Note**: If Google OAuth reports an origin error, use `http://localhost:5173` or `http://127.0.0.1:5173`, not IP LAN/Tailscale addresses like `http://100.x.x.x:5173`.

### Production Configuration (Vercel)

For Vercel deployment, set these environment variables:

```env
VITE_API_BASE_URL=https://fitcv-0cab.onrender.com
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

Still set `VITE_API_BASE_URL` explicitly in Vercel so future backend URL changes do not require code changes.

## Backend Setup

### Installation

From the repository root:

```bash
cd backend
python -m venv .venv
```

#### Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### bash/zsh:
```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### Headless Chromium (for AI Rebuild CV feature)

Install headless Chromium for the AI Rebuild CV functionality:

#### Windows PowerShell:
```powershell
# Installation command would go here - refer to backend documentation for specifics
```

### Environment Variables

Create a `.env` file in the `backend` directory with necessary configuration (refer to backend documentation for required variables).

### Running the Backend

```bash
# After activating virtual environment
uvicorn app.main:app --reload
```

The backend will typically run at http://127.0.0.1:8000.

## Database Setup

FitCV uses MySQL. Ensure you have a MySQL server running and configured.

1. Create a database for FitCV
2. Update backend `.env` with database connection details
3. Run migrations (refer to backend documentation for migration commands)

## Verification

After setup:
1. Backend should be accessible at http://127.0.0.1:8000
2. Frontend should be accessible at http://localhost:5173
3. API documentation should be available at http://127.0.0.1:8000/docs

## Troubleshooting Common Setup Issues

If you encounter issues during setup, refer to the [Troubleshooting Guide](./troubleshooting.md) for common problems and solutions.