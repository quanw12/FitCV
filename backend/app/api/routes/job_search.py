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
from app.services import linkedin_job_search

router = APIRouter()


@router.post("/job-search/recommendations", response_model=JobSearchResponse)
def job_search_recommendations(
    request: JobSearchRequest,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> JobSearchResponse:
    """Find a few LinkedIn jobs matching the student's CV.

    Reads the student's already-parsed CV to derive search keywords, queries
    LinkedIn's public job listings, and returns the hits without persisting
    anything. Personal-use prototype only; keep request volume low.
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
    query = (request.query or "").strip()
    if not query:
        query = linkedin_job_search.derive_search_query(payload)
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No skills were found in this CV to build a search query. "
                "Enter keywords manually."
            ),
        )
    location = (request.location or "").strip() or linkedin_job_search.DEFAULT_LOCATION
    jobage = request.jobage or 30
    try:
        results = linkedin_job_search.recommend_jobs(
            query=query,
            location=location,
            remote=request.remote,
            jobage=jobage,
            limit=request.limit,
        )
    except linkedin_job_search.LinkedInSearchError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc
    return JobSearchResponse(
        query=query,
        location=location,
        results=[JobSearchHit(**result) for result in results],
        note=(
            "Personal-use prototype: results come from LinkedIn's public "
            "listings and are not stored. Open a job on LinkedIn to apply."
        ),
    )
