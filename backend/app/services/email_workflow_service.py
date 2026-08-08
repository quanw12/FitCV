from datetime import date, datetime, timedelta, timezone
import re

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.account import Account
from app.repositories import email_workflow
from app.schemas.email_workflow import (
    BulkEmailSendItem,
    BulkEmailSendResponse,
    CampaignGenerateRequest,
    CampaignPreviewResponse,
    EmailAudienceItem,
    EmailAudienceResponse,
    EmailDraftResponse,
    EmailThreadDetailResponse,
    EmailThreadMessageResponse,
    EmailThreadReadResponse,
    EmailThreadSummaryResponse,
    EmailTemplateResponse,
    GeneratedEmailTemplate,
    SmartReplyBatchRequest,
    SmartReplyBatchResponse,
    SmartReplyGenerate,
)
from app.services.email_service import EmailDeliveryError, send_candidate_email
from app.services.email_templates import (
    DEFAULT_INTERVIEW_WINDOW,
    DEFAULT_REPLY_HINT,
    FALLBACK_TEMPLATES,
    STAGE_TEMPLATES,
    TEMPLATES,
    TemplateSpec,
    TemplateValidationError,
    build_template_prompt,
    interview_date as calculate_interview_date,
    render,
    skeleton,
    validate_rendered,
    validate_template_contract,
)
from app.services.gemini_client import GeminiClient, GeminiClientError

MESSAGE_ID_PATTERN = re.compile(r"<[^<>\r\n]{1,498}>")
RESEND_IDEMPOTENCY_WINDOW = timedelta(hours=24)
SEND_CLAIM_TIMEOUT = timedelta(minutes=15)
EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _company_id(account: Account) -> int:
    if account.company_id is None:
        raise HTTPException(
            status_code=400,
            detail="A company must be assigned to manage candidate emails.",
        )
    return account.company_id


def templates() -> list[EmailTemplateResponse]:
    return [
        EmailTemplateResponse(
            key=key,
            name=spec.name,
            description=spec.description,
            allowed_stages=spec.ordered_allowed_stages(),
            default_stage=spec.default_stage,
        )
        for key, spec in TEMPLATES.items()
    ]


def _template(key: str) -> TemplateSpec:
    template = TEMPLATES.get(key)
    if template is None:
        raise HTTPException(status_code=422, detail="Unknown email template.")
    return template


def _template_values(
    *,
    candidate_name: str,
    job_title: str,
    company_name: str,
    hr_name: str,
    application_stage: str,
    scheduled_interview_date: date | None,
    interview_window: str,
) -> dict[str, object | None]:
    return {
        "candidate_name": candidate_name,
        "job_title": job_title,
        "company_name": company_name,
        "hr_name": hr_name,
        "interview_date": scheduled_interview_date,
        "interview_window": interview_window,
        "application_stage": application_stage,
        "reply_hint": DEFAULT_REPLY_HINT,
    }


def _generate_shared_template(
    *,
    template_key: str,
    company_name: str,
    hr_name: str,
    recipient_count: int,
    context: dict[str, object | None],
    scheduled_interview_date: date | None,
    validation_values: list[dict[str, object | None]],
    client: GeminiClient | None,
    forbidden_shared_literals: set[str] | None = None,
) -> tuple[GeneratedEmailTemplate, bool]:
    """Generate once, retry one invalid result, then use a safe static fallback."""

    fallback_key = template_key if template_key in FALLBACK_TEMPLATES else "follow_up"
    fallback = FALLBACK_TEMPLATES[fallback_key]
    try:
        gemini = client or GeminiClient()
    except GeminiClientError:
        return fallback, False

    previous_error: str | None = None
    for _ in range(2):
        prompt = build_template_prompt(
            company_name=company_name,
            hr_name=hr_name,
            recipient_count=recipient_count,
            context=context,
            interview_date_value=scheduled_interview_date,
            previous_error=previous_error,
        )
        try:
            generated = GeneratedEmailTemplate.model_validate(
                gemini.generate_structured(
                    prompt=prompt,
                    response_schema=GeneratedEmailTemplate.model_json_schema(),
                )
            )
            validate_template_contract(generated, template_key=template_key)
            template_text = (
                f"{generated.subject_template}\n{skeleton(generated)}"
            ).casefold()
            hardcoded = sorted(
                literal
                for literal in (forbidden_shared_literals or set())
                if literal.strip() and literal.casefold() in template_text
            )
            if hardcoded:
                raise TemplateValidationError(
                    "A shared template hard-coded recipient-specific values instead "
                    "of using placeholders: "
                    + ", ".join(hardcoded)
                    + "."
                )
            for values in validation_values:
                rendered_subject, rendered_body = render(generated, values)
                if not rendered_subject or len(rendered_subject) > 300:
                    raise TemplateValidationError(
                        "Rendered email subject must contain 1 to 300 characters."
                    )
                validate_rendered(rendered_body, company_name=company_name)
                validate_rendered(
                    f"{rendered_subject}\n\n{rendered_body}",
                    company_name=company_name,
                )
            return generated, True
        except GeminiClientError as exc:
            previous_error = str(exc)
        except (ValidationError, TemplateValidationError, ValueError) as exc:
            previous_error = str(exc)

    # Static templates are validated by unit tests and keep the workflow usable
    # when Gemini is missing, unavailable, or repeatedly violates the contract.
    validate_template_contract(fallback, template_key=fallback_key)
    for values in validation_values:
        fallback_subject, fallback_body = render(fallback, values)
        if not fallback_subject or len(fallback_subject) > 300:
            raise TemplateValidationError(
                "Fallback email subject must contain 1 to 300 characters."
            )
        validate_rendered(fallback_body, company_name=company_name)
        validate_rendered(
            f"{fallback_subject}\n\n{fallback_body}",
            company_name=company_name,
        )
    return fallback, False


def _audience_item(
    *,
    application,
    candidate,
    job,
    match,
    template_key: str,
    pending=None,
    last_sent=None,
    blocked_reason: str | None = None,
) -> EmailAudienceItem:
    if blocked_reason is None:
        if not candidate.email:
            blocked_reason = "Missing candidate email."
        elif pending is not None:
            blocked_reason = "Draft already pending."
    already_emailed = bool(
        last_sent is not None
        and last_sent.template_key == template_key
        and last_sent.stage_at_generation in {None, application.current_stage}
    )
    return EmailAudienceItem(
        application_id=application.application_id,
        candidate_name=candidate.full_name or "Candidate",
        candidate_email=candidate.email or "",
        job_id=job.job_id,
        job_title=job.title,
        current_stage=application.current_stage,
        applied_at=application.applied_at,
        overall_score=(
            float(match.overall_score)
            if match is not None and match.overall_score is not None
            else None
        ),
        match_label=match.match_label if match is not None else None,
        has_email_address=bool(candidate.email),
        last_email_template_key=(
            last_sent.template_key if last_sent is not None else None
        ),
        last_email_sent_at=(last_sent.sent_at if last_sent is not None else None),
        already_emailed_for_stage=already_emailed,
        pending_draft_email_id=(pending.email_id if pending is not None else None),
        blocked_reason=blocked_reason,
    )


def _reply_to_email(thread) -> str | None:
    domain = (settings.resend_inbound_domain or "").strip().lower()
    if domain.startswith("@"):
        domain = domain[1:]
    if not domain or "." not in domain:
        return None
    return f"reply+{thread.reply_token}@{domain}"


def _candidate_highlights(match) -> list[str]:
    """Keep CV-backed personalization bounded and free of contact details."""
    evidence = match.evidence_json if match and match.evidence_json else {}
    raw_highlights = evidence.get("strengths", [])
    if not isinstance(raw_highlights, list):
        return []
    highlights: list[str] = []
    for item in raw_highlights:
        if not isinstance(item, str):
            continue
        value = " ".join(item.split())
        value = EMAIL_PATTERN.sub("[redacted email]", value)
        value = PHONE_PATTERN.sub("[redacted phone]", value)
        if value:
            highlights.append(value[:240])
    return list(dict.fromkeys(highlights))[:3]


def _draft_response(row) -> EmailDraftResponse:
    draft, application, candidate, job, thread = row
    current_stage = application.current_stage
    return EmailDraftResponse(
        email_id=draft.email_id,
        application_id=draft.application_id,
        thread_id=draft.thread_id,
        campaign_id=draft.campaign_id,
        template_key=draft.template_key,
        message_kind=draft.message_kind,
        stage_at_generation=draft.stage_at_generation,
        current_stage=current_stage,
        stage_changed_since_generation=bool(
            draft.stage_at_generation
            and draft.stage_at_generation != current_stage
        ),
        candidate_name=candidate.full_name or "Candidate",
        job_title=job.title,
        recipient_email=draft.recipient_email,
        reply_to_email=_reply_to_email(thread) if thread is not None else None,
        subject=draft.subject,
        body=draft.body,
        status=draft.status,
        delivery_status=draft.delivery_status,
        retryable=draft.retryable,
        retry_count=draft.retry_count,
        last_attempt_at=draft.last_attempt_at,
        ai_generated=draft.ai_generated,
        in_reply_to=draft.in_reply_to,
        approved_at=draft.approved_at,
        sent_at=draft.sent_at,
        provider_message_id=draft.provider_message_id,
        error_message=draft.error_message,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )


def list_drafts(
    db: Session, account: Account, job_id: int | None = None
) -> list[EmailDraftResponse]:
    return [
        _draft_response(row)
        for row in email_workflow.rows(db, _company_id(account), job_id)
    ]


def audience(
    db: Session,
    account: Account,
    *,
    stage: str,
    job_id: int | None = None,
) -> EmailAudienceResponse:
    company_id = _company_id(account)
    template_key = STAGE_TEMPLATES[stage]
    rows = email_workflow.audience_rows(
        db,
        company_id,
        stage=stage,
        job_id=job_id,
    )
    application_ids = [row[0].application_id for row in rows]
    pending = email_workflow.pending_initial_drafts(
        db,
        company_id=company_id,
        application_ids=application_ids,
        template_key=template_key,
    )
    eligible: list[EmailAudienceItem] = []
    blocked: list[EmailAudienceItem] = []
    for application, candidate, job, match, last_sent in rows:
        item = _audience_item(
            application=application,
            candidate=candidate,
            job=job,
            match=match,
            template_key=template_key,
            pending=pending.get(application.application_id),
            last_sent=last_sent,
        )
        (blocked if item.blocked_reason else eligible).append(item)
    return EmailAudienceResponse(
        stage=stage,
        template_key=template_key,
        job_id=job_id,
        eligible=eligible,
        blocked=blocked,
    )


def generate_campaign(
    db: Session,
    account: Account,
    payload: CampaignGenerateRequest,
    *,
    client: GeminiClient | None = None,
    today: date | None = None,
) -> CampaignPreviewResponse:
    company_id = _company_id(account)
    template = _template(payload.template_key)
    requested_ids = payload.application_ids
    loaded_rows = email_workflow.applications_for_campaign(
        db,
        requested_ids,
        company_id,
    )
    by_application_id = {
        row[0].application_id: row for row in loaded_rows
    }
    if len(by_application_id) != len(requested_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more applications were not found for this company.",
        )
    rows = [by_application_id[application_id] for application_id in requested_ids]

    active_rows = [row for row in rows if row[0].status != "Withdrawn"]
    active_stages = {row[0].current_stage for row in active_rows}
    if len(active_stages) > 1:
        raise HTTPException(
            status_code=422,
            detail="Select candidates from one pipeline stage per email campaign.",
        )
    if template.allowed_stages is not None:
        invalid = next(
            (
                row
                for row in active_rows
                if row[0].current_stage not in template.allowed_stages
            ),
            None,
        )
        if invalid is not None:
            application, candidate, *_ = invalid
            required_stage = template.ordered_allowed_stages()[0]
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Move {candidate.full_name or 'the candidate'} to "
                    f"{required_stage} before using the {template.name} template. "
                    f"The application is currently at {application.current_stage}."
                ),
            )

    pending = email_workflow.pending_initial_drafts(
        db,
        company_id=company_id,
        application_ids=requested_ids,
        template_key=payload.template_key,
    )
    sent = email_workflow.sent_email_summary(db, company_id, requested_ids)
    eligible_rows = []
    skipped: list[EmailAudienceItem] = []
    for row in rows:
        application, candidate, job, _company, match = row
        blocked_reason = None
        if application.status == "Withdrawn":
            blocked_reason = "Application withdrawn."
        elif not candidate.email:
            blocked_reason = "Missing candidate email."
        elif application.application_id in pending:
            blocked_reason = "Draft already pending."
        if blocked_reason:
            skipped.append(
                _audience_item(
                    application=application,
                    candidate=candidate,
                    job=job,
                    match=match,
                    template_key=payload.template_key,
                    pending=pending.get(application.application_id),
                    last_sent=sent.get(application.application_id),
                    blocked_reason=blocked_reason,
                )
            )
        else:
            eligible_rows.append(row)

    if not eligible_rows:
        reason = skipped[0].blocked_reason if skipped else "No eligible recipients."
        raise HTTPException(
            status_code=409 if pending else 422,
            detail=f"No eligible recipients. {reason}",
        )

    representative = eligible_rows[0] if eligible_rows else rows[0]
    target_stage = representative[0].current_stage
    company_name = representative[3].company_name
    hr_name = account.full_name or "Recruiting Team"
    account_id = account.account_id
    job_titles = sorted({row[2].title for row in eligible_rows})
    eligible_snapshots = [
        {
            "application_id": application.application_id,
            "candidate_name": candidate.full_name or "Candidate",
            "candidate_email": candidate.email,
            "job_title": job.title,
            "job_id": job.job_id,
            "company_name": company.company_name,
            "current_stage": application.current_stage,
        }
        for application, candidate, job, company, _match in eligible_rows
    ]
    eligible_audience_items = {
        application.application_id: _audience_item(
            application=application,
            candidate=candidate,
            job=job,
            match=match,
            template_key=payload.template_key,
            pending=None,
            last_sent=sent.get(application.application_id),
        )
        for application, candidate, job, _company, match in eligible_rows
    }
    representative_snapshot = {
        "candidate_name": representative[1].full_name or "Candidate",
        "job_title": representative[2].title,
        "company_name": representative[3].company_name,
        "current_stage": representative[0].current_stage,
    }
    interview_window = payload.interview_window or DEFAULT_INTERVIEW_WINDOW
    scheduled_interview_date = (
        calculate_interview_date(
            lead_days=payload.interview_lead_days,
            today=today or date.today(),
        )
        if template.requires_interview_date
        else None
    )
    validation_values = [
        _template_values(
            candidate_name=str(snapshot["candidate_name"]),
            job_title=str(snapshot["job_title"]),
            company_name=str(snapshot["company_name"]),
            hr_name=hr_name,
            application_stage=str(snapshot["current_stage"]),
            scheduled_interview_date=scheduled_interview_date,
            interview_window=interview_window,
        )
        for snapshot in (eligible_snapshots or [representative_snapshot])
    ]
    grounded_context = {
        "template_purpose": template.guidance,
        "company_name": company_name,
        "hr_name": hr_name,
        "job_titles": (
            job_titles if len(job_titles) == 1 else ["{{job_title}}"]
        ),
        "target_stage": target_stage,
        "recipient_count": len(eligible_rows),
        "interview_date": scheduled_interview_date,
        "interview_window": interview_window,
        "hr_guidance": payload.guidance,
    }
    if eligible_rows:
        generated, ai_generated = _generate_shared_template(
            template_key=payload.template_key,
            company_name=company_name,
            hr_name=hr_name,
            recipient_count=len(eligible_rows),
            context=grounded_context,
            scheduled_interview_date=scheduled_interview_date,
            validation_values=validation_values,
            client=client,
            forbidden_shared_literals=(
                set(job_titles) if len(job_titles) > 1 else None
            ),
        )
    else:
        generated = FALLBACK_TEMPLATES[payload.template_key]
        ai_generated = False

    rendered_drafts: list[dict] = []
    for snapshot in eligible_snapshots:
        values = _template_values(
            candidate_name=str(snapshot["candidate_name"]),
            job_title=str(snapshot["job_title"]),
            company_name=str(snapshot["company_name"]),
            hr_name=hr_name,
            application_stage=str(snapshot["current_stage"]),
            scheduled_interview_date=scheduled_interview_date,
            interview_window=interview_window,
        )
        subject, body = render(generated, values)
        if not subject or len(subject) > 300:
            raise TemplateValidationError(
                "Rendered email subject must contain 1 to 300 characters."
            )
        validate_rendered(body, company_name=str(snapshot["company_name"]))
        validate_rendered(
            f"{subject}\n\n{body}",
            company_name=str(snapshot["company_name"]),
        )
        rendered_drafts.append(
            {
                "application_id": snapshot["application_id"],
                "job_id": snapshot["job_id"],
                "stage_at_generation": snapshot["current_stage"],
                "recipient_email": snapshot["candidate_email"],
                "subject": subject,
                "body": body,
                "account_id": account_id,
            }
        )
    threads = email_workflow.ensure_threads(
        db,
        company_id=company_id,
        application_ids=[
            int(snapshot["application_id"]) for snapshot in eligible_snapshots
        ],
    )
    thread_ids = {
        application_id: thread.thread_id
        for application_id, thread in threads.items()
    }
    # End any read transaction opened before Gemini ran. The next transaction
    # begins with row locks and keeps them through campaign + draft insertion.
    db.commit()
    locked_states = {
        application_id: (current_stage, status)
        for application_id, current_stage, status in (
            email_workflow.lock_applications_for_email(
                db,
                company_id=company_id,
                application_ids=[
                    int(snapshot["application_id"])
                    for snapshot in eligible_snapshots
                ],
            )
        )
    }
    raced_pending = email_workflow.pending_initial_drafts(
        db,
        company_id=company_id,
        application_ids=list(locked_states),
        template_key=payload.template_key,
    )
    filtered_drafts: list[dict] = []
    for rendered_draft in rendered_drafts:
        application_id = int(rendered_draft["application_id"])
        expected_stage = str(rendered_draft["stage_at_generation"])
        state = locked_states.get(application_id)
        pending_draft = raced_pending.get(application_id)
        blocked_reason = None
        if state is None:
            blocked_reason = "Application is no longer available to this company."
        elif state[1] == "Withdrawn":
            blocked_reason = "Application withdrawn."
        elif state[0] != expected_stage:
            blocked_reason = (
                f"Application moved from {expected_stage} to {state[0]} while "
                "the campaign was being prepared. Refresh the audience."
            )
        elif pending_draft is not None:
            blocked_reason = "Draft already pending."
        if blocked_reason is not None:
            skipped.append(
                eligible_audience_items[application_id].model_copy(
                    update={
                        "pending_draft_email_id": (
                            pending_draft.email_id if pending_draft else None
                        ),
                        "blocked_reason": blocked_reason,
                    }
                )
            )
            continue
        filtered_drafts.append(rendered_draft)

    if not filtered_drafts:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "No campaign was created because the selected applications changed "
                "or another request created their drafts. Refresh the audience."
            ),
        )

    campaign = email_workflow.create_campaign(
        db,
        company_id=company_id,
        job_id=(
            next(iter({int(item["job_id"]) for item in filtered_drafts}))
            if len({int(item["job_id"]) for item in filtered_drafts}) == 1
            else None
        ),
        account_id=account_id,
        template_key=payload.template_key,
        target_stage=target_stage,
        recipient_count=len(filtered_drafts),
        interview_date=scheduled_interview_date,
        template_json=generated.model_dump(mode="json"),
        ai_generated=ai_generated,
        commit=False,
    )
    campaign_id = campaign.campaign_id
    draft_items: list[dict] = []
    for rendered_draft in filtered_drafts:
        application_id = int(rendered_draft["application_id"])
        draft_values = {
            key: value
            for key, value in rendered_draft.items()
            if key != "job_id"
        }
        draft_items.append(
            {
                **draft_values,
                "thread_id": thread_ids[application_id],
            }
        )
    drafts = email_workflow.create_drafts(
        db,
        campaign_id,
        draft_items,
    )
    response_rows = email_workflow.rows_by_email_ids(
        db,
        [draft.email_id for draft in drafts],
        company_id,
    )
    draft_responses = [_draft_response(row) for row in response_rows]
    return CampaignPreviewResponse(
        campaign_id=campaign_id,
        template_key=payload.template_key,
        target_stage=target_stage,
        interview_date=scheduled_interview_date,
        ai_generated=ai_generated,
        recipient_count=len(draft_responses),
        shared_body_skeleton=skeleton(generated),
        drafts=draft_responses,
        skipped=skipped,
    )


def generate(
    db: Session,
    account: Account,
    *,
    application_id: int,
    template_key: str,
    guidance: str | None = None,
    client: GeminiClient | None = None,
) -> EmailDraftResponse:
    company_id = _company_id(account)
    existing = email_workflow.pending_initial_draft(
        db,
        company_id=company_id,
        application_id=application_id,
        template_key=template_key,
    )
    if existing is not None:
        existing_row = email_workflow.row(
            db,
            existing.email_id,
            company_id,
        )
        if existing_row is not None:
            return _draft_response(existing_row)
    preview = generate_campaign(
        db,
        account,
        CampaignGenerateRequest(
            application_ids=[application_id],
            template_key=template_key,
            guidance=guidance,
        ),
        client=client,
    )
    if preview.drafts:
        return preview.drafts[0]
    skipped = preview.skipped[0]
    if skipped.pending_draft_email_id is not None:
        row = email_workflow.row(
            db,
            skipped.pending_draft_email_id,
            _company_id(account),
        )
        if row is not None:
            return _draft_response(row)
    if skipped.blocked_reason == "Missing candidate email.":
        raise HTTPException(status_code=422, detail=skipped.blocked_reason)
    raise HTTPException(status_code=409, detail=skipped.blocked_reason)


def update_draft(
    db: Session,
    account: Account,
    email_id: int,
    *,
    subject: str,
    body: str,
) -> EmailDraftResponse:
    company_id = _company_id(account)
    draft = email_workflow.get_owned(db, email_id, company_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Email draft not found.")
    if draft.status != "Draft":
        raise HTTPException(
            status_code=409,
            detail="Only a draft can be edited.",
        )
    changed = email_workflow.compare_and_set_status(
        db,
        email_id=email_id,
        company_id=company_id,
        expected_status="Draft",
        values={"subject": subject, "body": body, "error_message": None},
    )
    if not changed:
        raise HTTPException(
            status_code=409,
            detail="The draft changed in another request. Refresh before editing.",
        )
    return _draft_response(email_workflow.row(db, email_id, company_id))


def approve(
    db: Session, account: Account, email_id: int
) -> EmailDraftResponse:
    company_id = _company_id(account)
    draft = email_workflow.get_owned(db, email_id, company_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Email draft not found.")
    if draft.status != "Draft":
        raise HTTPException(
            status_code=409,
            detail="Only a reviewed draft can be approved.",
        )
    changed = email_workflow.compare_and_set_status(
        db,
        email_id=email_id,
        company_id=company_id,
        expected_status="Draft",
        values={
            "status": "Approved",
            "approved_by_account_id": account.account_id,
            "approved_at": _now(),
            "error_message": None,
        },
    )
    if not changed:
        raise HTTPException(
            status_code=409,
            detail="The draft changed in another request. Refresh before approving.",
        )
    return _draft_response(email_workflow.row(db, email_id, company_id))


def reopen_failed_draft(
    db: Session, account: Account, email_id: int
) -> EmailDraftResponse:
    company_id = _company_id(account)
    draft = email_workflow.get_owned(db, email_id, company_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Email draft not found.")
    if draft.status != "Failed":
        raise HTTPException(
            status_code=409,
            detail="Only a failed email can be reopened for review.",
        )
    changed = email_workflow.compare_and_set_status(
        db,
        email_id=email_id,
        company_id=company_id,
        expected_status="Failed",
        require_not_queued=True,
        values={
            "status": "Draft",
            "delivery_status": None,
            "idempotency_key": None,
            "approved_by_account_id": None,
            "approved_at": None,
            "provider_message_id": None,
            "error_message": None,
            "retryable": False,
            "retry_count": 0,
            "last_attempt_at": None,
        },
    )
    if not changed:
        raise HTTPException(
            status_code=409,
            detail=(
                "The failed email changed or is being sent in another request. "
                "Refresh before reopening it."
            ),
        )
    return _draft_response(email_workflow.row(db, email_id, company_id))


def send(db: Session, account: Account, email_id: int) -> EmailDraftResponse:
    company_id = _company_id(account)
    row = email_workflow.row(db, email_id, company_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Email draft not found.")
    draft, application, _candidate, _job, thread = row
    if draft.status == "Sent":
        raise HTTPException(status_code=409, detail="Email was already sent.")
    if (
        draft.stage_at_generation is not None
        and draft.stage_at_generation != application.current_stage
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"The candidate moved from {draft.stage_at_generation} to "
                f"{application.current_stage} after this email was drafted. "
                "Reopen and regenerate it."
            ),
        )
    if draft.message_kind == "Initial" and application.status == "Withdrawn":
        raise HTTPException(
            status_code=409,
            detail=(
                "The application was withdrawn after this email was drafted. "
                "Do not send this campaign email."
            ),
        )
    if draft.status not in {"Approved", "Failed"} or draft.approved_at is None:
        raise HTTPException(
            status_code=409,
            detail="HR must review and approve the draft before sending.",
        )
    if draft.status == "Failed":
        if not draft.retryable:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This delivery failure is not retryable. Reopen the draft, "
                    "review the provider error, and approve it again before sending."
                ),
            )
    if draft.status == "Failed" and draft.idempotency_key:
        # `updated_at` remains the compatibility source for rows created before
        # the retry metadata migration; new rows also update it on every attempt.
        attempted_at = draft.updated_at or draft.last_attempt_at or draft.created_at
        if _now() - attempted_at >= RESEND_IDEMPOTENCY_WINDOW:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This retry is outside Resend's 24-hour idempotency window. "
                    "Reopen the draft, review it, and approve it again before sending."
                ),
            )
    idempotency_key = draft.idempotency_key or f"candidate-email/{draft.email_id}"
    employer_name = email_workflow.employer_name(db, company_id)
    attempt_at = _now()
    claimed = email_workflow.claim_send(
        db,
        email_id=draft.email_id,
        company_id=company_id,
        idempotency_key=idempotency_key,
        attempt_at=attempt_at,
        stale_before=attempt_at - SEND_CLAIM_TIMEOUT,
        retry_count=(draft.retry_count or 0) + 1,
        stage_at_generation=draft.stage_at_generation,
        block_withdrawn=draft.message_kind == "Initial",
    )
    if not claimed:
        refreshed = email_workflow.row(db, email_id, company_id)
        if refreshed is not None:
            current_draft, current_application, *_ = refreshed
            if (
                current_draft.stage_at_generation is not None
                and current_draft.stage_at_generation
                != current_application.current_stage
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"The candidate moved from "
                        f"{current_draft.stage_at_generation} to "
                        f"{current_application.current_stage} while the email was "
                        "being sent. Regenerate it."
                    ),
                )
            if (
                current_draft.message_kind == "Initial"
                and current_application.status == "Withdrawn"
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "The application was withdrawn while the email was being "
                        "sent. Do not send this campaign email."
                    ),
                )
        raise HTTPException(
            status_code=409,
            detail=(
                "Another delivery attempt is already in progress. "
                "Refresh the email record before trying again."
            ),
        )
    try:
        message_id = send_candidate_email(
            to_email=draft.recipient_email,
            subject=draft.subject,
            body=draft.body,
            reply_to=(
                _reply_to_email(thread) if thread is not None else None
            ),
            in_reply_to=draft.in_reply_to,
            references=draft.references_json or [],
            idempotency_key=idempotency_key,
            sender_name=employer_name,
        )
    except EmailDeliveryError as exc:
        email_workflow.save(
            db,
            draft,
            {
                "status": "Failed",
                "delivery_status": "Failed",
                "retryable": exc.retryable,
                "error_message": str(exc)[:1000],
            },
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    email_workflow.save(
        db,
        draft,
        {
            "status": "Sent",
            "delivery_status": "Sent",
            "provider_message_id": message_id,
            "sent_at": _now(),
            "retryable": False,
            "error_message": None,
        },
    )
    return _draft_response(email_workflow.row(db, email_id, company_id))


def bulk_send(
    db: Session, account: Account, email_ids: list[int]
) -> BulkEmailSendResponse:
    results: list[BulkEmailSendItem] = []
    for email_id in dict.fromkeys(email_ids):
        try:
            sent = send(db, account, email_id)
            results.append(
                BulkEmailSendItem(email_id=email_id, status=sent.status)
            )
        except HTTPException as exc:
            results.append(
                BulkEmailSendItem(
                    email_id=email_id,
                    status="Failed",
                    error_message=str(exc.detail),
                )
            )
    sent_count = sum(item.status == "Sent" for item in results)
    return BulkEmailSendResponse(
        sent_count=sent_count,
        failed_count=len(results) - sent_count,
        results=results,
    )


def _thread_messages(
    db: Session,
    thread_id: int,
    *,
    outbound_messages=None,
    inbound_messages=None,
) -> list[EmailThreadMessageResponse]:
    messages: list[EmailThreadMessageResponse] = []
    outbound_rows = (
        outbound_messages
        if outbound_messages is not None
        else email_workflow.outbound_messages(db, thread_id)
    )
    for outbound in outbound_rows:
        messages.append(
            EmailThreadMessageResponse(
                message_id=f"outbound-{outbound.email_id}",
                direction="Outbound",
                email_id=outbound.email_id,
                inbound_id=None,
                subject=outbound.subject,
                body=outbound.body,
                status=outbound.status,
                delivery_status=outbound.delivery_status,
                retryable=outbound.retryable,
                ai_generated=outbound.ai_generated,
                provider_message_id=outbound.provider_message_id,
                occurred_at=outbound.sent_at or outbound.created_at,
            )
        )
    inbound_rows = (
        inbound_messages
        if inbound_messages is not None
        else email_workflow.inbound_messages(db, thread_id)
    )
    for inbound in inbound_rows:
        messages.append(
            EmailThreadMessageResponse(
                message_id=f"inbound-{inbound.inbound_id}",
                direction="Inbound",
                email_id=None,
                inbound_id=inbound.inbound_id,
                subject=inbound.subject,
                body=inbound.body_text,
                status="Received",
                delivery_status=None,
                retryable=False,
                ai_generated=False,
                provider_message_id=inbound.provider_message_id,
                occurred_at=inbound.received_at,
            )
        )
    return sorted(messages, key=lambda message: message.occurred_at)


def _thread_summary(
    db: Session,
    row,
    *,
    messages: list[EmailThreadMessageResponse] | None = None,
    unread_count: int | None = None,
) -> EmailThreadSummaryResponse:
    thread, application, candidate, job = row[0], row[1], row[2], row[3]
    thread_messages = (
        messages
        if messages is not None
        else _thread_messages(db, thread.thread_id)
    )
    last_message = thread_messages[-1] if thread_messages else None
    preview = None
    if last_message is not None:
        preview = " ".join(last_message.body.split())[:180] or None
    return EmailThreadSummaryResponse(
        thread_id=thread.thread_id,
        application_id=thread.application_id,
        candidate_name=candidate.full_name or "Candidate",
        candidate_email=candidate.email or "",
        job_title=job.title,
        current_stage=application.current_stage,
        subject=thread.subject,
        reply_to_email=_reply_to_email(thread),
        last_message_at=thread.last_message_at,
        last_inbound_at=thread.last_inbound_at,
        unread_count=(
            unread_count
            if unread_count is not None
            else email_workflow.unread_count(db, thread.thread_id)
        ),
        last_message_preview=preview,
    )


def list_threads(
    db: Session, account: Account
) -> list[EmailThreadSummaryResponse]:
    rows = email_workflow.thread_contexts(db, _company_id(account))
    thread_ids = [row[0].thread_id for row in rows]
    outbound_by_thread = email_workflow.outbound_messages_for_threads(
        db,
        thread_ids,
    )
    inbound_by_thread = email_workflow.inbound_messages_for_threads(
        db,
        thread_ids,
    )
    unread_by_thread = email_workflow.unread_counts(db, thread_ids)
    return [
        _thread_summary(
            db,
            row,
            messages=_thread_messages(
                db,
                row[0].thread_id,
                outbound_messages=outbound_by_thread[row[0].thread_id],
                inbound_messages=inbound_by_thread[row[0].thread_id],
            ),
            unread_count=unread_by_thread[row[0].thread_id],
        )
        for row in rows
    ]


def thread_detail(
    db: Session,
    account: Account,
    thread_id: int,
) -> EmailThreadDetailResponse:
    row = email_workflow.thread_context(db, thread_id, _company_id(account))
    if row is None:
        raise HTTPException(status_code=404, detail="Email thread not found.")
    messages = _thread_messages(db, thread_id)
    summary = _thread_summary(db, row, messages=messages)
    return EmailThreadDetailResponse(
        **summary.model_dump(),
        messages=messages,
    )


def mark_thread_read(
    db: Session,
    account: Account,
    thread_id: int,
) -> EmailThreadReadResponse:
    row = email_workflow.thread_context(db, thread_id, _company_id(account))
    if row is None:
        raise HTTPException(status_code=404, detail="Email thread not found.")
    email_workflow.mark_thread_read(db, thread_id)
    return EmailThreadReadResponse(thread_id=thread_id, unread_count=0)


def _thread_references(inbound_messages) -> list[str]:
    """Build safe RFC-style references from the candidate's inbound headers."""
    references: list[str] = []
    for inbound in inbound_messages:
        for value in (
            inbound.references_text,
            inbound.in_reply_to,
            inbound.provider_message_id,
        ):
            if not value:
                continue
            references.extend(MESSAGE_ID_PATTERN.findall(value))
    return list(dict.fromkeys(references))[-20:]


def _conversation_context(
    outbound_messages,
    inbound_messages,
) -> list[dict[str, str]]:
    conversation: list[tuple[datetime, dict[str, str]]] = []
    for message in outbound_messages:
        if message.status != "Sent":
            continue
        conversation.append(
            (
                message.sent_at or message.created_at,
                {
                    "direction": "Outbound",
                    "subject": message.subject[:300],
                    "body": message.body[:3000],
                },
            )
        )
    for message in inbound_messages:
        conversation.append(
            (
                message.received_at,
                {
                    "direction": "Inbound",
                    "subject": message.subject[:300],
                    "body": message.body_text[:3000],
                },
            )
        )
    conversation.sort(key=lambda item: item[0])
    return [item[1] for item in conversation[-12:]]


def _shared_conversation_context(
    conversations: list[list[dict[str, str]]],
) -> list[dict[str, str]]:
    """Keep only exact messages present for every recipient in a shared reply."""

    if not conversations:
        return []
    common = {
        (message["direction"], message["subject"], message["body"])
        for message in conversations[0]
    }
    for conversation in conversations[1:]:
        common.intersection_update(
            (message["direction"], message["subject"], message["body"])
            for message in conversation
        )
    return [
        message
        for message in conversations[0]
        if (message["direction"], message["subject"], message["body"]) in common
    ]


def _reply_subject(inbound_subject: str) -> str:
    subject = " ".join(inbound_subject.split()) or "Candidate reply"
    if subject.casefold().startswith("re:"):
        return subject[:300]
    return f"Re: {subject}"[:300]


def generate_smart_reply_batch(
    db: Session,
    account: Account,
    payload: SmartReplyBatchRequest,
    *,
    client: GeminiClient | None = None,
    today: date | None = None,
) -> SmartReplyBatchResponse:
    company_id = _company_id(account)
    rows = email_workflow.thread_contexts_by_ids(
        db,
        payload.thread_ids,
        company_id,
    )
    row_by_thread_id = {row[0].thread_id: row for row in rows}
    scoped_thread_ids = list(row_by_thread_id)
    inbound_by_thread = email_workflow.inbound_messages_for_threads(
        db,
        scoped_thread_ids,
    )
    outbound_by_thread = email_workflow.outbound_messages_for_threads(
        db,
        scoped_thread_ids,
    )
    pending_by_thread = email_workflow.pending_replies(db, scoped_thread_ids)
    eligible: list[tuple] = []
    skipped: list[dict] = []
    for thread_id in payload.thread_ids:
        row = row_by_thread_id.get(thread_id)
        if row is None:
            skipped.append(
                {"thread_id": thread_id, "reason": "Email thread not found."}
            )
            continue
        thread, application, candidate, _job, _company, _match = row
        if not candidate.email:
            skipped.append(
                {"thread_id": thread_id, "reason": "Candidate email is missing."}
            )
            continue
        required_stage = {
            "interview_details": "Interview",
            "rejection_follow_up": "Rejected",
        }.get(payload.intent)
        if required_stage and application.current_stage != required_stage:
            skipped.append(
                {
                    "thread_id": thread_id,
                    "reason": (
                        f"Move the candidate to {required_stage} before generating "
                        f"this Smart Reply; the application is at "
                        f"{application.current_stage}."
                    ),
                }
            )
            continue
        inbound_messages = inbound_by_thread.get(thread_id, [])
        if not inbound_messages:
            skipped.append(
                {
                    "thread_id": thread_id,
                    "reason": (
                        "A candidate reply is required before generating Smart Reply."
                    ),
                }
            )
            continue
        if thread_id in pending_by_thread:
            skipped.append(
                {
                    "thread_id": thread_id,
                    "reason": "Review or send the existing Smart Reply draft first.",
                }
            )
            continue
        eligible.append(row)

    if not eligible:
        return SmartReplyBatchResponse(drafts=[], skipped=skipped)

    first_company = eligible[0][4]
    company_name = first_company.company_name
    hr_name = account.full_name or "Recruiting Team"
    account_id = account.account_id
    scheduled_interview_date = (
        calculate_interview_date(
            lead_days=payload.interview_lead_days,
            today=today or date.today(),
        )
        if payload.intent == "interview_details"
        else None
    )
    validation_values = [
        _template_values(
            candidate_name=candidate.full_name or "Candidate",
            job_title=job.title,
            company_name=company.company_name,
            hr_name=hr_name,
            application_stage=application.current_stage,
            scheduled_interview_date=scheduled_interview_date,
            interview_window=DEFAULT_INTERVIEW_WINDOW,
        )
        for _thread, application, candidate, job, company, _match in eligible
    ]
    recipient_conversations = [
        _conversation_context(
            outbound_by_thread.get(thread.thread_id, []),
            inbound_by_thread.get(thread.thread_id, []),
        )
        for thread, *_rest in eligible
    ]
    recipient_highlights = [
        _candidate_highlights(row[5]) for row in eligible
    ]
    if len(eligible) == 1:
        _thread, application, _candidate, job, _company, _match = eligible[0]
        safe_recipient_context = {
            "job_title": job.title,
            "applied_at": application.applied_at,
            "current_stage": application.current_stage,
            "candidate_highlights": recipient_highlights[0],
            "conversation": recipient_conversations[0],
        }
    else:
        common_highlights = set(recipient_highlights[0])
        for highlights in recipient_highlights[1:]:
            common_highlights.intersection_update(highlights)
        safe_recipient_context = {
            "job_title": "{{job_title}}",
            "applied_at": (
                "Recipient-specific dates are intentionally omitted from a shared batch reply."
            ),
            "current_stage": (
                next(iter({row[1].current_stage for row in eligible}))
                if len({row[1].current_stage for row in eligible}) == 1
                else "Varies by recipient"
            ),
            "candidate_highlights": sorted(common_highlights),
            "conversation": _shared_conversation_context(recipient_conversations),
        }
    grounded_context = {
        "template_purpose": (
            "Write a reusable reply to the candidates' latest inbound messages. "
            "Address only facts shared across the supplied conversations; if a "
            "fact is not available for every recipient, say the recruiting team "
            "will follow up instead of making a candidate-specific claim."
        ),
        "company_name": company_name,
        "hr_name": hr_name,
        "tone": payload.tone,
        "intent": payload.intent,
        "recipient_count": len(eligible),
        "interview_date": scheduled_interview_date,
        "interview_window": DEFAULT_INTERVIEW_WINDOW,
        "hr_guidance": payload.guidance,
        "recipient_context": safe_recipient_context,
    }
    generated, ai_generated = _generate_shared_template(
        template_key=(
            "interview" if payload.intent == "interview_details" else "follow_up"
        ),
        company_name=company_name,
        hr_name=hr_name,
        recipient_count=len(eligible),
        context=grounded_context,
        scheduled_interview_date=scheduled_interview_date,
        validation_values=validation_values,
        client=client,
        forbidden_shared_literals=(
            {row[3].title for row in eligible}
            if len({row[3].title for row in eligible}) > 1
            else None
        ),
    )
    draft_items: list[dict] = []
    for thread, application, candidate, job, company, _match in eligible:
        values = _template_values(
            candidate_name=candidate.full_name or "Candidate",
            job_title=job.title,
            company_name=company.company_name,
            hr_name=hr_name,
            application_stage=application.current_stage,
            scheduled_interview_date=scheduled_interview_date,
            interview_window=DEFAULT_INTERVIEW_WINDOW,
        )
        generated_subject, body = render(generated, values)
        if not generated_subject or len(generated_subject) > 300:
            raise TemplateValidationError(
                "Rendered email subject must contain 1 to 300 characters."
            )
        validate_rendered(body, company_name=company.company_name)
        validate_rendered(
            f"{generated_subject}\n\n{body}",
            company_name=company.company_name,
        )
        inbound_messages = inbound_by_thread[thread.thread_id]
        latest_inbound = inbound_messages[-1]
        draft_items.append(
            {
                "application_id": application.application_id,
                "thread_id": thread.thread_id,
                "message_kind": "Reply",
                "stage_at_generation": application.current_stage,
                "recipient_email": candidate.email,
                "subject": _reply_subject(latest_inbound.subject),
                "body": body,
                "in_reply_to": latest_inbound.provider_message_id,
                "references_json": _thread_references(inbound_messages),
                "account_id": account_id,
            }
        )
    job_id_by_application = {
        application.application_id: job.job_id
        for _thread, application, _candidate, job, _company, _match in eligible
    }
    db.commit()
    locked_states = {
        application_id: (current_stage, status)
        for application_id, current_stage, status in (
            email_workflow.lock_applications_for_email(
                db,
                company_id=company_id,
                application_ids=[
                    int(item["application_id"]) for item in draft_items
                ],
            )
        )
    }
    raced_pending = email_workflow.pending_replies(
        db,
        [int(item["thread_id"]) for item in draft_items],
    )
    filtered_items: list[dict] = []
    for item in draft_items:
        application_id = int(item["application_id"])
        thread_id = int(item["thread_id"])
        expected_stage = str(item["stage_at_generation"])
        state = locked_states.get(application_id)
        reason = None
        if state is None:
            reason = "Application is no longer available to this company."
        elif state[0] != expected_stage:
            reason = (
                f"Application moved from {expected_stage} to {state[0]} while "
                "the reply was being prepared. Refresh the conversation."
            )
        elif thread_id in raced_pending:
            reason = "Another request already created a Smart Reply draft."
        if reason is not None:
            skipped.append({"thread_id": thread_id, "reason": reason})
            continue
        filtered_items.append(item)

    if not filtered_items:
        db.rollback()
        return SmartReplyBatchResponse(drafts=[], skipped=skipped)

    kept_application_ids = {
        int(item["application_id"]) for item in filtered_items
    }
    kept_job_ids = {
        job_id_by_application[application_id]
        for application_id in kept_application_ids
    }
    kept_stages = {
        str(item["stage_at_generation"]) for item in filtered_items
    }
    campaign = email_workflow.create_campaign(
        db,
        company_id=company_id,
        job_id=next(iter(kept_job_ids)) if len(kept_job_ids) == 1 else None,
        account_id=account_id,
        template_key="smart-reply",
        target_stage=(
            next(iter(kept_stages)) if len(kept_stages) == 1 else "Mixed"
        ),
        recipient_count=len(filtered_items),
        interview_date=scheduled_interview_date,
        template_json=generated.model_dump(mode="json"),
        ai_generated=ai_generated,
        commit=False,
    )
    campaign_id = campaign.campaign_id
    drafts = email_workflow.create_drafts(
        db,
        campaign_id,
        filtered_items,
    )
    response_rows = email_workflow.rows_by_email_ids(
        db,
        [draft.email_id for draft in drafts],
        company_id,
    )
    responses = [_draft_response(row) for row in response_rows]
    return SmartReplyBatchResponse(drafts=responses, skipped=skipped)


def generate_smart_reply(
    db: Session,
    account: Account,
    thread_id: int,
    payload: SmartReplyGenerate,
    *,
    client: GeminiClient | None = None,
) -> EmailDraftResponse:
    result = generate_smart_reply_batch(
        db,
        account,
        SmartReplyBatchRequest(
            thread_ids=[thread_id],
            tone=payload.tone,
            intent=payload.intent,
            guidance=payload.guidance,
        ),
        client=client,
    )
    if result.drafts:
        return result.drafts[0]
    reason = result.skipped[0]["reason"]
    if reason == "Email thread not found.":
        raise HTTPException(status_code=404, detail=reason)
    if reason == "Candidate email is missing.":
        raise HTTPException(status_code=422, detail=reason)
    if reason.startswith("Move the candidate to "):
        raise HTTPException(status_code=422, detail=reason)
    raise HTTPException(status_code=409, detail=reason)
