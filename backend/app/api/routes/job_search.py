from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.models.account import Account
from app.repositories import analyzer
from app.schemas.job_search import (
    JobSearchHit,
    JobSearchRequest,
    JobSearchResponse,
)
from app.services import freehire_job_search, linkedin_job_search

router = APIRouter()


@router.post("/job-search/recommendations", response_model=JobSearchResponse)
def job_search_recommendations(
    request: JobSearchRequest,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> JobSearchResponse:
    """Find a few tech jobs matching the student's CV.

    Uses the student's already-parsed CV metadata to derive search keywords,
    queries both the freehire.me aggregator's public API and LinkedIn's public
    guest endpoint, deduplicates the merged hits, and returns them without
    persisting anything. Full CV text is only used as a fallback when the parsed
    metadata cannot produce a query. Personal-use prototype only; keep request
    volume low. One source may fail without failing the search.
    """
    record = analyzer.get_cv_record(db, request.cv_id, account.account_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="CV not found."
        )
    _, parsed_cv = record
    if parsed_cv is None or parsed_cv.parse_status != "Success":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This CV has not been parsed yet. Upload and analyze it first.",
        )
    payload = (
        parsed_cv.parsed_json if isinstance(parsed_cv.parsed_json, dict) else {}
    )
    user_query = (request.query or "").strip()
    level = freehire_job_search.normalize_level(request.level)
    deterministic_query = freehire_job_search.derive_search_query(payload)
    needs_full_cv_profile = not user_query and not deterministic_query
    derived = freehire_job_search.derive_ai_search_query(
        cv_text=(parsed_cv.parsed_text or "") if needs_full_cv_profile else "",
        parsed_payload=payload,
        preferred_level=level,
        use_ai=needs_full_cv_profile,
    )
    derived_level = derived["level"]
    derived_by = "ai" if derived["used_ai"] else "deterministic"
    query = user_query or deterministic_query or derived["query"]
    location = (request.location or "").strip() or (
        derived["location_hint"] or freehire_job_search.DEFAULT_LOCATION
    )
    effective_level = level or derived_level
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No skills were found in this CV to build a search query. "
                "Enter keywords manually."
            ),
        )
    jobage = request.jobage or 30

    errors: list[str] = []
    sources_ok: list[str] = []
    merged: list[dict] = []
    try:
        results = freehire_job_search.search_jobs(
            query=query,
            location=location,
            remote=request.remote,
            jobage=jobage,
            limit=request.limit,
            level=effective_level,
        )
        for result in results:
            result["source"] = "freehire"
        merged.extend(results)
        sources_ok.append("freehire.me")
    except freehire_job_search.FreehireSearchError as exc:
        errors.append(f"freehire.me: {exc}")
    try:
        results = linkedin_job_search.recommend_jobs(
            query=query,
            location=location,
            remote=request.remote,
            jobage=jobage,
            limit=request.limit,
            level=effective_level,
        )
        for result in results:
            result["source"] = "linkedin"
        merged.extend(results)
        sources_ok.append("LinkedIn")
    except linkedin_job_search.LinkedInSearchError as exc:
        errors.append(f"LinkedIn: {exc}")
    if not merged and errors:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="; ".join(errors),
        )

    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for result in merged:
        key = (
            str(result.get("title") or "").strip().lower(),
            str(result.get("company") or "").strip().lower(),
        )
        if not key[0] or key in seen:
            continue
        seen.add(key)
        deduped.append(result)

    results = deduped

    note_parts = []
    if sources_ok:
        note_parts.append(
            f"Results come from {' + '.join(sources_ok)} (best-effort, "
            "not stored). Open a job on its original posting page to apply."
        )
    if errors:
        note_parts.append("One search source failed; results are partial: " + "; ".join(errors))
    return JobSearchResponse(
        query=query,
        location=location,
        results=[JobSearchHit(**result) for result in results],
        note=" ".join(note_parts) if note_parts else "No results.",
        derived_by=derived_by,
        derived_level=derived_level,
    )
