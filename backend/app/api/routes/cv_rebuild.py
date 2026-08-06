import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import get_current_account
from app.models.account import Account
from app.schemas.cv_rebuild import CvBuildRequest, CvRebuildResponse
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.avatar import resolve_avatar
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.document_parser import MAX_CV_BYTES
from app.services.gemini_client import GeminiClientError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/rebuild", response_model=CvRebuildResponse)
def rebuild_from_cv(
    file: UploadFile = File(...),
    avatar: str | None = Form(default=None),
    jd_text: str | None = Form(default=None),
    account: Account = Depends(get_current_account),
) -> CvRebuildResponse:
    content = file.file.read(MAX_CV_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="File is empty.")
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(status_code=400, detail="CV file must be 10 MB or smaller.")
    try:
        safe_avatar = resolve_avatar(avatar)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        return orchestrator.rebuild_cv(
            content, file.filename or "cv.pdf", avatar=safe_avatar, jd_text=jd_text
        )
    except ValueError as exc:
        logger.exception("CV rebuild validation failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CvExtractionError as exc:
        logger.exception("CV rebuild extraction failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (GeminiClientError, PdfRenderError) as exc:
        logger.exception("CV rebuild pipeline failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/build", response_model=CvRebuildResponse)
def build_from_form(
    payload: CvBuildRequest,
    account: Account = Depends(get_current_account),
) -> CvRebuildResponse:
    try:
        safe_avatar = resolve_avatar(payload.avatar)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        return orchestrator.build_cv(
            payload.cv, language=payload.language, avatar=safe_avatar, jd_text=payload.jd_text
        )
    except CvExtractionError as exc:
        logger.exception("CV build polish failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (GeminiClientError, PdfRenderError) as exc:
        logger.exception("CV build pipeline failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
