---
type: Operations Guide
title: Troubleshooting
description: Common issues and solutions for FitCV development and deployment.
tags: [troubleshooting, debugging, support]
---

# Troubleshooting Guide

This guide covers common issues encountered during FitCV development and deployment, along with their solutions.

## Frontend Issues

### Google OAuth Origin Errors

**Problem**: Google OAuth fails with origin mismatch errors.

**Solution**:
- Use `http://localhost:5173` or `http://127.0.0.1:5173` for development
- Avoid IP LAN/Tailscale addresses like `http://100.x.x.x:5173`
- Ensure your Google Cloud Console has authorized JavaScript origins:
  ```
  http://localhost:5173
  http://127.0.0.1:5173
  https://<your-vercel-domain>
  https://fit-cv.vercel.app
  ```

### Environment Variables Not Loading

**Problem**: Frontend doesn't recognize `.env.local` variables.

**Solution**:
- Restart the development server after creating/updating `.env.local`
- Ensure the file is in the repository root (not inside src/)
- Check variable names are prefixed with `VITE_` (Vite requirement)

### Build Failures

**Problem**: `npm run build` fails with dependency or syntax errors.

**Solution**:
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for conflicting dependency versions
- Ensure TypeScript configuration is correct

## Backend Issues

### Database Connection Errors

**Problem**: Backend fails to connect to MySQL.

**Solution**:
- Verify MySQL server is running
- Check database credentials in backend `.env`
- Ensure database exists and user has proper permissions
- Test connection with MySQL client directly

### Module Import Errors

**Problem**: Python import errors when starting the backend.

**Solution**:
- Ensure virtual environment is activated
- Install dependencies: `pip install -r requirements.txt`
- Check Python version (3.11+ recommended)
- Verify you're in the `backend` directory when running commands

### Headless Chromium Issues (AI Rebuild CV)

**Problem**: AI Rebuild CV feature fails due to Chromium issues.

**Solution**:
- Install required Chromium dependencies for your OS
- Check backend logs for specific error messages
- Ensure the backend has permissions to execute Chromium

## General Issues

### Port Conflicts

**Problem**: Services fail to start due to port already in use.

**Solution**:
- Check what's using ports 5173 (frontend) and 8000 (backend)
- Kill conflicting processes or change port configurations
- For backend: modify uvicorn command port
- For frontend: adjust Vite config or use different port

### Environment Configuration

**Problem**: Application behaves differently between environments.

**Solution**:
- Check `ENVIRONMENT` variable (dev/prod)
- Verify email configuration for password reset:
  - Development: logs reset codes to terminal if email not configured
  - Production: requires Resend email configuration
- Ensure all required environment variables are set

### API Communication Issues

**Problem**: Frontend cannot communicate with backend.

**Solution**:
- Verify `VITE_API_BASE_URL` is correct in `.env.local`
- Check backend is running and accessible
- Test API endpoints directly with curl or Postman
- Check CORS configuration in backend if needed

## Getting Help

If you encounter issues not covered in this guide:
1. Check the backend and frontend logs for specific error messages
2. Review the README.md for setup prerequisites
3. Consult the architecture documentation for component-specific issues
4. Check recent git changes for potential breaking changes

For persistent issues, consider creating an issue in the repository with:
- Detailed steps to reproduce
- Error messages and logs
- Environment details (OS, Node.js/Python versions, etc.)
- Relevant configuration files (with secrets removed)