---
type: Architecture
title: Frontend Architecture
description: React frontend structure, setup, and development guidelines for the FitCV application.
tags: [frontend, react, architecture]
---

# Frontend Architecture

FitCV's frontend is built with React 19, Vite, and Tailwind CSS v4. This document outlines the frontend structure, setup procedures, and development guidelines.

## Technology Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **State Management**: React Context and hooks (inferred from structure)
- **HTTP Client**: Likely fetch or axios (inferred from API calls)
- **Build Optimization**: Vite configured with manual chunking for vendor libraries (react, recharts, framer-motion, lucide-react, dnd-kit, gsap, mermaid, sonner, flint-chart) to enable better caching.

## File Organization

Frontend code must reside in the `src/` directory with the following structure:

```
src/
├── app/          # Application-level components and routes
├── ui/           # Reusable UI components
├── api/          # API service calls and endpoints
├── services/     # Business logic services
├── data/         # Data structures and utilities
�└── types/        # TypeScript type definitions
```

### Layer Responsibilities

- **src/app**: Contains application routes, layout components, and page-level components
- **src/ui**: Reusable, presentational components (buttons, forms, modals, etc.)
- **src/api**: Functions for making HTTP requests to backend endpoints
- **src/services**: Business logic that orchestrates API calls and data processing
  - **resourceCache.ts**: Caching mechanism for API responses to reduce redundant requests
- **src/data**: Data transformation utilities, constants, and mock data
- **src/types**: TypeScript interfaces and type definitions shared across the application

## Setup Instructions

### Prerequisites

- Node.js 20+ recommended
- npm (comes with Node.js)
- Git

### Installation

1. From the repository root:
   ```bash
   npm install
   ```

2. Create or update `.env.local` in the root directory:
   ```env
   VITE_API_BASE_URL=http://127.0.0.1:8000
   VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
   ```

   > **Note**: Use local backend while testing on your machine. If `.env.local` points to Render, requests will go to Render and the local backend terminal will not show auth logs.

3. Frontend production fallback URL (if `VITE_API_BASE_URL` is not set):
   ```
   https://fitcv-0cab.onrender.com
   ```

   > **Important**: Still set `VITE_API_BASE_URL` explicitly in Vercel so future backend URL changes do not require code changes.

### Development

Run the frontend development server:
```bash
npm run dev
```

Frontend typically runs at:
```
http://localhost:5173
```

### Google OAuth Configuration

If Google OAuth reports origin errors, open the app using:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

Do NOT use IP LAN/Tailscale format like `http://100.x.x.x:5173`.

### Vercel Environment Variables

For Vercel deployment:
```env
VITE_API_BASE_URL=https://fitcv-0cab.onrender.com
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

## Build Commands

- **Development**: `npm run dev`
- **Production Build**: `npm run build`
- **Format Code**: `npm run format`
- **TypeScript Check**: `npx tsc --noEmit`
- **Run Tests**: `npm test`

## Important Symbols and Entry Points

- **Main Entry Point**: `src/main.tsx` (inferred from standard React/Vite structure)
- **Router**: Likely in `src/app/` directory
- **API Services**: `src/api/` directory contains backend communication
- **Components**: `src/ui/` for reusable components, `src/app/` for page components

## Focused Tests

- **Unit Tests**: Run with `npm test` (likely Vitest or Jest based)
- **Component Testing**: Test individual UI components in isolation
- **Service Testing**: Test API service functions with mocked responses

## Validation Commands

- **Development Server**: `npm run dev` - validates frontend compiles and runs
- **Production Build**: `npm run build` - validates frontend builds without errors
- **Type Checking**: `npx tsc --noEmit` - validates TypeScript correctness
- **Code Formatting**: `npm run format` - validates code style compliance

## Change Navigation

When making frontend changes:

1. **UI Component Changes**: Edit files in `src/ui/` and test in isolation
2. **Page/Route Changes**: Edit files in `src/app/` and verify navigation
3. **API Integration Changes**: Edit files in `src/api/` and corresponding service files
4. **Business Logic Changes**: Edit files in `src/services/` and update related tests
5. **Type Definitions**: Edit files in `src/types/` and ensure consistency across usage

Always verify changes by running:
- `npm run dev` for development testing
- `npm run build` for production build validation
- `npm test` for running test suite