# Fix 2 bugs: unstable CV Build/Rebuild + Job Search auto-detect when keyword entered

_Status: ready for implementation._
_Two independent fixes. Bug 2 (job search) is small and safe; Bug 1 (CV rebuild) is a
multi-file backend hardening. Scoped to the user's chosen "fix all root causes" answer._

---

## Bug 2 — Job Search: keyword typed kills CV auto-detect (level + location)

**Root cause:** `backend/app/api/routes/job_search.py:51` wraps the *entire*
`derive_ai_search_query()` call (the only producer of `derived_level`, `location_hint`,
and the `ai` badge) inside `if not query:`. When a user enters a keyword, all
auto-detection is skipped, so `effective_level` becomes whatever the (most likely empty)
level dropdown held, and freehire's `seniority` facet + LinkedIn's `f_E`/level-prefix/low-level
title blocker are never applied.

**Decision (confirmed with user):** always run `derive_ai_search_query()`; only the
keyword `query` is overridden by the user's input. Level/location auto-detection and the
AI badge keep working.

### Changes — `backend/app/api/routes/job_search.py` (lines 46-75)

Rewrite param resolution so:
1. Call `derived = freehire_job_search.derive_ai_search_query(cv_text=..., parsed_payload=payload, preferred_level=level)` unconditionally.
2. `query = (request.query or "").strip() or derived["query"]` (user keyword wins; else AI-derived keywords).
3. `derived_level = derived["level"]` always.
4. `derived_by = "ai" if derived["used_ai"] else "deterministic"` always.
5. `location = (request.location or "").strip() or (derived["location_hint"] or freehire_job_search.DEFAULT_LOCATION)`.
   - Keep current behavior: an explicit `location` (incl. the frontend default `"Remote"`) still overrides the hint.
6. Keep `effective_level = level or derived_level`.
7. Remove the now-dead `if not query: raise 422` block (query is always derived when empty). Keep the 422 only if BOTH user query and AI-derived query are empty — i.e. guard after building `query`.

**Semantics note:** `derived_by` previously reflected how the *query* was chosen. After this change it reflects whether *any* auto-detected param (level/location primarily) came from Gemini. Frontend badge copy `JobSearchScreen.tsx:375-383` ("AI-derived from CV") stays correct because level is now Gemini-derived. No frontend change required.

### Tests — new `backend/tests/test_job_search_route.py`
- Pattern from `backend/tests/test_jobs_api.py` (in-memory SQLite + `dependency_overrides[get_db]`/`[get_current_account]` + `TestClient`).
- Case A: user provides keyword + empty level → response `derivedLevel` is the CV-derived level (Gemini or experience fallback), `derivedBy` is set, `query` equals the user keyword.
- Case B: no keyword → query/default behavior unchanged (AI-derived keywords).
- Case C: user provides keyword + explicit level → `effectiveLevel` = user level.
- Mock `freehire_job_search.search_jobs` and `linkedin_job_search.recommend_jobs` so the route doesn't hit the network.

---

## Bug 1 — CV Build/Rebuild output is non-deterministic / loses sections

Root causes (confirmed in code):
- `gemini_client.py:24-30` sets **no `temperature`** → Gemini default 1.0 → different output each run.
- `prompts.py` `CV_DATA_JSON_SCHEMA` makes every field optional → dropped content passes validation, so no retry.
- **Path A** (`orchestrator.rebuild_cv`) runs **zero** grounding/completeness guards — `polish()` only runs when `cv_is_mixed(cv)` (`orchestrator.py:60-69`).
- **No backfill step** re-injects fields the LLM omitted (contact, links, project links, publications, education, skills outside groups).
- `polish()` compares to the *previous* iteration, not the *original input* (`llm_extractor.py:180`) → baseline drift.
- `find_missing_sections` uses `len(summary)` char-count and `len(skills)` (ignores `skill_groups`) → false "missing" → wasted retries.
- `polish()` returns **last** attempt on exhaustion, not **best** (`llm_extractor.py:298`).
- `_fix_title_inflation` wipes **all** titles for a company when *any* entry in that company was inflated (`llm_extractor.py:106-141`), and misaligns on duplicate companies.
- Template renders `skill_groups` **XOR** `skills` (`cv_template.html:268-284`) → ungrouped skills vanish from the PDF.
- `build_cv` language detected from output then overrides user choice (`orchestrator.py:185`).
- `normalize_cv` doesn't strip symbols from project bullets / education / publications.

### 1. Pin determinism — `backend/app/core/config.py` + `backend/app/services/gemini_client.py`
- Add `gemini_cv_rebuild_temperature: float = 0.0` (and optional `gemini_cv_rebuild_seed: int | None = None`) to `Settings`.
- `generate_structured(...)` gains optional `temperature: float | None = None` and `seed: int | None = None`; when provided, add them to `generationConfig`. **Other callers unchanged** (email/improvement/match keep current behavior) — only CV rebuild opts in.
- `CvExtractor.extract` / `.polish` pass `temperature=settings.gemini_cv_rebuild_temperature` (and seed if set). Avoids touching `analyzer_service`, `email_workflow_service`, `improvement_provider`, `ocr_service`, `match_engine`.

### 2. Always guarantee completeness on Path A — `backend/app/services/cv_rebuild/orchestrator.py`
- In `rebuild_cv` (lines 53-69): after `extract`, run a **deterministic completeness guarantee** (new) instead of only the mixed-language loop:
  - Build a `baseline_cv` from the raw text (new helper `derive_baseline_from_text(raw_text)` in `completeness.py`) → presence checks for email/phone/links/sections/section-headers.
  - If `baseline_cv` indicates content the extracted `cv` lacks (e.g. a contact email present in text but `cv.email` empty, or a `## Experience` header present but `cv.experience` empty), call `cv_extractor.polish(cv, ...)` with a targeted completeness message (reuse `_completeness_message`), up to `_MAX_MIXED_ATTEMPTS`, comparing against `baseline_cv` each time.
  - Then still run the mixed-language loop (gated on `cv_is_mixed`) for translation consistency.
- `rebuild_with_improvements` and `build_cv`: change the polish compare-baseline from "previous output" to the **original input** (`parsed_text`/`cv` respectively). Pass `baseline=...` into `polish()` (see §3).
- `build_cv`: do **not** re-detect language from the polished output; keep the user's `language` for all polish calls and for `render_cv`. Keep `cv_is_mixed` check but use the original `language` for the "should translate" decision? Simplest safe change: keep `language` as passed for authoring; only use `detect_cv_language` to decide whether to continue the mixed loop, but pass the user's `language` as the target. Document with a short comment.

### 3. Compare against original input + best-attempt — `backend/app/services/cv_rebuild/llm_extractor.py`
- `polish(self, cv, *, language, baseline: CVData | None = None, ...)`:
  - `source_text = (baseline or cv).model_dump_json()` (baseline = original input). All guard checks use `baseline` for `entered` and `cv` (= polished) for output.
  - Track attempts; score each valid attempt by number of guard issues (`find_*` counts) → on exhaustion return the **best-scoring** attempt (tie-break: later attempt) instead of `last_cv`.
- `_fix_title_inflation(cv, polished)`: only override titles for companies where `find_title_inflation(cv, polished)` actually flagged an issue (use the returned `inflated` list to drive which companies to fix), and fix the `orig_titles.pop(0)` alignment so duplicate companies map correctly.

### 4. New deterministic backfill — `backend/app/services/cv_rebuild/completeness.py` (new)
Pure function `backfill_cv(original: CVData, built: CVData) -> tuple[CVData, list[str]]` (and a text-based `derive_baseline_from_text`):
- Scalars: if `original.email` and not `built.email` → copy; same for `phone`, `name`.
- `links`: append any original link (label+url) not already present in built (match on normalized url).
- `experience/projects/education/languages/publications/awards/certifications`: re-append original entries whose identity (company+title / name / institution / venue / value) is missing from built.
- `skills`: ensure every original skill is present in `built.skills` OR inside some `skill_groups.items`; if not, add to `built.skills` (so it renders — fixes XOR). Also add any original skill group not represented.
- `summary`: only restore if built.summary empty AND original had one.
- Returns merged `CVData` + human-readable `warnings` listing what was re-injected (so the UI "review" banner explains it). All merges are **additive only** — never overwrite LLM-improved wording with raw input.
- Call `backfill_cv(...)` in `orchestrator.rebuild_cv`, `rebuild_with_improvements`, and `build_cv` (build uses `cv` as original). Append the returned warnings to the response.

### 5. Fix noisy heuristics — `backend/app/services/cv_rebuild/grounding.py`
- `find_missing_sections`: replace `"summary": len(cv.summary or "")` (char count) with a **presence** check (`bool(cv.summary)`).
- Skills count: use a new helper `_skill_count(cv)` = `len(cv.skills) + sum(len(g.items) for g in cv.skill_groups)` so moving skills into groups isn't flagged as "skills missing".
- These remove the false-positive retry storms that burn the attempt budget.

### 6. Template — `backend/app/templates/cv_template.html` (lines 268-284)
- Keep rendering `skill_groups` first, but when `skill_groups` is present also render any **leftover** `skills` not already covered by a group (computing the diff inline). This guarantees no skill is dropped on the PDF. (Backfill in §4 already minimizes the leftover case, but the template change is the hard safety net.)

### 7. Normalize coverage — `backend/app/services/cv_rebuild/normalization.py`
- `_normalize_project`: also strip symbols from `bullets`.
- `normalize_cv`: also strip symbols from `education[].degree/institution/date`, `publications[].title/venue/date`, and `links[].label/url` (whitespace only). Keeps ATS output consistent across runs.

### 8. (Optional, small, backend-only) Pass-through for improvements
- `ImprovementScreen.tsx:309-313` calls `applyImprovements(matchResultId, ids, { signal })` without `language`/`avatar`. Add `language` (current detected) + `avatar` (if available) so the improved CV doesn't silently drop the photo / re-detect language. Low risk; include only if quick.

---

## Files touched (summary)

| File | Change |
|---|---|
| `backend/app/core/config.py` | add `gemini_cv_rebuild_temperature`, `gemini_cv_rebuild_seed` |
| `backend/app/services/gemini_client.py` | optional `temperature`/`seed` params |
| `backend/app/api/routes/job_search.py` | always derive auto-detect; keyword only overrides query |
| `backend/app/services/cv_rebuild/orchestrator.py` | Path A completeness guarantee; baseline = original; keep user language in build |
| `backend/app/services/cv_rebuild/llm_extractor.py` | baseline compare; best-attempt selection; targeted title fix |
| `backend/app/services/cv_rebuild/grounding.py` | summary presence check; skill-group-aware count |
| `backend/app/services/cv_rebuild/completeness.py` | NEW: `backfill_cv`, `derive_baseline_from_text` |
| `backend/app/services/cv_rebuild/normalization.py` | symbol strip for more fields |
| `backend/app/templates/cv_template.html` | render leftover skills under groups |
| `src/ui/screens/ImprovementScreen.tsx` (optional) | pass language+avatar to applyImprovements |
| `backend/tests/test_job_search_route.py` | NEW |
| `backend/tests/test_cv_rebuild_completeness.py` | NEW |
| updates to `test_cv_rebuild_*` as needed to keep green | |

## Verification
- Backend: `cd backend && python -m pytest tests/test_job_search_route.py tests/test_cv_rebuild_completeness.py tests/test_cv_rebuild_*.py -q`
- Frontend: `npm run build` (typecheck), `npm run test -- src/ui/screens/JobSearchScreen.test.tsx src/ui/screens/CVReBuildScreen.test.tsx`
- Manual: rebuild a real CV twice (temperature 0 + backfill should yield identical, complete output); job search with a typed keyword still shows "Level: <X>" + AI-derived badge and applies seniority filter.

## Risks
- `temperature:0` is the main determinism lever; if the model is unavailable the retry loop still works. Backfill is purely additive, so it cannot invent facts (grounding guards unchanged).
- Existing `test_cv_rebuild_convergence.py` / `test_cv_rebuild_extractor.py` use a `FakeGeminiClient` that returns fixed payloads — update them only if a signature change (new `baseline`/kwarg) breaks them; keep the contract backward compatible by making new params optional.
