from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import get_current_account
from app.db.session import get_db
from app.models.account import Account
from app.schemas.analyzer import (
    AnalyzeCvRequest,
    CvComparisonSeriesResponse,
    CvVersionResponse,
    JdLibraryInsightsResponse,
    JdLibraryItemResponse,
    MatchResultResponse,
)
from app.services import analyzer_service

router = APIRouter()


@router.post(
    "/cvs", response_model=CvVersionResponse, status_code=status.HTTP_201_CREATED
)
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


@router.get("/cvs/comparisons", response_model=list[CvComparisonSeriesResponse])
def list_cv_comparisons(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> list[CvComparisonSeriesResponse]:
    return analyzer_service.list_cv_comparisons(db, account=account)


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


@router.post(
    "/analyzer/matches",
    response_model=MatchResultResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def analyze_cv(
    request: AnalyzeCvRequest,
    background_tasks: BackgroundTasks,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> MatchResultResponse:
    response, should_start = analyzer_service.request_analysis(
        db, request=request, account=account
    )
    if should_start:
        background_tasks.add_task(
            analyzer_service.run_match_task, response.match_result_id
        )
    return response


@router.get("/analyzer/matches/{match_result_id}", response_model=MatchResultResponse)
def get_match_result(
    match_result_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> MatchResultResponse:
    return analyzer_service.get_match_result(
        db, match_result_id=match_result_id, account=account
    )


@router.get("/jd-library", response_model=list[JdLibraryItemResponse])
def list_jd_library(
    q: str | None = None,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> list[JdLibraryItemResponse]:
    return analyzer_service.list_jd_library(db, account=account, query=q)


@router.get("/jd-library/insights", response_model=JdLibraryInsightsResponse)
def get_jd_library_insights(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> JdLibraryInsightsResponse:
    return analyzer_service.get_jd_library_insights(db, account=account)


@router.get("/jd-library/{job_description_id}", response_model=JdLibraryItemResponse)
def get_jd_library_item(
    job_description_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> JdLibraryItemResponse:
    return analyzer_service.get_jd_library_item(
        db, job_description_id=job_description_id, account=account
    )


@router.delete(
    "/jd-library/{job_description_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_jd_library_item(
    job_description_id: int,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> Response:
    analyzer_service.delete_jd_library_item(
        db, job_description_id=job_description_id, account=account
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
