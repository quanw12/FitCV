from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.cv_ranking import BatchParseResponse
from app.services import cv_ranking_service

router = APIRouter()


@router.post("/parse", response_model=BatchParseResponse)
async def parse_cv_batch(
    job_description: str = Form(..., min_length=1),
    files: list[UploadFile] = File(...),
) -> BatchParseResponse:
    return await cv_ranking_service.parse_batch(files, job_description)
