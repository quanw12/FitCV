import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.cv_rebuild import ApplyImprovementsRequest, CvRebuildResponse
from app.schemas.improvement import GenerateImprovementResponse, ImprovementReportResponse
from app.services import ai_task_service, improvement_service
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.avatar import resolve_avatar
from app.services.cv_rebuild.improvement_applier import build_applied_instructions
from app.services.cv_rebuild.llm_extractor import CvExtractionError
from app.services.cv_rebuild.pdf_renderer import PdfRenderError
from app.services.gemini_client import GeminiClientError

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/{match_result_id}/improvement-report/generate",
    response_model=GenerateImprovementResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_improvement_report(
    match_result_id: int,
    background_tasks: BackgroundTasks,
    regenerate: bool = Query(False),
    account: Account = Depends(require_role(AccountRole.student)),
    db: Session = Depends(get_db),
) -> GenerateImprovementResponse:
    response, should_start = improvement_service.request_generation(
        db, match_result_id=match_result_id, account=account, regenerate=regenerate
    )
    if (
        should_start
        and response.task_id is not None
        and ai_task_service.should_eager_execute()
    ):
        background_tasks.add_task(
            improvement_service.run_generation_task, response.task_id
        )
    return response


@router.get("/{match_result_id}/improvement-report", response_model=ImprovementReportResponse)
def get_improvement_report(
    match_result_id: int,
    account: Account = Depends(require_role(AccountRole.student)),
    db: Session = Depends(get_db),
) -> ImprovementReportResponse:
    return improvement_service.get_report(db, match_result_id=match_result_id, account=account)


@router.post("/{match_result_id}/apply-improvements", response_model=CvRebuildResponse)
async def apply_improvements(
    match_result_id: int,
    payload: ApplyImprovementsRequest,
    account: Account = Depends(require_role(AccountRole.student)),
    db: Session = Depends(get_db),
) -> CvRebuildResponse:
    """Apply selected, owned suggestions to the saved CV and return its PDF."""
    try:
        safe_avatar = resolve_avatar(payload.avatar)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Database and authorization work is complete before awaiting the renderer.
    parsed_text, jd_text, selected_rows = improvement_service.get_apply_context(
        db,
        match_result_id=match_result_id,
        account=account,
        suggestion_ids=payload.suggestion_ids,
    )
    try:
        instructions = build_applied_instructions(selected_rows)
        return await orchestrator.rebuild_with_improvements(
            parsed_text,
            applied_improvements=instructions,
            jd_text=jd_text,
            language=payload.language,
            avatar=safe_avatar,
        )
    except ValueError as exc:
        logger.exception("Improvement rebuild validation failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CvExtractionError as exc:
        logger.exception("Improvement rebuild extraction failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (GeminiClientError, PdfRenderError) as exc:
        logger.exception("Improvement rebuild pipeline failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
