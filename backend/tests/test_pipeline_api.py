import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models import Application, Candidate, Company, Cv, Job, MatchResult
from app.models.account import Account, AccountRole, AuthProvider


class PipelineApiIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        company = Company(company_name="FitCV Labs")
        other_company = Company(company_name="Other Labs")
        self.db.add_all([company, other_company])
        self.db.flush()
        self.manager = Account(
            email="pipeline-manager@example.com",
            password_hash="test",
            full_name="Pipeline Manager",
            role=AccountRole.hr,
            company_id=company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.outsider = Account(
            email="pipeline-outsider@example.com",
            password_hash="test",
            full_name="Other Manager",
            role=AccountRole.hiring_manager,
            company_id=other_company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.db.add_all([self.manager, self.outsider])
        self.db.flush()

        job = Job(
            company_id=company.company_id,
            created_by_account_id=self.manager.account_id,
            title="Backend Engineer",
            status="Published",
        )
        candidate = Candidate(
            full_name="Nguyen Minh",
            email="minh@example.com",
            phone="0900000000",
        )
        self.db.add_all([job, candidate])
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
        self.db.commit()
        self.application_id = application.application_id

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

    def test_lists_moves_and_records_history(self) -> None:
        listed = self.client.get("/api/hr/pipeline")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()[0]["candidate_name"], "Nguyen Minh")
        self.assertEqual(listed.json()[0]["overall_score"], 88.0)

        moved = self.client.patch(
            f"/api/hr/pipeline/applications/{self.application_id}/stage",
            json={"stage": "Interview"},
        )
        self.assertEqual(moved.status_code, 200)
        self.assertEqual(moved.json()["current_stage"], "Interview")
        self.assertEqual(moved.json()["status"], "Active")

        history = self.client.get(
            f"/api/hr/pipeline/applications/{self.application_id}/history"
        )
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["previous_stage"], "Applied")
        self.assertEqual(history.json()[0]["new_stage"], "Interview")

    def test_adds_notes_and_updates_note_count(self) -> None:
        created = self.client.post(
            f"/api/hr/pipeline/applications/{self.application_id}/notes",
            json={"content": "Strong API evidence. Schedule technical interview."},
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["author_name"], "Pipeline Manager")

        notes = self.client.get(
            f"/api/hr/pipeline/applications/{self.application_id}/notes"
        )
        self.assertEqual(len(notes.json()), 1)

        listed = self.client.get("/api/hr/pipeline")
        self.assertEqual(listed.json()[0]["note_count"], 1)

    def test_company_scope_hides_other_applications(self) -> None:
        self.current_account = self.outsider

        listed = self.client.get("/api/hr/pipeline")
        moved = self.client.patch(
            f"/api/hr/pipeline/applications/{self.application_id}/stage",
            json={"stage": "Screening"},
        )

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json(), [])
        self.assertEqual(moved.status_code, 404)

    def test_terminal_stage_updates_recruitment_status(self) -> None:
        hired = self.client.patch(
            f"/api/hr/pipeline/applications/{self.application_id}/stage",
            json={"stage": "Hired"},
        )
        self.assertEqual(hired.status_code, 200)
        self.assertEqual(hired.json()["status"], "Hired")


if __name__ == "__main__":
    unittest.main()
