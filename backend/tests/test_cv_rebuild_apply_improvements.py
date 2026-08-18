from __future__ import annotations

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models.account import Account, AccountRole, AuthProvider
from app.models.analyzer import Cv, CvParseResult, JobDescription, MatchResult
from app.models.improvement import (
    CvImprovementSuggestion,
    SuggestionCategory,
    SuggestionPriority,
    SuggestionType,
)
from app.schemas.cv_rebuild import CVData, CvRebuildResponse
from app.services.cv_rebuild import orchestrator
from app.services.cv_rebuild.improvement_applier import build_applied_instructions
from app.services.cv_rebuild.prompts import build_polish_prompt


@dataclass
class ApplyHarness:
    client: TestClient
    factory: sessionmaker
    accounts: dict[str, Account]
    current_account: dict[str, Account]
    match_ids: dict[str, int]
    suggestion_ids: dict[str, int]


def _add_match(db: Session, account: Account, *, version: int, parsed_text: str) -> tuple[MatchResult, CvImprovementSuggestion]:
    cv = Cv(
        account_id=account.account_id,
        file_name=f"cv-{version}.pdf",
        file_path=f"/tmp/cv-{version}.pdf",
        file_type="PDF",
        version_number=version,
    )
    db.add(cv)
    db.flush()
    parsed = CvParseResult(
        cv_id=cv.cv_id,
        parsed_text=parsed_text,
        parse_status="Success",
    )
    job_description = JobDescription(
        account_id=account.account_id,
        title="Backend Engineer",
        raw_text="Backend role requires Python, FastAPI, and clear API experience.",
        content_sha256=f"hash-{account.account_id}-{version}",
    )
    db.add_all([parsed, job_description])
    db.flush()
    match = MatchResult(
        cv_id=cv.cv_id,
        cv_parse_id=parsed.cv_parse_id,
        job_description_id=job_description.job_description_id,
        status="Success",
        overall_score=60,
    )
    db.add(match)
    db.flush()
    suggestion = CvImprovementSuggestion(
        match_result_id=match.match_result_id,
        suggestion_type=SuggestionType.rewrite,
        category=SuggestionCategory.experience,
        section="WorkExperience",
        original_text="Built APIs.",
        suggested_text="Built Python APIs for the order workflow.",
        explanation="Make the existing experience statement more specific.",
        priority=SuggestionPriority.medium,
    )
    db.add(suggestion)
    db.flush()
    return match, suggestion


@pytest.fixture
def apply_harness() -> ApplyHarness:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = sessionmaker(bind=engine)
    Base.metadata.create_all(
        engine,
        tables=[
            Account.__table__,
            Cv.__table__,
            CvParseResult.__table__,
            JobDescription.__table__,
            MatchResult.__table__,
            CvImprovementSuggestion.__table__,
        ],
    )
    db = factory()
    owner = Account(
        email="owner@example.com",
        password_hash="test",
        full_name="Owner",
        role=AccountRole.student,
        auth_provider=AuthProvider.password,
    )
    other = Account(
        email="other@example.com",
        password_hash="test",
        full_name="Other",
        role=AccountRole.student,
        auth_provider=AuthProvider.password,
    )
    db.add_all([owner, other])
    db.flush()
    owned_match, owned_suggestion = _add_match(
        db,
        owner,
        version=1,
        parsed_text="Nguyen Van A. Built Python APIs at Acme.",
    )
    second_owned_match, second_owned_suggestion = _add_match(
        db,
        owner,
        version=2,
        parsed_text="Nguyen Van A. Built FastAPI services at Acme.",
    )
    other_match, _ = _add_match(
        db,
        other,
        version=1,
        parsed_text="Other candidate CV.",
    )
    db.commit()
    for account in (owner, other):
        db.refresh(account)
        db.expunge(account)
    ids = {
        "owned": owned_match.match_result_id,
        "other_owned": second_owned_match.match_result_id,
        "other_account": other_match.match_result_id,
    }
    suggestion_ids = {
        "owned": owned_suggestion.suggestion_id,
        "cross_match": second_owned_suggestion.suggestion_id,
    }
    db.close()

    current_account = {"value": owner}

    def override_db():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_account] = lambda: current_account["value"]
    client = TestClient(app)
    try:
        yield ApplyHarness(
            client=client,
            factory=factory,
            accounts={"owner": owner, "other": other},
            current_account=current_account,
            match_ids=ids,
            suggestion_ids=suggestion_ids,
        )
    finally:
        client.close()
        app.dependency_overrides.clear()
        engine.dispose()


def _post(harness: ApplyHarness, match_key: str, suggestion_ids: list[int]):
    return harness.client.post(
        f"/api/match-results/{harness.match_ids[match_key]}/apply-improvements",
        json={"suggestion_ids": suggestion_ids},
    )


def test_applies_owned_suggestions_from_saved_parse(apply_harness: ApplyHarness, monkeypatch) -> None:
    calls: list[dict] = []

    async def fake_rebuild(
        parsed_text,
        *,
        applied_improvements,
        jd_text=None,
        language=None,
        avatar=None,
        allowed_new_skills=None,
    ):
        calls.append(
            {
                "parsed_text": parsed_text,
                "instructions": applied_improvements,
                "jd_text": jd_text,
            }
        )
        return CvRebuildResponse(
            filename="improved_cv.pdf",
            preview_json=CVData(name="Nguyen Van A", skills=["Python"]),
            pdf_base64="cGRm",
            thumbnail_base64="dGh1bWI=",
        )

    monkeypatch.setattr(orchestrator, "rebuild_with_improvements", fake_rebuild)
    response = _post(apply_harness, "owned", [apply_harness.suggestion_ids["owned"]])
    assert response.status_code == 200, response.text
    assert response.json()["filename"] == "improved_cv.pdf"
    assert calls[0]["parsed_text"] == "Nguyen Van A. Built Python APIs at Acme."
    assert "[Rewrite · WorkExperience]" in calls[0]["instructions"]
    assert "Backend role requires Python" in calls[0]["jd_text"]


def test_rejects_suggestion_from_another_match(apply_harness: ApplyHarness) -> None:
    response = _post(apply_harness, "owned", [apply_harness.suggestion_ids["cross_match"]])
    assert response.status_code == 422
    assert "do not belong" in response.json()["detail"]


def test_hides_match_owned_by_another_account(apply_harness: ApplyHarness) -> None:
    apply_harness.current_account["value"] = apply_harness.accounts["other"]
    response = _post(apply_harness, "owned", [apply_harness.suggestion_ids["owned"]])
    assert response.status_code == 404


def test_returns_conflict_when_saved_parse_text_is_missing(apply_harness: ApplyHarness) -> None:
    with apply_harness.factory() as db:
        match = db.get(MatchResult, apply_harness.match_ids["owned"])
        assert match is not None
        parsed = db.get(CvParseResult, match.cv_parse_id)
        assert parsed is not None
        parsed.parsed_text = None
        db.commit()
    response = _post(apply_harness, "owned", [apply_harness.suggestion_ids["owned"]])
    assert response.status_code == 409
    assert "Re-upload the CV" in response.json()["detail"]


def test_request_schema_rejects_empty_selection(apply_harness: ApplyHarness) -> None:
    response = _post(apply_harness, "owned", [])
    assert response.status_code == 422


def test_skill_gap_instruction_approves_adding_missing_skill() -> None:
    row = CvImprovementSuggestion(
        suggestion_type=SuggestionType.skill_gap,
        category=SuggestionCategory.skill,
        suggested_text="Kubernetes",
        explanation="The job description requires it.",
        priority=SuggestionPriority.high,
    )
    instructions, approved_skills = build_applied_instructions([row])
    assert "[Skill gap · approved]" in instructions
    assert 'adding "Kubernetes" as a new skill' in instructions
    assert approved_skills == ["Kubernetes"]


def test_approved_skill_passes_grounding_whitelist() -> None:
    from app.schemas.cv_rebuild import CVData
    from app.services.cv_rebuild.llm_extractor import _filter_approved_skills
    from app.services.cv_rebuild.grounding import find_unfounded_skills

    source = CVData(name="A", skills=["Python"]).model_dump_json()
    polished = CVData(name="A", skills=["Python", "Kubernetes"])
    unfounded = find_unfounded_skills(source, polished)
    assert unfounded == ["Kubernetes"]
    # Approved skill is whitelisted; anything broader is still rejected.
    assert _filter_approved_skills(unfounded, ["Kubernetes"]) == []
    broader = CVData(name="A", skills=["Python", "Kubernetes cluster management"])
    unfounded_broader = find_unfounded_skills(source, broader)
    assert _filter_approved_skills(unfounded_broader, ["Kubernetes"]) == [
        "Kubernetes cluster management"
    ]


def test_polish_prompt_applies_only_selected_grounded_changes() -> None:
    prompt = build_polish_prompt(
        '{"name":"A"}',
        "en",
        jd_text="JD needs Python",
        applied_improvements="- [Rewrite · Summary] Improve the existing summary.",
    )
    assert "<jd_text>" in prompt
    assert "JD needs Python" in prompt
    assert "<approved_improvements>" in prompt
    assert "strict selected-change operation" in prompt
    assert "Preserve every field" in prompt
    assert "Never invent or infer a skill" in prompt
    assert "Never output placeholders" in prompt
    assert "permission to make any additional tailoring" in prompt
