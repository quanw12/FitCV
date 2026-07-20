from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models.account import Account, AuthProvider
from app.models.analyzer import (
    Cv,
    CvParseResult,
    JdParseResult,
    JobDescription,
    MatchResult,
)
from app.repositories import analyzer


@pytest.fixture()
def history_client() -> Iterator[tuple[TestClient, Session, Account]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[
            Account.__table__,
            Cv.__table__,
            CvParseResult.__table__,
            JobDescription.__table__,
            JdParseResult.__table__,
            MatchResult.__table__,
        ],
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_factory()
    account = Account(
        email="history@example.com",
        password_hash="test",
        full_name="History Student",
        auth_provider=AuthProvider.password,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_account] = lambda: account
    try:
        with TestClient(app) as client:
            yield client, db, account
    finally:
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()


def _cv(db: Session, account: Account, version: int) -> tuple[Cv, CvParseResult]:
    cv, parsed = analyzer.create_cv(
        db,
        account_id=account.account_id,
        file_name=f"cv-v{version}.pdf",
        file_path=f"cv/{account.account_id}/v{version}.pdf",
        file_type="PDF",
        file_size_kb=20,
        file_sha256=str(version) * 64,
        parser_version="test-parser-v1",
    )
    analyzer.set_parse_success(
        db,
        parsed,
        text="Python FastAPI developer",
        payload={
            "skills": ["Python", "FastAPI"],
            "experience_years": version,
            "education": "Bachelor",
            "soft_skills": ["Communication"],
        },
    )
    return cv, parsed


def _jd(
    db: Session,
    account: Account,
    *,
    title: str,
    digest: str,
    required: list[str],
    preferred: list[str] | None = None,
) -> tuple[JobDescription, JdParseResult]:
    return analyzer.get_or_create_job_description(
        db,
        account_id=account.account_id,
        title=title,
        raw_text=f"{title} requires {', '.join(required)}",
        content_sha256=digest * 64,
        parsed_payload={
            "required_skills": required,
            "preferred_skills": preferred or [],
            "soft_skills": ["Communication"],
            "experience_years": 2,
            "education": "Bachelor",
        },
        parser_version="test-parser-v1",
    )


def _completed_match(
    db: Session,
    cv: Cv,
    parsed_cv: CvParseResult,
    description: JobDescription,
    parsed_jd: JdParseResult,
    *,
    score: float,
    missing: list[str],
    algorithm: str,
) -> MatchResult:
    match = analyzer.create_pending_match(
        db,
        cv=cv,
        parsed_cv=parsed_cv,
        description=description,
        parsed_jd=parsed_jd,
        algorithm_version=algorithm,
    )
    analyzer.set_match_success(
        db,
        match,
        {
            "overall_score": score,
            "pass_probability": score,
            "match_label": "Strong Match" if score >= 80 else "Moderate Match",
            "breakdown": {
                "skills": {
                    "score": score,
                    "matched": ["Python"],
                    "missing": missing,
                    "detail": "Evidence comparison",
                },
                "experience": {
                    "score": score,
                    "matched": [],
                    "missing": [],
                    "detail": "",
                },
                "education": {
                    "score": score,
                    "matched": [],
                    "missing": [],
                    "detail": "",
                },
                "soft_skills": {
                    "score": score,
                    "matched": [],
                    "missing": [],
                    "detail": "",
                },
            },
            "strengths": ["Python"],
            "weaknesses": missing,
            "suggestions": [],
            "match_summary": "Test match",
        },
    )
    db.refresh(match)
    return match


def test_cv_comparison_api_groups_same_jd_and_uses_latest_score(history_client) -> None:
    client, db, account = history_client
    cv1, parsed1 = _cv(db, account, 1)
    cv2, parsed2 = _cv(db, account, 2)
    description, parsed_jd = _jd(
        db,
        account,
        title="Backend Developer",
        digest="a",
        required=["Python", "FastAPI"],
    )
    _completed_match(
        db,
        cv1,
        parsed1,
        description,
        parsed_jd,
        score=55,
        missing=["FastAPI"],
        algorithm="comparison-v1",
    )
    _completed_match(
        db,
        cv2,
        parsed2,
        description,
        parsed_jd,
        score=72,
        missing=[],
        algorithm="comparison-v1",
    )
    _completed_match(
        db,
        cv2,
        parsed2,
        description,
        parsed_jd,
        score=82,
        missing=[],
        algorithm="comparison-v2",
    )

    response = client.get("/api/cvs/comparisons")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["title"] == "Backend Developer"
    assert [point["overall_score"] for point in payload[0]["versions"]] == [55, 82]
    assert payload[0]["versions"][1]["delta_from_previous"] == 27
    assert payload[0]["latest_delta"] == 27
    assert payload[0]["best_score"] == 82


def test_jd_library_api_aggregates_demand_and_missing_skills(history_client) -> None:
    client, db, account = history_client
    cv1, parsed1 = _cv(db, account, 1)
    cv2, parsed2 = _cv(db, account, 2)
    backend_jd, backend_parse = _jd(
        db,
        account,
        title="Backend Developer",
        digest="b",
        required=["Python", "FastAPI"],
        preferred=["Docker"],
    )
    data_jd, data_parse = _jd(
        db,
        account,
        title="Data Engineer",
        digest="c",
        required=["python", "SQL"],
        preferred=["AWS"],
    )
    _completed_match(
        db,
        cv1,
        parsed1,
        backend_jd,
        backend_parse,
        score=60,
        missing=["Docker", "Docker"],
        algorithm="insight-v1",
    )
    _completed_match(
        db,
        cv2,
        parsed2,
        data_jd,
        data_parse,
        score=80,
        missing=["AWS"],
        algorithm="insight-v1",
    )

    library = client.get("/api/jd-library")
    insights = client.get("/api/jd-library/insights")

    assert library.status_code == 200
    assert {item["title"] for item in library.json()} == {
        "Backend Developer",
        "Data Engineer",
    }
    payload = insights.json()
    assert payload["total_job_descriptions"] == 2
    assert payload["total_matches"] == 2
    assert payload["average_match_score"] == 70
    assert payload["required_skills"][0] == {
        "skill": "Python",
        "count": 2,
        "percentage": 100,
    }
    assert {item["skill"] for item in payload["missing_skills"]} == {"Docker", "AWS"}
    assert all(item["count"] == 1 for item in payload["missing_skills"])


def test_jd_library_search_and_ownership_are_enforced(history_client) -> None:
    client, db, account = history_client
    description, _ = _jd(
        db,
        account,
        title="Cybersecurity Intern",
        digest="d",
        required=["Wireshark"],
    )

    search = client.get("/api/jd-library?q=cyber")
    missing = client.get(f"/api/jd-library/{description.job_description_id + 999}")

    assert search.status_code == 200
    assert [item["title"] for item in search.json()] == ["Cybersecurity Intern"]
    assert missing.status_code == 404
