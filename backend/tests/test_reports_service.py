import unittest
from datetime import date, datetime, timedelta

from fastapi import HTTPException
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
)
from app.models.account import Account, AccountRole, AuthProvider
from app.services import reports_service


class ReportServiceTests(unittest.TestCase):
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
        self.db.add_all([self.manager, self.no_company])
        self.db.flush()

        job = Job(
            company_id=company.company_id,
            created_by_account_id=self.manager.account_id,
            title="Backend Engineer",
            status="Published",
        )
        self.db.add(job)
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

        self.july_applied = datetime(2026, 7, 10, 9, 0, 0)
        self.june_applied = datetime(2026, 6, 10, 9, 0, 0)

        def add_application(applied_at: datetime, stage: str) -> Application:
            application = Application(
                candidate_id=candidate.candidate_id,
                job_id=self.job_id,
                cv_id=cv.cv_id,
                applied_at=applied_at,
                current_stage=stage,
            )
            self.db.add(application)
            self.db.flush()
            return application

        # July: screened+offered app (hired), one still Applied, one rejected.
        hired = add_application(self.july_applied, "Hired")
        add_application(datetime(2026, 7, 15, 9, 0, 0), "Applied")
        add_application(datetime(2026, 7, 20, 9, 0, 0), "Rejected")
        # June: one app (for prev-window comparison).
        june = add_application(self.june_applied, "Applied")

        def add_history(application: Application, stages: list[str]) -> None:
            previous: str | None = None
            for i, stage in enumerate(stages):
                self.db.add(
                    ApplicationStageHistory(
                        application_id=application.application_id,
                        previous_stage=previous,
                        new_stage=stage,
                        changed_at=applied_date(application) + timedelta(days=i + 1),
                    )
                )
                previous = stage

        def applied_date(application: Application) -> datetime:
            return application.applied_at

        add_history(hired, ["Screening", "Interview", "Offer", "Hired"])
        add_history(june, ["Screening"])
        self.db.commit()

        self.july_window = (date(2026, 7, 1), date(2026, 7, 31))

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_summary_derives_all_sections(self) -> None:
        result = reports_service.summary(self.db, self.manager, *self.july_window)

        self.assertEqual(result.window.from_, "2026-07-01")
        self.assertEqual(result.kpis.active_job_posts, 1)
        self.assertEqual(result.kpis.total_cvs_reviewed, 3)
        # no match results seeded -> avg score None
        self.assertIsNone(result.kpis.avg_candidate_score)
        # 2 of 3 moved past Applied
        self.assertEqual(result.kpis.review_progress, 66.7)
        # hired app reached Screening 1 day after applied
        self.assertEqual(result.kpis.time_to_shortlist_days, 1.0)
        # hired app reached Hired 4 days after applied
        self.assertEqual(result.kpis.time_to_hire_days, 4.0)
        # 1 offered (the hired one) and 1 hired -> 100%
        self.assertEqual(result.kpis.offer_acceptance_rate, 100.0)

        passed = result.charts.screening_pass_rate.passed_count
        self.assertEqual(passed, 1)
        self.assertEqual(result.charts.screening_pass_rate.not_passed_count, 2)

        self.assertEqual(len(result.jobs), 1)
        self.assertEqual(result.jobs[0].cv_count, 3)
        self.assertIsNone(result.jobs[0].avg_score)
        self.assertEqual(result.jobs[0].review_progress, 66.7)

        self.assertEqual(result.kpis.prev.total_cvs_reviewed, 1)

    def test_weekly_buckets_zero_fill(self) -> None:
        result = reports_service.summary(self.db, self.manager, *self.july_window)
        buckets = result.charts.applications_over_time
        self.assertEqual(len(buckets), 5)  # July has 5 ISO weeks
        self.assertEqual(sum(b.count for b in buckets), 3)
        self.assertTrue(all(b.period.startswith("2026-W") for b in buckets))

    def test_no_company_raises_400(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            reports_service.summary(self.db, self.no_company, *self.july_window)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_invalid_window_raises_422(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            reports_service.summary(
                self.db, self.manager, date(2026, 8, 1), date(2026, 7, 1)
            )
        self.assertEqual(ctx.exception.status_code, 422)
        with self.assertRaises(HTTPException) as ctx:
            reports_service.summary(
                self.db, self.manager, date(2026, 1, 1), date(2027, 1, 31)
            )
        self.assertEqual(ctx.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
