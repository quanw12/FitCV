"""Route-level tests for /job-search/recommendations."""

import unittest
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models.account import Account, AccountRole, AuthProvider
from app.models.analyzer import Cv, CvParseResult

_PARSED_PAYLOAD = {
    "name": "Nguyen Van A",
    "skills": ["Python", "FastAPI", "SQL", "Docker"],
    "experience": [
        {
            "title": "Backend Engineer",
            "company": "Acme",
            "date": "2020-2023",
            "bullets": ["Built payment APIs."],
        }
    ],
}


class JobSearchRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        account = Account(
            email="student-search@example.com",
            password_hash="test",
            full_name="Student",
            role=AccountRole.student,
            auth_provider=AuthProvider.password,
        )
        self.db.add(account)
        self.db.commit()

        cv = Cv(
            account_id=account.account_id,
            file_name="cv.pdf",
            file_path="/tmp/cv.pdf",
            file_type="PDF",
            file_size_kb=10,
            file_sha256="abc",
            version_number=1,
            is_latest=True,
        )
        self.db.add(cv)
        self.db.flush()
        parsed = CvParseResult(
            cv_id=cv.cv_id,
            parse_status="Success",
            parser_version="v1",
            parsed_text="Backend engineer with Python, FastAPI, SQL.",
            parsed_json=_PARSED_PAYLOAD,
        )
        self.db.add(parsed)
        self.db.commit()
        self.cv_id = cv.cv_id

        self.current_account = account
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_account] = (
            lambda: self.current_account
        )
        self.client = TestClient(app)

        ai_profile_patch = mock.patch(
            "app.services.freehire_job_search.extract_cv_search_profile",
            side_effect=AssertionError("AI search profile should not run."),
        )
        search_patch = mock.patch(
            "app.services.freehire_job_search.search_jobs",
            return_value=[
                {
                    "id": "1",
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "url": "https://example.com/1",
                    "source": "freehire",
                }
            ],
        )
        linkedin_patch = mock.patch(
            "app.services.linkedin_job_search.recommend_jobs",
            return_value=[],
        )
        self.ai_profile_mock = ai_profile_patch.start()
        self.search_mock = search_patch.start()
        self.linkedin_mock = linkedin_patch.start()
        self.patchers = [ai_profile_patch, search_patch, linkedin_patch]

    def tearDown(self) -> None:
        for patcher in self.patchers:
            patcher.stop()
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_keyword_skips_ai_cv_profile(self) -> None:
        """A typed keyword should not send parsed CV text through AI."""
        response = self.client.post(
            "/api/job-search/recommendations",
            json={"cv_id": self.cv_id, "query": "remote backend jobs"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["query"], "remote backend jobs")
        self.assertEqual(body["derived_by"], "deterministic")
        self.ai_profile_mock.assert_not_called()

    def test_no_keyword_uses_deterministic_skills_without_ai(self) -> None:
        """With parsed skills, the query is derived without reading full CV text."""
        response = self.client.post(
            "/api/job-search/recommendations",
            json={"cv_id": self.cv_id},
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["query"], "Python FastAPI SQL Docker")
        self.assertEqual(body["derived_by"], "deterministic")
        self.ai_profile_mock.assert_not_called()

    def test_explicit_level_overrides_derived_level(self) -> None:
        """An explicit user level becomes the effective level."""
        response = self.client.post(
            "/api/job-search/recommendations",
            json={
                "cv_id": self.cv_id,
                "query": "python developer",
                "level": "Senior",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["query"], "python developer")
        self.assertEqual(
            self.search_mock.call_args.kwargs["level"], "Senior"
        )


if __name__ == "__main__":
    unittest.main()
