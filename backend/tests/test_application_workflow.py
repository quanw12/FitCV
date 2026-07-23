from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
import unittest
import warnings
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, exc as sqlalchemy_exc, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.core.config import settings
from app.db.session import Base
from app.db.session import get_db
from app.main import app
from app.models import (
    Application,
    Candidate,
    Company,
    Cv,
    CvParseResult,
    JdParseResult,
    Job,
    JobDescription,
    MatchResult,
)
from app.models.account import Account, AccountRole, AuthProvider
from app.services import application_service, cv_ranking_service, jobs_service
from app.services.document_parser import PARSER_VERSION


def job(**overrides):
    values = {
        "job_id": 7,
        "company_id": 3,
        "created_by_account_id": 10,
        "title": "Backend Engineer",
        "description": jobs_service._encode_description({
            "description": "Summary",
            "about_job": "Build reliable services",
            "responsibilities": "Develop APIs with Python and FastAPI",
            "we_offer": "Learning budget",
            "life_at_company": "Collaborative team",
            "hiring_process": "Technical interview",
            "openings_count": 2,
        }),
        "requirements": "Requires Python, FastAPI, SQL and 2 years experience. Bachelor preferred.",
        "location": "Ho Chi Minh City",
        "employment_type": "Full-time",
        "status": "Published",
        "deadline": datetime.now() + timedelta(days=2),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class ApplicationValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_duplicate_active_application(self):
        db = MagicMock()
        account = SimpleNamespace(account_id=4)
        upload = UploadFile(filename="resume.pdf", file=MagicMock())
        with (
            patch.object(application_service.applications, "lock_account"),
            patch.object(application_service.applications, "job_for_apply", return_value=job()),
            patch.object(application_service.applications, "active_application", return_value=object()),
        ):
            with self.assertRaises(HTTPException) as caught:
                await application_service.apply(
                    db, job_id=7, full_name="Student", email="s@example.com",
                    phone="0900", file=upload, account=account,
                )
        self.assertEqual(caught.exception.status_code, 409)

    async def test_rejects_non_pdf_even_when_valid_docx(self):
        db = MagicMock()
        account = SimpleNamespace(account_id=4)
        upload = SimpleNamespace(filename="resume.docx", read=AsyncMock(return_value=b"docx"))
        with (
            patch.object(application_service.applications, "lock_account"),
            patch.object(application_service.applications, "job_for_apply", return_value=job()),
            patch.object(application_service.applications, "active_application", return_value=None),
            patch.object(application_service, "validate_cv_content", return_value="DOCX"),
        ):
            with self.assertRaises(HTTPException) as caught:
                await application_service.apply(
                    db, job_id=7, full_name="Student", email="s@example.com",
                    phone="0900", file=upload, account=account,
                )
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("Only PDF", caught.exception.detail)

    async def test_rejects_expired_job_before_reading_file(self):
        account = SimpleNamespace(account_id=4)
        upload = SimpleNamespace(filename="resume.pdf", read=AsyncMock())
        with (
            patch.object(application_service.applications, "lock_account"),
            patch.object(
                application_service.applications,
                "job_for_apply",
                return_value=job(
                    deadline=datetime.now() - timedelta(seconds=1)
                ),
            ),
        ):
            with self.assertRaises(HTTPException) as caught:
                await application_service.apply(
                    MagicMock(), job_id=7, full_name="Student", email="s@example.com",
                    phone="0900", file=upload, account=account,
                )
        self.assertEqual(caught.exception.status_code, 409)
        upload.read.assert_not_awaited()


class JobDocumentTests(unittest.TestCase):
    def test_job_text_contains_only_candidate_scoring_content(self):
        text = application_service._job_text(job())
        for expected in ("Build reliable services", "Develop APIs", "Requires Python"):
            self.assertIn(expected, text)
        for excluded in (
            "Learning budget",
            "Collaborative team",
            "Technical interview",
            "Openings Count",
            "Ho Chi Minh City",
            "Full-time",
        ):
            self.assertNotIn(excluded, text)

    def test_ranking_response_uses_shared_engine_result(self):
        result = {
            "overall_score": 73.0,
            "breakdown": {
                "skills": {"score": 73.0},
                "experience": {"score": 60.0},
                "education": {"score": 100.0},
            },
        }
        score, breakdown, raw_result = cv_ranking_service._score_candidate(result)
        self.assertEqual(score, 73)
        self.assertEqual(breakdown.skills, 73)
        self.assertEqual(breakdown.experience, 60)
        self.assertEqual(breakdown.education, 100)
        self.assertIs(raw_result, result)


class ApplicationApiRoleTests(unittest.TestCase):
    def tearDown(self):
        app.dependency_overrides.clear()

    def test_manager_cannot_use_student_apply_endpoint(self):
        app.dependency_overrides[get_db] = lambda: MagicMock()
        app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(
            account_id=9, role=AccountRole.hr, company_id=3
        )
        with TestClient(app) as client:
            response = client.post(
                "/api/jobs/7/apply",
                data={"full_name": "HR", "email": "hr@example.com", "phone": "0900"},
                files={"file": ("resume.pdf", b"%PDF-1.4", "application/pdf")},
            )
        self.assertEqual(response.status_code, 403)


class ApplicationPersistenceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(
            self.engine,
            tables=[
                Account.__table__,
                Company.__table__,
                Candidate.__table__,
                Cv.__table__,
                CvParseResult.__table__,
                Job.__table__,
                Application.__table__,
                JobDescription.__table__,
                JdParseResult.__table__,
                MatchResult.__table__,
            ],
        )
        self.session_factory = sessionmaker(bind=self.engine)
        self.db = Session(self.engine)
        company = Company(company_name="FitCV Labs")
        self.db.add(company)
        self.db.flush()
        self.student = Account(
            email="student-apply@example.com",
            password_hash="test",
            full_name="Student Apply",
            role=AccountRole.student,
            auth_provider=AuthProvider.password,
        )
        self.manager = Account(
            email="manager-ranking@example.com",
            password_hash="test",
            full_name="HR Manager",
            role=AccountRole.hr,
            company_id=company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.db.add_all([self.student, self.manager])
        self.db.flush()
        self.job = Job(
            company_id=company.company_id,
            created_by_account_id=self.manager.account_id,
            title="Backend Engineer",
            description=jobs_service._encode_description(
                {
                    "description": "Build reliable hiring products.",
                    "about_job": "Develop FitCV backend services.",
                    "responsibilities": "Build Python and FastAPI REST APIs.",
                    "we_offer": "A learning budget and flexible work.",
                    "life_at_company": "Collaborative engineering culture.",
                    "hiring_process": "Technical interview and team discussion.",
                    "openings_count": 2,
                }
            ),
            requirements=(
                "Requires 2 years of Python, FastAPI, SQL, and REST API "
                "experience with a Bachelor's degree and communication skills."
            ),
            location="Ho Chi Minh City",
            employment_type="Full-time",
            status="Published",
            deadline=datetime.now() + timedelta(days=2),
        )
        self.db.add(self.job)
        self.db.commit()
        self.db.refresh(self.student)
        self.db.refresh(self.manager)
        self.db.refresh(self.job)

        self.upload_root = (
            Path(__file__).resolve().parent / "application_test_uploads"
        )
        self.upload_root.mkdir(exist_ok=True)
        self.original_upload_dir = settings.upload_dir
        self.original_analyzer_provider = settings.analyzer_provider
        settings.upload_dir = self.upload_root
        settings.analyzer_provider = "deterministic"

    def tearDown(self):
        self.db.close()
        settings.upload_dir = self.original_upload_dir
        settings.analyzer_provider = self.original_analyzer_provider
        for path in sorted(
            self.upload_root.rglob("*"),
            key=lambda item: len(item.parts),
            reverse=True,
        ):
            path.unlink() if path.is_file() else path.rmdir()
        self.upload_root.rmdir()
        self.engine.dispose()

    async def test_apply_background_ranking_duplicate_and_download(self):
        upload = SimpleNamespace(
            filename="student-resume.pdf",
            read=AsyncMock(return_value=b"%PDF-1.4\nFitCV test"),
        )
        created = await application_service.apply(
            self.db,
            job_id=self.job.job_id,
            full_name="Student Apply",
            email="student-apply@example.com",
            phone="0909000000",
            file=upload,
            account=self.student,
        )

        self.assertEqual(created.analysis_status, "Pending")
        self.assertIsNotNone(self.db.get(Application, created.application_id))
        self.assertIsNotNone(self.db.get(Cv, created.cv_id))
        pending_match = self.db.get(MatchResult, created.match_result_id)
        self.assertEqual(pending_match.status, "Pending")
        self.assertEqual(pending_match.application_id, created.application_id)

        cv_text = (
            "Technical Skills\nPython, FastAPI, SQL, REST APIs\n"
            "Experience\n3 years building backend services.\n"
            "Education\nBachelor's degree in Computer Science.\n"
            "Strong communication and teamwork."
        )
        with (
            patch.object(
                application_service, "SessionLocal", self.session_factory
            ),
            patch.object(
                application_service,
                "extract_document_text",
                return_value=cv_text,
            ),
        ):
            application_service.run_analysis(created.application_id)

        self.db.expire_all()
        completed = self.db.get(MatchResult, created.match_result_id)
        self.assertEqual(completed.status, "Success")
        self.assertEqual(completed.job_id, self.job.job_id)
        self.assertEqual(completed.application_id, created.application_id)
        self.assertIsNotNone(completed.overall_score)
        self.assertEqual(completed.algorithm_version, "fitcv-evidence-v2")

        parsed_cv = self.db.scalar(
            select(CvParseResult).where(CvParseResult.cv_id == created.cv_id)
        )
        self.assertEqual(parsed_cv.parse_status, "Success")
        self.assertIn("FastAPI", parsed_cv.parsed_json["skills"])

        second_student = Account(
            email="student-pending@example.com",
            password_hash="test",
            full_name="Pending Student",
            role=AccountRole.student,
            auth_provider=AuthProvider.password,
        )
        self.db.add(second_student)
        self.db.flush()
        second_candidate = Candidate(
            account_id=second_student.account_id,
            full_name="Pending Student",
            email=second_student.email,
            phone="0909111111",
        )
        self.db.add(second_candidate)
        self.db.flush()
        second_cv = Cv(
            account_id=second_student.account_id,
            candidate_id=second_candidate.candidate_id,
            file_name="pending.pdf",
            file_path="applications/pending.pdf",
            file_type="PDF",
            file_size_kb=1,
            file_sha256="2" * 64,
            version_number=1,
            is_latest=True,
        )
        self.db.add(second_cv)
        self.db.flush()
        self.db.add(
            CvParseResult(
                cv_id=second_cv.cv_id,
                parse_status="Pending",
                parser_version="fitcv-parser-v1",
            )
        )
        second_application = Application(
            candidate_id=second_candidate.candidate_id,
            job_id=self.job.job_id,
            cv_id=second_cv.cv_id,
        )
        self.db.add(second_application)
        self.db.flush()
        self.db.add(
            MatchResult(
                cv_id=second_cv.cv_id,
                job_id=self.job.job_id,
                application_id=second_application.application_id,
                status="Pending",
                algorithm_version="fitcv-deterministic-v1",
            )
        )
        self.db.commit()

        with warnings.catch_warnings(record=True) as caught_warnings:
            warnings.simplefilter("always")
            ranking = application_service.ranked(
                self.db, job_id=self.job.job_id, account=self.manager
            )
        cartesian_warnings = [
            warning
            for warning in caught_warnings
            if issubclass(warning.category, sqlalchemy_exc.SAWarning)
            and "cartesian product" in str(warning.message).lower()
        ]
        self.assertEqual(cartesian_warnings, [])
        self.assertEqual(len(ranking), 2)
        self.assertEqual(ranking[0].application_id, created.application_id)
        self.assertEqual(ranking[0].analysis_status, "Success")
        self.assertEqual(ranking[0].parse_status, "Success")
        self.assertTrue(ranking[0].breakdown)
        self.assertEqual(ranking[0].job_id, self.job.job_id)
        self.assertEqual(ranking[0].candidate.email, "student-apply@example.com")
        self.assertEqual(ranking[0].cv.file_name, "student-resume.pdf")
        self.assertIn("FastAPI", ranking[0].parsed_cv["skills"])
        self.assertEqual(
            ranking[1].application_id, second_application.application_id
        )
        self.assertIsNone(ranking[1].overall_score)

        tracked = application_service.mine(self.db, account=self.student)
        self.assertEqual(len(tracked), 1)
        self.assertEqual(tracked[0].application_id, created.application_id)
        self.assertEqual(tracked[0].job.title, "Backend Engineer")
        self.assertEqual(tracked[0].job.company.name, "FitCV Labs")
        self.assertEqual(tracked[0].cv.file_name, "student-resume.pdf")
        self.assertEqual(tracked[0].parse_status, "Success")
        self.assertEqual(tracked[0].analysis_status, "Success")
        self.assertIsNone(tracked[0].analysis_error)

        parsed_text_before = parsed_cv.parsed_text
        completed.algorithm_version = "fitcv-deterministic-v1"
        self.db.commit()
        reanalyzed = application_service.retry_analysis(
            self.db,
            application_id=created.application_id,
            account=self.student,
        )
        self.assertEqual(reanalyzed.analysis_status, "Pending")
        self.db.refresh(completed)
        self.db.refresh(parsed_cv)
        self.assertEqual(completed.status, "Pending")
        self.assertEqual(completed.algorithm_version, "fitcv-evidence-v2")
        self.assertEqual(parsed_cv.parse_status, "Success")
        self.assertEqual(parsed_cv.parsed_text, parsed_text_before)

        completed.status = "Failed"
        completed.error_message = "No readable CV text was found."
        parsed_cv.parse_status = "Failed"
        parsed_cv.error_message = "No readable CV text was found."
        self.db.commit()
        retried = application_service.retry_analysis(
            self.db,
            application_id=created.application_id,
            account=self.student,
        )
        self.assertEqual(retried.analysis_status, "Pending")
        self.db.refresh(completed)
        self.db.refresh(parsed_cv)
        self.assertEqual(completed.status, "Pending")
        self.assertIsNone(completed.error_message)
        self.assertEqual(parsed_cv.parse_status, "Pending")
        self.assertEqual(parsed_cv.parser_version, PARSER_VERSION)
        self.assertIsNone(parsed_cv.error_message)

        download = application_service.download(
            self.db,
            application_id=created.application_id,
            account=self.student,
        )
        self.assertEqual(download.filename, "student-resume.pdf")
        outsider = SimpleNamespace(
            account_id=999,
            role=AccountRole.hr,
            company_id=self.manager.company_id + 1,
        )
        with self.assertRaises(HTTPException) as denied:
            application_service.download(
                self.db,
                application_id=created.application_id,
                account=outsider,
            )
        self.assertEqual(denied.exception.status_code, 403)
        with self.assertRaises(HTTPException) as hidden_ranking:
            application_service.ranked(
                self.db, job_id=self.job.job_id, account=outsider
            )
        self.assertEqual(hidden_ranking.exception.status_code, 404)

        duplicate = SimpleNamespace(
            filename="duplicate.pdf",
            read=AsyncMock(return_value=b"%PDF-1.4\nDuplicate"),
        )
        with self.assertRaises(HTTPException) as duplicate_error:
            await application_service.apply(
                self.db,
                job_id=self.job.job_id,
                full_name="Student Apply",
                email="student-apply@example.com",
                phone="0909000000",
                file=duplicate,
                account=self.student,
            )
        self.assertEqual(duplicate_error.exception.status_code, 409)
        duplicate.read.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
