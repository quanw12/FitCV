from __future__ import annotations

import asyncio
import logging
import socket
import threading
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.improvement import AiTask
from app.repositories import ai_tasks

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _worker_id() -> str:
    return f"{socket.gethostname()}-{uuid4().hex[:10]}"


def _dispatch(task: AiTask) -> None:
    if task.task_type == "CvParse":
        from app.services.analyzer_service import run_cv_parse

        run_cv_parse(
            task.resource_id,
            terminal_failure=task.attempt_count >= task.max_attempts,
            raise_on_failure=True,
        )
        return
    if task.task_type == "MatchAnalysis":
        from app.services.analyzer_service import run_match_task

        run_match_task(task.resource_id, raise_on_failure=True)
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


def kick_worker_once() -> None:
    """Opportunistically process one durable task after an API response."""
    process_one(f"web-{_worker_id()}")


def recover_stale_tasks() -> int:
    db = SessionLocal()
    try:
        return ai_tasks.recover_stale(
            db,
            stale_before=_now() - timedelta(seconds=settings.ai_worker_lease_seconds),
            now=_now(),
        )
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
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.ai_worker_poll_seconds)
            except TimeoutError:
                pass
