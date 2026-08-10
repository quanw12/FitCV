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
        second_candidate = Candidate(
            full_name="Tran An",
            email="an@example.com",
            phone="0900000001",
        )
        self.db.add(second_candidate)
        self.db.flush()
        second_cv = Cv(
            candidate_id=second_candidate.candidate_id,
            file_name="an.pdf",
            file_path="applications/an.pdf",
            file_type="PDF",
            file_size_kb=120,
        )
        self.db.add(second_cv)
        self.db.flush()
        second_application = Application(
            candidate_id=second_candidate.candidate_id,
            job_id=job.job_id,
            cv_id=second_cv.cv_id,
        )
        self.db.add(second_application)
        self.db.flush()
        self.db.add(
            MatchResult(
                cv_id=second_cv.cv_id,
                job_id=job.job_id,
                application_id=second_application.application_id,
                status="Success",
                overall_score=42,
                match_label="Weak Match",
                algorithm_version="fitcv-deterministic-v1",
            )
        )
        self.db.commit()
        self.application_id = application.application_id
        self.second_application_id = second_application.application_id

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
        listed_by_id = {
            item["application_id"]: item for item in listed.json()
        }
        self.assertEqual(
            listed_by_id[self.application_id]["candidate_name"], "Nguyen Minh"
        )
        self.assertEqual(listed_by_id[self.application_id]["overall_score"], 88.0)

        moved_to_screening = self.client.patch(
            f"/api/hr/pipeline/applications/{self.application_id}/stage",
            json={"stage": "Screening"},
        )
        self.assertEqual(moved_to_screening.status_code, 200)
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
        self.assertEqual(history.json()[0]["previous_stage"], "Screening")
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
        listed_by_id = {
            item["application_id"]: item for item in listed.json()
        }
        self.assertEqual(listed_by_id[self.application_id]["note_count"], 1)

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

    def test_bulk_stage_update_changes_selected_applications(self) -> None:
        first_step = self.client.patch(
            "/api/hr/pipeline/applications/bulk-stage",
            json={
                "application_ids": [
                    self.application_id,
                    self.second_application_id,
                ],
                "stage": "Screening",
            },
        )
        self.assertEqual(first_step.status_code, 200)
        updated = self.client.patch(
            "/api/hr/pipeline/applications/bulk-stage",
            json={
                "application_ids": [
                    self.application_id,
                    self.second_application_id,
                ],
                "stage": "Interview",
            },
        )

        self.assertEqual(updated.status_code, 200)
        payload = updated.json()
        self.assertEqual(
            [item["application_id"] for item in payload["updated"]],
            [self.application_id, self.second_application_id],
        )
        self.assertEqual(payload["skipped_application_ids"], [])
        self.assertEqual(len(payload["history_ids"]), 2)

        history = self.client.get(
            f"/api/hr/pipeline/applications/{self.second_application_id}/history"
        )
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["new_stage"], "Interview")

    def test_bulk_stage_update_enforces_company_scope(self) -> None:
        self.current_account = self.outsider

        response = self.client.patch(
            "/api/hr/pipeline/applications/bulk-stage",
            json={"application_ids": [self.application_id], "stage": "Offer"},
        )

        self.assertEqual(response.status_code, 404)

    def test_bulk_stage_update_reports_noop_ids(self) -> None:
        response = self.client.patch(
            "/api/hr/pipeline/applications/bulk-stage",
            json={"application_ids": [self.application_id], "stage": "Applied"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], [])
        self.assertEqual(
            response.json()["skipped_application_ids"], [self.application_id]
        )

    def test_terminal_stage_updates_recruitment_status(self) -> None:
        for stage in ("Screening", "Interview", "Offer"):
            response = self.client.patch(
                f"/api/hr/pipeline/applications/{self.application_id}/stage",
                json={"stage": stage},
            )
            self.assertEqual(response.status_code, 200)
        hired = self.client.patch(
            f"/api/hr/pipeline/applications/{self.application_id}/stage",
            json={"stage": "Hired"},
        )
        self.assertEqual(hired.status_code, 200)
        self.assertEqual(hired.json()["status"], "Hired")

    def test_invalid_transition_returns_allowed_stages(self) -> None:
        response = self.client.patch(
            f"/api/hr/pipeline/applications/{self.application_id}/stage",
            json={"stage": "Offer"},
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json()["detail"]["allowed_stages"],
            ["Rejected", "Screening"],
        )

    def test_reopen_invalidates_pending_email_draft(self) -> None:
        from app.models import CandidateEmail

        application = self.db.get(Application, self.application_id)
        assert application is not None
        application.current_stage = "Rejected"
        application.status = "Rejected"
        self.db.add(
            CandidateEmail(
                company_id=self.manager.company_id,
                application_id=self.application_id,
                template_key="rejection",
                message_kind="Initial",
                stage_at_generation="Rejected",
                recipient_email="minh@example.com",
                subject="Review",
                body="Review",
                status="Approved",
                created_by_account_id=self.manager.account_id,
            )
        )
        self.db.commit()

        reopened = self.client.post(
            f"/api/hr/pipeline/applications/{self.application_id}/reopen"
        )
        self.assertEqual(reopened.status_code, 200)
        self.assertEqual(reopened.json()["current_stage"], "Applied")
        self.assertEqual(reopened.json()["status"], "Active")
        draft = self.db.query(CandidateEmail).one()
        self.assertEqual(draft.status, "Invalidated")


if __name__ == "__main__":
    unittest.main()
