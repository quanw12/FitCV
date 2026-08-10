from unittest.mock import MagicMock, patch

import pytest

from app.models.analyzer import MatchResult
from app.models.improvement import AiTask
from app.services import ai_worker
from app.services.analyzer_service import (
    MatchTaskError,
    _safe_match_error_message,
    run_match_task,
)
from app.services.gemini_analyzer import GeminiAnalyzerError


PRIVATE_FAILURE = (
    "Gemini raw payload for jane.doe@example.com at "
    "https://generativelanguage.googleapis.com/v1/models/test?key=secret-key: "
    '{"candidate": {"name": "Jane Doe", "token": "secret-token"}}\n'
    "Traceback (most recent call last): database fitcv at mysql://private-host"
)
PUBLIC_FAILURE = "The matching provider is unavailable. Please try again later."


def _failed_match_session() -> tuple[MagicMock, MatchResult]:
    db = MagicMock()
    match = MatchResult(match_result_id=17, status="Pending")
    db.get.return_value = match
    return db, match


def test_match_task_persists_and_raises_only_the_sanitized_cause() -> None:
    db, match = _failed_match_session()
    parsed_cv = MagicMock(
        parsed_json={"skills": ["Python"]}, parsed_text="Private CV text"
    )
    parsed_jd = MagicMock(parsed_json={"required_skills": ["Python"]})
    description = MagicMock(raw_text="Private JD text")

    with (
        patch("app.services.analyzer_service.SessionLocal", return_value=db),
        patch("app.services.analyzer_service.analyzer.set_match_processing"),
        patch(
            "app.services.analyzer_service.analyzer.get_match_context",
            return_value=(match, parsed_cv, parsed_jd, description),
        ),
        patch(
            "app.services.analyzer_service.score_match",
            side_effect=GeminiAnalyzerError(PRIVATE_FAILURE),
        ),
        patch(
            "app.services.analyzer_service.analyzer.set_match_failed"
        ) as set_match_failed,
    ):
        with pytest.raises(MatchTaskError, match=PUBLIC_FAILURE) as raised:
            run_match_task(17, raise_on_failure=True)

    set_match_failed.assert_called_once_with(db, match, PUBLIC_FAILURE)
    assert str(raised.value) == PUBLIC_FAILURE
    for private_value in (
        "jane.doe@example.com",
        "Jane Doe",
        "secret-key",
        "secret-token",
        "https://",
        "?key=",
        "candidate",
        "Traceback",
        "mysql://",
        "private-host",
    ):
        assert private_value not in str(raised.value)
    db.rollback.assert_called_once_with()
    db.close.assert_called_once_with()


def test_match_task_keeps_boolean_failure_for_direct_callers() -> None:
    db, match = _failed_match_session()
    with (
        patch("app.services.analyzer_service.SessionLocal", return_value=db),
        patch("app.services.analyzer_service.analyzer.set_match_processing"),
        patch(
            "app.services.analyzer_service.analyzer.get_match_context",
            side_effect=LookupError(PRIVATE_FAILURE),
        ),
        patch(
            "app.services.analyzer_service.analyzer.set_match_failed"
        ) as set_match_failed,
    ):
        assert run_match_task(17) is False

    set_match_failed.assert_called_once_with(
        db, match, "Required CV/JD matching data was not found."
    )
    db.close.assert_called_once_with()


def test_match_task_maps_missing_gemini_model_to_configuration_error() -> None:
    error = GeminiAnalyzerError("Gemini request failed with 404: model not found")

    assert (
        _safe_match_error_message(error)
        == "The matching provider is not configured correctly."
    )


def test_match_dispatch_propagates_typed_safe_error_to_queue_worker() -> None:
    task = AiTask(
        ai_task_id=23,
        task_type="MatchAnalysis",
        resource_id=17,
        attempt_count=1,
        max_attempts=3,
    )
    with patch(
        "app.services.analyzer_service.run_match_task",
        side_effect=MatchTaskError(PUBLIC_FAILURE),
    ) as run_task:
        with pytest.raises(MatchTaskError, match=PUBLIC_FAILURE):
            ai_worker._dispatch(task)

    run_task.assert_called_once_with(17, raise_on_failure=True)


def test_queue_worker_records_the_typed_safe_cause() -> None:
    task = AiTask(
        ai_task_id=23,
        task_type="MatchAnalysis",
        resource_id=17,
        attempt_count=1,
        max_attempts=3,
    )
    claim_db = MagicMock()
    failure_db = MagicMock()
    heartbeat = MagicMock()

    with (
        patch(
            "app.services.ai_worker.SessionLocal",
            side_effect=[claim_db, failure_db],
        ),
        patch("app.services.ai_worker.ai_tasks.claim_next", return_value=task),
        patch(
            "app.services.ai_worker._dispatch",
            side_effect=MatchTaskError(PUBLIC_FAILURE),
        ),
        patch("app.services.ai_worker.threading.Thread", return_value=heartbeat),
        patch("app.services.ai_worker.ai_tasks.fail_or_retry") as fail_or_retry,
    ):
        assert ai_worker.process_one("worker-test") is True

    assert fail_or_retry.call_args.kwargs["error_message"] == PUBLIC_FAILURE
    assert fail_or_retry.call_args.kwargs["error_message"] != "CV/JD matching failed."
    heartbeat.start.assert_called_once_with()
    heartbeat.join.assert_called_once_with(timeout=1)
