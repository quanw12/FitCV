from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth_guard import require_role
from app.models.account import Account, AccountRole
from app.schemas.email_workflow import (
    BulkEmailSendRequest,
    BulkEmailSendResponse,
    EmailDraftGenerate,
    EmailDraftResponse,
    EmailDraftUpdate,
    EmailTemplateResponse,
)
from app.services import email_workflow_service

router = APIRouter()
manager = require_role(
    AccountRole.hr,
    AccountRole.hiring_manager,
    AccountRole.admin,
)


@router.get("/templates", response_model=list[EmailTemplateResponse])
def list_templates(account: Account = Depends(manager)):
    return email_workflow_service.templates()


@router.get("/drafts", response_model=list[EmailDraftResponse])
def list_drafts(
    job_id: int | None = None,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return email_workflow_service.list_drafts(db, account, job_id)


@router.post("/drafts/generate", response_model=EmailDraftResponse, status_code=201)
def generate_draft(
    payload: EmailDraftGenerate,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return email_workflow_service.generate(
        db,
        account,
        application_id=payload.application_id,
        template_key=payload.template_key,
    )


@router.patch("/drafts/{email_id}", response_model=EmailDraftResponse)
def update_draft(
    email_id: int,
    payload: EmailDraftUpdate,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return email_workflow_service.update_draft(
        db,
        account,
        email_id,
        subject=payload.subject,
        body=payload.body,
    )


@router.post("/drafts/{email_id}/approve", response_model=EmailDraftResponse)
def approve_draft(
    email_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return email_workflow_service.approve(db, account, email_id)


@router.post("/drafts/{email_id}/send", response_model=EmailDraftResponse)
def send_draft(
    email_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return email_workflow_service.send(db, account, email_id)


@router.post("/bulk-send", response_model=BulkEmailSendResponse)
def bulk_send(
    payload: BulkEmailSendRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(manager),
):
    return email_workflow_service.bulk_send(db, account, payload.email_ids)
