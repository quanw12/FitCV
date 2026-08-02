from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.email_workflow import EmailWebhookResponse
from app.services import email_webhook_service
from app.services.email_service import (
    EmailDeliveryError,
    EmailWebhookVerificationError,
)

router = APIRouter()


@router.post("/resend", response_model=EmailWebhookResponse)
async def resend_email_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    try:
        return email_webhook_service.process_resend_webhook(
            db,
            payload=payload,
            headers=request.headers,
        )
    except EmailWebhookVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
