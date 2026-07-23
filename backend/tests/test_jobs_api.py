from datetime import datetime, timedelta
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models import Company, Job
from app.models.account import Account, AccountRole, AuthProvider


class JobsApiIntegrationTests(unittest.TestCase):
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
            email="manager-jobs@example.com",
            password_hash="test",
            full_name="Job Manager",
            role=AccountRole.hr,
            company_id=company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.outsider = Account(
            email="outsider-jobs@example.com",
            password_hash="test",
            full_name="Other Manager",
            role=AccountRole.hiring_manager,
            company_id=other_company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.student = Account(
            email="student-jobs@example.com",
            password_hash="test",
            full_name="Student",
            role=AccountRole.student,
            auth_provider=AuthProvider.password,
        )
        self.db.add_all([self.manager, self.outsider, self.student])
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

    def create_published_job(self) -> Job:
        job = Job(
            company_id=self.manager.company_id,
            created_by_account_id=self.manager.account_id,
            title="Backend Engineer",
            description="Complete job description",
            requirements="Python and SQL",
            location="Ho Chi Minh City",
            employment_type="Full-time",
            status="Published",
            deadline=datetime.now() + timedelta(days=7),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def test_create_and_partially_update_custom_weights(self) -> None:
        response = self.client.post(
            "/api/jobs",
            json={
                "title": "Platform Engineer",
                "skill_weight": 40,
                "experience_weight": 35,
                "education_weight": 15,
                "soft_skill_weight": 10,
            },
        )

        self.assertEqual(response.status_code, 201)
        created = response.json()
        self.assertEqual(created["status"], "Draft")
        self.assertIsNone(created["archived_at"])
        self.assertEqual(created["skill_weight"], 40)
        self.assertEqual(created["experience_weight"], 35)

        updated = self.client.patch(
            f"/api/jobs/{created['job_id']}",
            json={
                "skill_weight": 45,
                "experience_weight": 30,
            },
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["skill_weight"], 45)
        self.assertEqual(updated.json()["experience_weight"], 30)

    def test_create_edit_publish_and_close_lifecycle(self) -> None:
        created = self.client.post(
            "/api/jobs",
            json={
                "title": "Backend Engineer",
                "about_job": "Build reliable FitCV services.",
                "responsibilities": "Design and maintain backend APIs.",
                "requirements": "Python, FastAPI, and SQL.",
                "we_offer": "Flexible working hours.",
                "life_at_company": "Collaborative engineering culture.",
                "hiring_process": "Screening and technical interview.",
                "location": "Ho Chi Minh City",
                "employment_type": "Full-time",
                "deadline": (
                    datetime.now() + timedelta(days=7)
                ).isoformat(),
                "openings_count": 2,
            },
        )
        self.assertEqual(created.status_code, 201)
        job_id = created.json()["job_id"]

        edited = self.client.patch(
            f"/api/jobs/{job_id}",
            json={"title": "Senior Backend Engineer"},
        )
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.json()["title"], "Senior Backend Engineer")

        published = self.client.post(f"/api/jobs/{job_id}/publish")
        self.assertEqual(published.status_code, 200)
        self.assertEqual(published.json()["status"], "Published")

        edit_while_published = self.client.patch(
            f"/api/jobs/{job_id}",
            json={"title": "Blocked edit"},
        )
        self.assertEqual(edit_while_published.status_code, 409)

        closed = self.client.post(f"/api/jobs/{job_id}/close")
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.json()["status"], "Closed")

    def test_rejects_invalid_weight_total_and_student_management(self) -> None:
        invalid = self.client.post(
            "/api/jobs",
            json={
                "title": "Invalid weights",
                "skill_weight": 50,
                "experience_weight": 30,
                "education_weight": 15,
                "soft_skill_weight": 10,
            },
        )
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(
            invalid.json()["detail"],
            "Scoring weights must total 100.",
        )

        self.current_account = self.student
        forbidden = self.client.post(
            "/api/jobs",
            json={"title": "Student cannot create"},
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_archive_filters_visibility_and_preserves_status(self) -> None:
        job = self.create_published_job()

        archived = self.client.post(f"/api/jobs/{job.job_id}/archive")
        self.assertEqual(archived.status_code, 200)
        archived_body = archived.json()
        self.assertEqual(archived_body["status"], "Published")
        self.assertIsNotNone(archived_body["archived_at"])

        blocked_actions = (
            self.client.patch(
                f"/api/jobs/{job.job_id}",
                json={"title": "Archived edit"},
            ),
            self.client.post(f"/api/jobs/{job.job_id}/publish"),
            self.client.post(f"/api/jobs/{job.job_id}/close"),
        )
        self.assertEqual(
            [response.status_code for response in blocked_actions],
            [409, 409, 409],
        )

        active = self.client.get("/api/jobs/manage")
        self.assertEqual(active.status_code, 200)
        self.assertEqual(active.json(), [])

        archived_list = self.client.get("/api/jobs/manage?archived=true")
        self.assertEqual(archived_list.status_code, 200)
        self.assertEqual(
            [item["job_id"] for item in archived_list.json()],
            [job.job_id],
        )

        self.current_account = self.student
        public = self.client.get(f"/api/jobs/public/{job.job_id}")
        self.assertEqual(public.status_code, 404)

        self.current_account = self.outsider
        hidden = self.client.post(f"/api/jobs/{job.job_id}/unarchive")
        self.assertEqual(hidden.status_code, 404)

        self.current_account = self.manager
        restored = self.client.post(f"/api/jobs/{job.job_id}/unarchive")
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()["status"], "Published")
        self.assertIsNone(restored.json()["archived_at"])

        self.current_account = self.student
        visible_again = self.client.get(
            f"/api/jobs/public/{job.job_id}",
        )
        self.assertEqual(visible_again.status_code, 200)
