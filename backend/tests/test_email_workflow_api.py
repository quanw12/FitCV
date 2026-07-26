import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models import Application, Candidate, Company, Cv, Job, MatchResult
from app.models.account import Account, AccountRole, AuthProvider
from app.services.email_service import EmailDeliveryError


class FakeGemini:
    def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
        return {
            "subject": "Next steps for your Backend Engineer application",
            "body": (
                "Dear Nguyen Minh,\n\nThank you for your application. "
                "We would like to continue with the next step."
            ),
        }


class EmailWorkflowApiIntegrationTests(unittest.TestCase):
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
            email="email-manager@example.com",
            password_hash="test",
            full_name="Email Manager",
            role=AccountRole.hr,
            company_id=company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.outsider = Account(
            email="email-outsider@example.com",
            password_hash="test",
            full_name="Other Manager",
            role=AccountRole.hr,
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
        )
        self.db.add(cv)
        self.db.flush()
        application = Application(
            candidate_id=candidate.candidate_id,
            job_id=job.job_id,
            cv_id=cv.cv_id,
            current_stage="Screening",
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
                evidence_json={"strengths": ["Strong Python evidence."]},
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

    def generate_draft(self) -> dict:
        with patch(
            "app.services.email_workflow_service.GeminiClient",
            return_value=FakeGemini(),
        ):
            response = self.client.post(
                "/api/hr/emails/drafts/generate",
                json={
                    "application_id": self.application_id,
                    "template_key": "shortlist",
                },
            )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_review_approve_send_workflow(self) -> None:
        draft = self.generate_draft()
        self.assertEqual(draft["status"], "Draft")

        blocked = self.client.post(
            f"/api/hr/emails/drafts/{draft['email_id']}/send"
        )
        self.assertEqual(blocked.status_code, 409)

        edited = self.client.patch(
            f"/api/hr/emails/drafts/{draft['email_id']}",
            json={
                "subject": "Reviewed subject",
                "body": "Reviewed candidate email body.",
            },
        )
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.json()["subject"], "Reviewed subject")

        approved = self.client.post(
            f"/api/hr/emails/drafts/{draft['email_id']}/approve"
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["status"], "Approved")

        with patch(
            "app.services.email_workflow_service.send_candidate_email",
            return_value="resend-message-123",
        ):
            sent = self.client.post(
                f"/api/hr/emails/drafts/{draft['email_id']}/send"
            )
        self.assertEqual(sent.status_code, 200)
        self.assertEqual(sent.json()["status"], "Sent")
        self.assertEqual(
            sent.json()["provider_message_id"], "resend-message-123"
        )

    def test_failed_delivery_is_tracked_and_can_retry(self) -> None:
        draft = self.generate_draft()
        self.client.post(
            f"/api/hr/emails/drafts/{draft['email_id']}/approve"
        )
        with patch(
            "app.services.email_workflow_service.send_candidate_email",
            side_effect=EmailDeliveryError("Provider temporarily unavailable."),
        ):
            failed = self.client.post(
                f"/api/hr/emails/drafts/{draft['email_id']}/send"
            )
        self.assertEqual(failed.status_code, 502)

        listed = self.client.get("/api/hr/emails/drafts")
        self.assertEqual(listed.json()[0]["status"], "Failed")
        self.assertEqual(
            listed.json()[0]["error_message"],
            "Provider temporarily unavailable.",
        )

        with patch(
            "app.services.email_workflow_service.send_candidate_email",
            return_value="retry-message-123",
        ):
            retried = self.client.post(
                f"/api/hr/emails/drafts/{draft['email_id']}/send"
            )
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(retried.json()["status"], "Sent")

    def test_company_scope_hides_drafts(self) -> None:
        self.generate_draft()
        self.current_account = self.outsider

        listed = self.client.get("/api/hr/emails/drafts")

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json(), [])

    def test_template_library_is_manager_only(self) -> None:
        response = self.client.get("/api/hr/emails/templates")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {template["key"] for template in response.json()},
            {"confirmation", "shortlist", "interview", "rejection"},
        )


if __name__ == "__main__":
    unittest.main()
