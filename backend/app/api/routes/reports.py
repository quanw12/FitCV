from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.reports import ReportSummaryResponse
from app.services import reports_service

router = APIRouter()
manager = require_role(
    AccountRole.hr,
    AccountRole.hiring_manager,
    AccountRole.admin,
)


@router.get("/summary", response_model=ReportSummaryResponse)
def get_summary(
    from_: date | None = Query(None, alias="from"),
    to: date | None = Query(None),
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return reports_service.summary(db, account, from_, to)
