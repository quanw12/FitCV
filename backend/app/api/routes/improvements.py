from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.models.account import Account
from app.schemas.improvement import GenerateImprovementResponse, ImprovementReportResponse
from app.services import improvement_service

router = APIRouter()


@router.post(
    "/{match_result_id}/improvement-report/generate",
    response_model=GenerateImprovementResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_improvement_report(
    match_result_id: int,
    background_tasks: BackgroundTasks,
    regenerate: bool = Query(False),
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> GenerateImprovementResponse:
    response, should_start = improvement_service.request_generation(
        db, match_result_id=match_result_id, account=account, regenerate=regenerate
    )
    if should_start and response.task_id is not None:
        background_tasks.add_task(improvement_service.run_generation_task, response.task_id)
    return response


@router.get("/{match_result_id}/improvement-report", response_model=ImprovementReportResponse)
def get_improvement_report(
    match_result_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> ImprovementReportResponse:
    return improvement_service.get_report(db, match_result_id=match_result_id, account=account)
