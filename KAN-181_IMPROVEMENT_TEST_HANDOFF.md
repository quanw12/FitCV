# KAN-181 — Improvement Suggestions test handoff

## Local modes

- Backend fixture: set `IMPROVEMENT_PROVIDER=fixture` in `backend/.env`.
- Frontend-only fixture: omit `VITE_API_BASE_URL`, or set `VITE_IMPROVEMENT_FIXTURE=true`.
- Integrated API: set `VITE_API_BASE_URL=http://127.0.0.1:8000` and `VITE_IMPROVEMENT_FIXTURE=false`.

## Public contract

- `POST /api/match-results/{id}/improvement-report/generate?regenerate=false` returns HTTP 202.
- `GET /api/match-results/{id}/improvement-report` returns `Pending`, `Processing`, `Success`, or `Failed`.
- A successful report contains `skill_gaps`, `section_feedback`, `rewrite_suggestions`, and `quick_wins`.
- Priorities are `Low`, `Medium`, or `High`; sections are defined in `backend/app/schemas/improvement.py`.

## Required automated cases

1. Authentication is required and a student cannot read another account's match result.
2. Generate is idempotent; repeated calls do not duplicate suggestions.
3. `regenerate=true` replaces the old report atomically after successful validation.
4. Pending/Processing tasks are not duplicated, including regenerate requests.
5. Invalid provider JSON, invalid enums, timeout, and quota errors end in `Failed` without a partial report.
6. Empty arrays are a valid successful report.
7. Skill gaps and Quick Wins render High → Medium → Low.
8. Section accordions use stable IDs and preserve state while opened/closed.
9. Rewrite copy reports success/failure and generated metrics remain explicit placeholders.
10. Quick Win progress changes locally and is never written to the backend.
11. Polling stops on Success, Failed, timeout, and component unmount.
12. Empty, stale, unauthorized, loading, failure, and retry states are visible and accessible.

## Safety fixture

The deterministic fixture deliberately uses `[N]`, `[X%]`, and `[verified outcome]`. Tests should reject a provider response that introduces unsupported employers, technologies, roles, or numeric achievements as facts. Provider schema validation protects structure; factual-grounding checks should be covered when the team finalizes the parsed-CV schema with the Analyzer owner.
