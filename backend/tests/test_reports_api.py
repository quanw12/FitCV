import unittest
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models import (
    Application,
    ApplicationStageHistory,
    Candidate,
    Company,
    Cv,
    Job,
    MatchResult,
)
from app.models.account import Account, AccountRole, AuthProvider


class ReportApiIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        company = Company(company_name="FitCV Labs")
        self.db.add(company)
        self.db.flush()
        self.manager = Account(
            email="reports-manager@example.com",
            password_hash="test",
            full_name="Reports Manager",
            role=AccountRole.hr,
            company_id=company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.no_company = Account(
            email="lonely@example.com",
            password_hash="test",
            full_name="No Company",
            role=AccountRole.hr,
            auth_provider=AuthProvider.password,
        )
        self.student = Account(
            email="student@example.com",
            password_hash="test",
            full_name="Student",
            role=AccountRole.student,
            company_id=company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.db.add_all([self.manager, self.no_company, self.student])
        self.db.flush()

        job = Job(
            company_id=company.company_id,
            created_by_account_id=self.manager.account_id,
            title="Backend Engineer",
            status="Published",
        )
        self.db.add(job)
        self.db.flush()
        candidate = Candidate(full_name="Nguyen Minh", email="minh@example.com")
        self.db.add(candidate)
        self.db.flush()
        cv = Cv(
            candidate_id=candidate.candidate_id,
            file_name="minh.pdf",
            file_path="applications/minh.pdf",
            file_type="PDF",
            file_size_kb=120,
        )
        self.db.add(cv)
        self.db.flush()
        application = Application(
            candidate_id=candidate.candidate_id,
            job_id=job.job_id,
            cv_id=cv.cv_id,
            applied_at=datetime(2026, 7, 10, 9, 0, 0),
        )
        self.db.add(application)
        self.db.flush()
        self.db.add(
            MatchResult(
                cv_id=cv.cv_id,
                job_id=job.job_id,
                application_id=application.application_id,
                status="Success",
                overall_score=88,
                match_label="Strong Match",
                algorithm_version="fitcv-deterministic-v1",
            )
        )
        self.db.add(
            ApplicationStageHistory(
                application_id=application.application_id,
                previous_stage="Applied",
                new_stage="Screening",
                changed_at=datetime(2026, 7, 12, 10, 0, 0),
            )
        )
        self.db.commit()

        self.current_account = self.manager
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_account] = (
            lambda: self.current_account
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_summary_returns_real_values(self) -> None:
        response = self.client.get(
            "/api/hr/reports/summary", params={"from": "2026-07-01", "to": "2026-07-31"}
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["window"]["from"], "2026-07-01")
        self.assertEqual(payload["kpis"]["active_job_posts"], 1)
        self.assertEqual(payload["kpis"]["total_cvs_reviewed"], 1)
        self.assertEqual(payload["kpis"]["avg_candidate_score"], 88.0)
        self.assertEqual(payload["jobs"][0]["title"], "Backend Engineer")
        self.assertEqual(payload["jobs"][0]["cv_count"], 1)
        self.assertEqual(
            payload["charts"]["screening_pass_rate"]["passed_count"], 1
        )

    def test_empty_window_returns_zeros_and_nulls(self) -> None:
        response = self.client.get(
            "/api/hr/reports/summary",
            params={"from": "2025-01-01", "to": "2025-01-31"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["kpis"]["total_cvs_reviewed"], 0)
        self.assertIsNone(payload["kpis"]["avg_candidate_score"])
        self.assertIsNone(payload["kpis"]["time_to_shortlist_days"])
        # active jobs are current-state, not window-scoped; CV counts are 0
        self.assertEqual(payload["jobs"][0]["title"], "Backend Engineer")
        self.assertEqual(payload["jobs"][0]["cv_count"], 0)
        self.assertIsNone(payload["jobs"][0]["avg_score"])

    def test_invalid_window_is_422(self) -> None:
        response = self.client.get(
            "/api/hr/reports/summary",
            params={"from": "2026-08-01", "to": "2026-07-01"},
        )
        self.assertEqual(response.status_code, 422)

    def test_no_company_is_400(self) -> None:
        self.current_account = self.no_company
        response = self.client.get(
            "/api/hr/reports/summary", params={"from": "2026-07-01", "to": "2026-07-31"}
        )
        self.assertEqual(response.status_code, 400)

    def test_student_is_forbidden(self) -> None:
        self.current_account = self.student
        response = self.client.get(
            "/api/hr/reports/summary", params={"from": "2026-07-01", "to": "2026-07-31"}
        )
        self.assertEqual(response.status_code, 403)

    def test_summary_defaults_window_when_omitted(self) -> None:
        response = self.client.get("/api/hr/reports/summary")
        self.assertEqual(response.status_code, 200)
        self.assertIn("kpis", response.json())


if __name__ == "__main__":
    unittest.main()
