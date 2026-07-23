from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.repositories import jobs as jobs_repository
from app.schemas.jobs import JobUpdate
from app.services import jobs_service


def complete_virtual(**overrides):
    values = {
        "description": "Short summary",
        "about_job": "About",
        "responsibilities": "Responsibilities",
        "we_offer": "Benefits",
        "life_at_company": "Culture",
        "hiring_process": "Interview",
        "openings_count": 2,
    }
    values.update(overrides)
    return values


def make_job(**overrides):
    values = {
        "job_id": 10,
        "title": "Developer",
        "description": jobs_service._encode_description(complete_virtual()),
        "requirements": "Python",
        "location": "HCMC",
        "employment_type": "Full-time",
        "deadline": datetime.now() + timedelta(days=1),
        "status": "Draft",
        "archived_at": None,
        "skill_weight": 45,
        "experience_weight": 30,
        "education_weight": 15,
        "soft_skill_weight": 10,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class JobsDescriptionSerializationTests(unittest.TestCase):
    def test_versioned_serialization_round_trip(self):
        source = complete_virtual(about_job="Unicode: công việc")
        encoded = jobs_service._encode_description(source)

        self.assertTrue(encoded.startswith(jobs_service.DESCRIPTION_MARKER))
        self.assertEqual(jobs_service._decode_description(encoded), source)

    def test_legacy_plain_text_falls_back_to_about_job(self):
        decoded = jobs_service._decode_description("Original legacy description")

        self.assertEqual(decoded["description"], "Original legacy description")
        self.assertEqual(decoded["about_job"], "Original legacy description")
        self.assertEqual(decoded["openings_count"], 1)
        self.assertIsNone(decoded["responsibilities"])

    def test_malformed_marked_payload_falls_back_without_crashing(self):
        raw = jobs_service.DESCRIPTION_MARKER + "{broken"

        decoded = jobs_service._decode_description(raw)

        self.assertEqual(decoded["description"], raw)
        self.assertEqual(decoded["about_job"], raw)
        self.assertEqual(decoded["openings_count"], 1)

    def test_unrelated_json_is_treated_as_legacy_text(self):
        raw = '{"about_job":"not FitCV serialized content"}'

        decoded = jobs_service._decode_description(raw)

        self.assertEqual(decoded["about_job"], raw)
        self.assertEqual(decoded["description"], raw)


class JobsServiceTests(unittest.TestCase):
    def test_update_merges_virtual_fields_and_persists_only_real_columns(self):
        job = make_job()
        account = SimpleNamespace(company_id=4)
        returned = SimpleNamespace(job_id=10)

        with patch.object(jobs_service, "_managed", return_value=job), \
             patch.object(jobs_service.jobs, "update_job") as update_job, \
             patch.object(jobs_service, "list_managed", return_value=[returned]):
            result = jobs_service.update(
                SimpleNamespace(),
                account,
                10,
                JobUpdate(about_job="Updated about", openings_count=3),
            )

        persisted = update_job.call_args.args[2]
        self.assertEqual(set(persisted), {"description"})
        decoded = jobs_service._decode_description(persisted["description"])
        self.assertEqual(decoded["about_job"], "Updated about")
        self.assertEqual(decoded["openings_count"], 3)
        self.assertEqual(decoded["responsibilities"], "Responsibilities")
        self.assertEqual(result.job_id, 10)

    def test_repository_filters_virtual_columns(self):
        values = jobs_repository._real_job_values({
            "title": "Developer",
            "description": "encoded",
            "requirements": "Python",
            "about_job": "virtual",
            "openings_count": 4,
            "archived_at": datetime(2026, 7, 23),
            "skill_weight": 40,
        })

        self.assertEqual(values, {
            "title": "Developer",
            "description": "encoded",
            "requirements": "Python",
            "archived_at": datetime(2026, 7, 23),
            "skill_weight": 40,
        })

    def test_publish_validation_uses_decoded_virtual_fields(self):
        job = make_job(description=jobs_service._encode_description(complete_virtual(about_job=None)))

        with patch.object(jobs_service, "_managed", return_value=job):
            with self.assertRaises(HTTPException) as caught:
                jobs_service.publish(SimpleNamespace(), SimpleNamespace(company_id=4), 10)

        self.assertEqual(caught.exception.status_code, 422)
        self.assertIn("about_job", caught.exception.detail)

    def test_publish_accepts_complete_legacy_description_as_about_job_only_after_other_sections_exist(self):
        job = make_job(description="Legacy about text")

        with patch.object(jobs_service, "_managed", return_value=job):
            with self.assertRaises(HTTPException) as caught:
                jobs_service.publish(SimpleNamespace(), SimpleNamespace(company_id=4), 10)

        self.assertNotIn("about_job", caught.exception.detail)
        self.assertIn("responsibilities", caught.exception.detail)

    def test_clean_normalizes_aware_datetime_to_utc_naive(self):
        aware = datetime(2026, 7, 19, 15, 30, tzinfo=timezone(timedelta(hours=7)))

        cleaned = jobs_service._clean({"deadline": aware})

        self.assertEqual(cleaned["deadline"], datetime(2026, 7, 19, 8, 30))
        self.assertIsNone(cleaned["deadline"].tzinfo)

    def test_publish_compares_aware_deadline_without_type_error(self):
        job = make_job(deadline=datetime.now(timezone.utc) + timedelta(days=1))
        with patch.object(jobs_service, "_managed", return_value=job), \
             patch.object(jobs_service.jobs, "update_job"), \
             patch.object(jobs_service, "list_managed", return_value=[SimpleNamespace(job_id=10)]):
            result = jobs_service.publish(SimpleNamespace(), SimpleNamespace(company_id=4), 10)

        self.assertEqual(result.job_id, 10)

    def test_publish_rejects_already_published_job(self):
        with patch.object(jobs_service, "_managed", return_value=make_job(status="Published")):
            with self.assertRaises(HTTPException) as caught:
                jobs_service.publish(SimpleNamespace(), SimpleNamespace(company_id=4), 10)
        self.assertEqual(caught.exception.status_code, 409)

    def test_close_requires_published_status(self):
        with patch.object(jobs_service, "_managed", return_value=make_job(status="Draft")):
            with self.assertRaises(HTTPException) as caught:
                jobs_service.close(SimpleNamespace(), SimpleNamespace(company_id=4), 10)
        self.assertEqual(caught.exception.status_code, 409)

    def test_company_scope_requires_assigned_company(self):
        with self.assertRaises(HTTPException) as caught:
            jobs_service.list_managed(SimpleNamespace(), SimpleNamespace(company_id=None))
        self.assertEqual(caught.exception.status_code, 400)

    def test_managed_lookup_uses_account_company_scope(self):
        db = SimpleNamespace()
        with patch.object(jobs_service.jobs, "managed_job", return_value=None) as managed_job:
            with self.assertRaises(HTTPException) as caught:
                jobs_service._managed(db, SimpleNamespace(company_id=7), 42)
        managed_job.assert_called_once_with(db, 42, 7)
        self.assertEqual(caught.exception.status_code, 404)

    def test_clean_strips_text_without_changing_numbers(self):
        self.assertEqual(
            jobs_service._clean({"title": "  Developer ", "openings_count": 2}),
            {"title": "Developer", "openings_count": 2},
        )

    def test_update_rejects_weights_that_do_not_total_100(self):
        job = make_job()

        with patch.object(jobs_service, "_managed", return_value=job):
            with self.assertRaises(HTTPException) as caught:
                jobs_service.update(
                    SimpleNamespace(),
                    SimpleNamespace(company_id=4),
                    10,
                    JobUpdate(skill_weight=50),
                )

        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(
            caught.exception.detail,
            "Scoring weights must total 100.",
        )

    def test_archive_preserves_recruitment_status(self):
        job = make_job(status="Published")
        returned = SimpleNamespace(job_id=10, status="Published")

        with (
            patch.object(jobs_service, "_managed", return_value=job),
            patch.object(jobs_service.jobs, "update_job") as update_job,
            patch.object(
                jobs_service,
                "list_managed",
                return_value=[returned],
            ),
        ):
            result = jobs_service.archive(
                SimpleNamespace(),
                SimpleNamespace(company_id=4),
                10,
            )

        persisted = update_job.call_args.args[2]
        self.assertEqual(set(persisted), {"archived_at"})
        self.assertIsInstance(persisted["archived_at"], datetime)
        self.assertEqual(result.status, "Published")
