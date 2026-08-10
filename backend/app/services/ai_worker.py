from __future__ import annotations

import asyncio
import logging
import socket
import threading
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.config import settings
from app.db.session import SessionLocal
from fastapi import HTTPException

from app.models.account import Account
from app.models.improvement import AiTask
from app.repositories import ai_tasks, email_workflow

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _worker_id() -> str:
    return f"{socket.gethostname()}-{uuid4().hex[:10]}"


def _dispatch(task: AiTask) -> None:
    if task.task_type == "CvParse":
        from app.services.analyzer_service import run_cv_parse

        if not run_cv_parse(task.resource_id):
            raise RuntimeError("CV parsing failed.")
        return
    if task.task_type == "MatchAnalysis":
        from app.services.analyzer_service import run_match_task

        if not run_match_task(task.resource_id):
            raise RuntimeError("CV/JD matching failed.")
        return
    if task.task_type == "ApplicationAnalysis":
        from app.services.application_service import run_analysis

        if not run_analysis(task.resource_id):
            raise RuntimeError("Application analysis failed.")
        return
    if task.task_type == "ImprovementReport":
        from app.services.improvement_service import execute_generation_task

        execute_generation_task(task.ai_task_id)
        return
    if task.task_type == "ScreeningBatch":
        from app.services.cv_ranking_service import run_screening_batch

        run_screening_batch(task.resource_id)
        return
    raise RuntimeError(f"Unsupported AI task type: {task.task_type}")


def _heartbeat_loop(task_id: int, worker_id: str, stop: threading.Event) -> None:
    while not stop.wait(settings.ai_worker_heartbeat_seconds):
        db = SessionLocal()
        try:
            if not ai_tasks.heartbeat(db, task_id, worker_id=worker_id, now=_now()):
                return
        except Exception:
            db.rollback()
            logger.exception("AI task heartbeat failed for task_id=%s", task_id)
        finally:
            db.close()


def process_one(worker_id: str) -> bool:
    db = SessionLocal()
    try:
        task = ai_tasks.claim_next(db, worker_id=worker_id, now=_now())
    finally:
        db.close()
    if task is None:
        return False

    stop = threading.Event()
    heartbeat = threading.Thread(
        target=_heartbeat_loop,
        args=(task.ai_task_id, worker_id, stop),
        daemon=True,
    )
    heartbeat.start()
    try:
        _dispatch(task)
        db = SessionLocal()
        try:
            ai_tasks.complete(db, task.ai_task_id, worker_id=worker_id, now=_now())
        finally:
            db.close()
    except Exception as exc:
        logger.exception("AI task failed for task_id=%s", task.ai_task_id)
        delay_seconds = min(300, 2 ** max(0, task.attempt_count - 1) * 5)
        db = SessionLocal()
        try:
            ai_tasks.fail_or_retry(
                db,
                task.ai_task_id,
                worker_id=worker_id,
                now=_now(),
                available_at=_now() + timedelta(seconds=delay_seconds),
                error_message=str(exc) or "AI task failed.",
            )
        finally:
            db.close()
    finally:
        stop.set()
        heartbeat.join(timeout=1)
    return True


def process_one_email_job(worker_id: str) -> bool:
    db = SessionLocal()
    try:
        job = email_workflow.claim_next_send_job(
            db,
            worker_id=worker_id,
            now=_now(),
            lease_seconds=settings.ai_worker_lease_seconds,
        )
    finally:
        db.close()
    if job is None:
        return False

    db = SessionLocal()
    try:
        item = email_workflow.claim_next_send_job_item(db, job.job_id)
        account = db.get(Account, job.created_by_account_id)
    finally:
        db.close()
    if item is None:
        return True
    if account is None:
        db = SessionLocal()
        try:
            email_workflow.finish_send_job_item(
                db,
                job_id=job.job_id,
                email_id=item.email_id,
                status="Failed",
                error_message="The account that created this bulk send job no longer exists.",
                now=_now(),
            )
        finally:
            db.close()
        return True

    status = "Sent"
    error_message: str | None = None
    try:
        from app.services.email_workflow_service import send

        db = SessionLocal()
        try:
            send(db, account, item.email_id)
        finally:
            db.close()
    except HTTPException as exc:
        status = "Failed"
        error_message = str(exc.detail)
    except Exception as exc:
        logger.exception(
            "Bulk email job item failed: job_id=%s email_id=%s",
            job.job_id,
            item.email_id,
        )
        status = "Failed"
        error_message = str(exc) or "Email delivery failed."

    db = SessionLocal()
    try:
        email_workflow.finish_send_job_item(
            db,
            job_id=job.job_id,
            email_id=item.email_id,
            status=status,
            error_message=error_message,
            now=_now(),
        )
    finally:
        db.close()
    return True


def process_one_inbound_fetch(worker_id: str) -> bool:
    db = SessionLocal()
    try:
        inbound = email_workflow.claim_next_inbound_fetch(
            db,
            worker_id=worker_id,
            now=_now(),
        )
    finally:
        db.close()
    if inbound is None:
        return False

    try:
        from app.services.email_service import retrieve_received_email
        from app.services.email_webhook_service import (
            _bare_email,
            _body_text,
            _header,
            _safe_attachments,
        )

        content = retrieve_received_email(inbound.provider_email_id)
        content_sender = _bare_email(content.get("from"))
        if content_sender and content_sender != inbound.sender_email:
            raise RuntimeError(
                "Inbound email sender metadata does not match retrieved content."
            )
        body_text = _body_text(content) or "(No plain-text email content was provided.)"
        headers = content.get("headers")
        db = SessionLocal()
        try:
            email_workflow.complete_inbound_fetch(
                db,
                inbound_id=inbound.inbound_id,
                worker_id=worker_id,
                body_text=body_text,
                provider_message_id=(
                    str(content.get("message_id"))[:500]
                    if content.get("message_id")
                    else inbound.provider_message_id
                ),
                in_reply_to=_header(headers, "in-reply-to"),
                references_text=_header(headers, "references"),
                attachments_json=_safe_attachments(content.get("attachments")),
                fetched_at=_now(),
            )
        finally:
            db.close()
    except Exception as exc:
        logger.exception(
            "Inbound email fetch failed: inbound_id=%s", inbound.inbound_id
        )
        db = SessionLocal()
        try:
            email_workflow.fail_inbound_fetch(
                db,
                inbound_id=inbound.inbound_id,
                worker_id=worker_id,
                now=_now(),
                max_attempts=settings.ai_task_max_attempts,
                error_message=str(exc) or "Inbound email fetch failed.",
            )
        finally:
            db.close()
    return True


def kick_worker_once() -> None:
    """Opportunistically process one durable task after an API response."""
    worker_id = f"web-{_worker_id()}"
    process_one(worker_id) or process_one_email_job(worker_id) or process_one_inbound_fetch(
        worker_id
    )


def recover_stale_tasks() -> int:
    db = SessionLocal()
    try:
        recovered = ai_tasks.recover_stale(
            db,
            stale_before=_now() - timedelta(seconds=settings.ai_worker_lease_seconds),
            now=_now(),
        )
        recovered += email_workflow.recover_stale_send_jobs(
            db,
            stale_before=_now() - timedelta(seconds=settings.ai_worker_lease_seconds),
            now=_now(),
        )
        recovered += email_workflow.recover_stale_inbound_fetches(
            db,
            stale_before=_now() - timedelta(seconds=settings.ai_worker_lease_seconds),
            now=_now(),
        )
        return recovered
    finally:
        db.close()


async def run_worker(stop: asyncio.Event) -> None:
    worker_id = _worker_id()
    await asyncio.to_thread(recover_stale_tasks)
    loop = asyncio.get_running_loop()
    recovery_interval = max(5.0, min(60.0, settings.ai_worker_lease_seconds / 2))
    next_recovery_at = loop.time() + recovery_interval
    while not stop.is_set():
        if loop.time() >= next_recovery_at:
            await asyncio.to_thread(recover_stale_tasks)
            next_recovery_at = loop.time() + recovery_interval
        processed = await asyncio.to_thread(process_one, worker_id)
        if not processed:
            processed = await asyncio.to_thread(process_one_email_job, worker_id)
        if not processed:
            processed = await asyncio.to_thread(process_one_inbound_fetch, worker_id)
        if not processed:
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.ai_worker_poll_seconds)
            except TimeoutError:
                pass
