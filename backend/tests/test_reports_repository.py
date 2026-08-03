import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models import (
    Application,
    ApplicationStageHistory,
    Candidate,
    Company,
    Cv,
    Job,
    MatchResult,
    Position,
)
from app.models.account import Account, AccountRole, AuthProvider
from app.repositories import reports


class ReportRepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        company = Company(company_name="FitCV Labs")
        other = Company(company_name="Other Labs")
        self.db.add_all([company, other])
        self.db.flush()
        self.company_id = company.company_id
        self.other_id = other.company_id

        creator = Account(
            email="repo-creator@example.com",
            password_hash="test",
            full_name="Repo Creator",
            role=AccountRole.hr,
            company_id=self.company_id,
            auth_provider=AuthProvider.password,
        )
        self.db.add(creator)
        self.db.flush()

        position = Position(abbreviation="ENG", full_name="Engineering")
        self.db.add(position)
        self.db.flush()

        job = Job(
            company_id=self.company_id,
            created_by_account_id=creator.account_id,
            title="Backend Engineer",
            status="Published",
            position_id=position.position_id,
        )
        draft_job = Job(
            company_id=self.company_id,
            created_by_account_id=creator.account_id,
            title="Draft Role",
            status="Draft",
        )
        archived_job = Job(
            company_id=self.company_id,
            created_by_account_id=creator.account_id,
            title="Archived Role",
            status="Published",
            archived_at=datetime(2026, 1, 1),
        )
        other_job = Job(
            company_id=self.other_id,
            created_by_account_id=creator.account_id,
            title="Other Company Role",
            status="Published",
        )
        self.db.add_all([job, draft_job, archived_job, other_job])
        self.db.flush()
        self.job_id = job.job_id

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

        self.window_start = datetime(2026, 7, 1)
        self.window_end = datetime(2026, 7, 31, 23, 59, 59)

        application = Application(
            candidate_id=candidate.candidate_id,
            job_id=self.job_id,
            cv_id=cv.cv_id,
            applied_at=datetime(2026, 7, 10, 9, 0, 0),
        )
        outside = Application(
            candidate_id=candidate.candidate_id,
            job_id=self.job_id,
            cv_id=cv.cv_id,
            applied_at=datetime(2026, 5, 1, 9, 0, 0),
        )
        self.db.add_all([application, outside])
        self.db.flush()
        self.application_id = application.application_id

        # Two match results: older score 40, latest score 88.
        self.db.add_all(
            [
                MatchResult(
                    cv_id=cv.cv_id,
                    job_id=self.job_id,
                    application_id=self.application_id,
                    status="Success",
                    overall_score=40,
                    algorithm_version="v1",
                ),
                MatchResult(
                    cv_id=cv.cv_id,
                    job_id=self.job_id,
                    application_id=self.application_id,
                    status="Success",
                    overall_score=88,
                    algorithm_version="v2",
                ),
            ]
        )
        self.db.add_all(
            [
                ApplicationStageHistory(
                    application_id=self.application_id,
                    previous_stage="Applied",
                    new_stage="Screening",
                    changed_at=datetime(2026, 7, 12, 10, 0, 0),
                ),
                ApplicationStageHistory(
                    application_id=self.application_id,
                    previous_stage="Screening",
                    new_stage="Interview",
                    changed_at=datetime(2026, 7, 15, 10, 0, 0),
                ),
                ApplicationStageHistory(
                    application_id=self.application_id,
                    previous_stage="Interview",
                    new_stage="Hired",
                    changed_at=datetime(2026, 7, 20, 10, 0, 0),
                ),
            ]
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_job_rows_returns_published_active_with_department(self) -> None:
        rows = reports.job_rows(self.db, self.company_id)
        self.assertEqual(len(rows), 1)
        job, department = rows[0]
        self.assertEqual(job.title, "Backend Engineer")
        self.assertEqual(department, "Engineering")

    def test_application_rows_are_window_and_company_scoped(self) -> None:
        rows = reports.application_rows_with_scores(
            self.db, self.company_id, self.window_start, self.window_end
        )
        self.assertEqual(len(rows), 1)
        application, score = rows[0]
        self.assertEqual(application.application_id, self.application_id)
        self.assertEqual(score, 88.0)  # latest match result wins

    def test_first_reached_stage_map_uses_min_changed_at(self) -> None:
        screening = reports.first_reached_stage_map(
            self.db, self.company_id, self.window_start, self.window_end, "Screening"
        )
        self.assertEqual(screening[self.application_id], datetime(2026, 7, 12, 10, 0, 0))
        hired = reports.first_reached_stage_map(
            self.db, self.company_id, self.window_start, self.window_end, "Hired"
        )
        self.assertEqual(hired[self.application_id], datetime(2026, 7, 20, 10, 0, 0))
        offer = reports.first_reached_stage_map(
            self.db, self.company_id, self.window_start, self.window_end, "Offer"
        )
        self.assertEqual(offer, {})


if __name__ == "__main__":
    unittest.main()
