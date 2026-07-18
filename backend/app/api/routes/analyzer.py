from fastapi import APIRouter, BackgroundTasks, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.models.account import Account
from app.schemas.analyzer import AnalyzeCvRequest, CvVersionResponse, MatchResultResponse
from app.services import analyzer_service

router = APIRouter()


@router.post("/cvs", response_model=CvVersionResponse, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> CvVersionResponse:
    response = await analyzer_service.upload_cv(db, file=file, account=account)
    background_tasks.add_task(analyzer_service.run_cv_parse, response.cv_id)
    return response


@router.get("/cvs", response_model=list[CvVersionResponse])
def list_cvs(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> list[CvVersionResponse]:
    return analyzer_service.list_cvs(db, account=account)


@router.get("/cvs/{cv_id}", response_model=CvVersionResponse)
def get_cv(
    cv_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> CvVersionResponse:
    return analyzer_service.get_cv(db, cv_id=cv_id, account=account)


@router.delete("/cvs/{cv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cv(
    cv_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> Response:
    analyzer_service.delete_cv(db, cv_id=cv_id, account=account)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/analyzer/matches", response_model=MatchResultResponse, status_code=status.HTTP_202_ACCEPTED)
def analyze_cv(
    request: AnalyzeCvRequest,
    background_tasks: BackgroundTasks,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> MatchResultResponse:
    response, should_start = analyzer_service.request_analysis(db, request=request, account=account)
    if should_start:
        background_tasks.add_task(analyzer_service.run_match_task, response.match_result_id)
    return response


@router.get("/analyzer/matches/{match_result_id}", response_model=MatchResultResponse)
def get_match_result(
    match_result_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> MatchResultResponse:
    return analyzer_service.get_match_result(db, match_result_id=match_result_id, account=account)
