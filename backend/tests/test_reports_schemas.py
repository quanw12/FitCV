import unittest

from app.schemas.reports import (
    ReportBucket,
    ReportCharts,
    ReportJobRow,
    ReportKpis,
    ReportPassRate,
    ReportScoreBucket,
    ReportSummaryResponse,
    ReportWindow,
)


class ReportSchemasTests(unittest.TestCase):
    def test_summary_response_serializes_alias_from(self) -> None:
        response = ReportSummaryResponse(
            window=ReportWindow(
                from_="2026-07-01", to="2026-07-31", label="Jul 2026"
            ),
            kpis=ReportKpis(
                active_job_posts=4,
                total_cvs_reviewed=119,
                avg_candidate_score=68.4,
                review_progress=58.0,
                time_to_shortlist_days=3.2,
                time_to_hire_days=18.0,
                offer_acceptance_rate=87.0,
                prev=None,
            ),
            charts=ReportCharts(
                applications_over_time=[
                    ReportBucket(period="2026-W27", label="Jul 5", count=12)
                ],
                screening_pass_rate=ReportPassRate(
                    passed_count=68, not_passed_count=32
                ),
                score_distribution=[
                    ReportScoreBucket(range="90-100%", count=8)
                ],
            ),
            jobs=[
                ReportJobRow(
                    job_id=1,
                    title="Senior Backend Developer",
                    department="Engineering",
                    cv_count=47,
                    avg_score=72.1,
                    review_progress=68.0,
                    status="Published",
                )
            ],
        )
        payload = response.model_dump(by_alias=True)
        self.assertEqual(payload["window"]["from"], "2026-07-01")
        self.assertEqual(payload["kpis"]["time_to_shortlist_days"], 3.2)
        self.assertEqual(
            payload["charts"]["applications_over_time"][0]["period"],
            "2026-W27",
        )
        self.assertEqual(payload["jobs"][0]["department"], "Engineering")

    def test_optional_numerics_default_to_none(self) -> None:
        kpis = ReportKpis(active_job_posts=1, total_cvs_reviewed=2)
        self.assertIsNone(kpis.prev)
        self.assertIsNone(kpis.avg_candidate_score)
        self.assertIsNone(kpis.time_to_hire_days)

    def test_empty_charts_are_allowed(self) -> None:
        response = ReportSummaryResponse(
            window=ReportWindow(from_="2026-07-01", to="2026-07-31", label="Jul 2026"),
            kpis=ReportKpis(active_job_posts=0, total_cvs_reviewed=0),
            charts=ReportCharts(
                applications_over_time=[],
                screening_pass_rate=ReportPassRate(
                    passed_count=0, not_passed_count=0
                ),
                score_distribution=[],
            ),
            jobs=[],
        )
        self.assertEqual(response.jobs, [])


if __name__ == "__main__":
    unittest.main()
