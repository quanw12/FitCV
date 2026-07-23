from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from zipfile import ZipFile

from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.services import application_service, cv_ranking_service


def uploaded_pdf(name: str) -> UploadFile:
    return UploadFile(
        filename=name,
        file=BytesIO(b"%PDF-1.4\n% FitCV test file"),
    )


class CvRankingBatchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_provider = settings.analyzer_provider
        settings.analyzer_provider = "deterministic"
        self.job_description = (
            "Backend Engineer requirements: 3 years of Python and FastAPI. "
            "Bachelor degree and strong communication are required. "
            "Docker is preferred."
        )

    def tearDown(self) -> None:
        settings.analyzer_provider = self.original_provider

    async def test_bulk_parse_ranks_candidates_and_preserves_source_index(
        self,
    ) -> None:
        parsed_text = {
            "0.pdf": (
                "Alice Nguyen\nBackend Engineer\nalice@example.com\n"
                "Skills\nPython FastAPI Docker\nExperience\n"
                "4 years building APIs.\nEducation\nBachelor degree.\n"
                "Strong communication."
            ),
            "1.pdf": (
                "Bob Tran\nSoftware Engineer\nbob@example.com\n"
                "Skills\nJava\nExperience\n1 year building services."
            ),
        }

        with patch(
            "app.services.cv_ranking_service.extract_document_text",
            side_effect=lambda path, _file_type: parsed_text[path.name],
        ):
            response = await cv_ranking_service.parse_batch(
                [uploaded_pdf("alice.pdf"), uploaded_pdf("bob.pdf")],
                self.job_description,
            )

        self.assertEqual(len(response.candidates), 2)
        self.assertEqual(response.candidates[0].name, "Alice Nguyen")
        self.assertEqual(response.candidates[0].source_index, 0)
        self.assertGreater(
            response.candidates[0].score,
            response.candidates[1].score,
        )
        self.assertIn("Python", response.candidates[0].matched_skills)
        self.assertIn("FastAPI", response.required_skills)
        self.assertIn("Docker", response.preferred_skills)

    async def test_rejects_more_than_twenty_files(self) -> None:
        files = [uploaded_pdf(f"candidate-{index}.pdf") for index in range(21)]

        with self.assertRaises(HTTPException) as context:
            await cv_ranking_service.parse_batch(files, self.job_description)

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("at most 20", str(context.exception.detail))


class JobCvArchiveTests(unittest.TestCase):
    def test_downloads_company_job_cvs_as_zip(self) -> None:
        original_upload_dir = settings.upload_dir
        with TemporaryDirectory(prefix="fitcv-job-cvs-") as directory:
            settings.upload_dir = Path(directory)
            stored = settings.upload_dir / "applications" / "alice.pdf"
            stored.parent.mkdir(parents=True)
            stored.write_bytes(b"%PDF-1.4\nAlice CV")

            job = SimpleNamespace(
                company_id=7,
                title="Backend Engineer",
            )
            account = SimpleNamespace(company_id=7)
            application = SimpleNamespace(application_id=101)
            cv = SimpleNamespace(
                cv_id=201,
                file_name="alice.pdf",
                file_path="applications/alice.pdf",
                file_type="PDF",
            )
            rows = [
                (
                    application,
                    SimpleNamespace(),
                    cv,
                    None,
                    None,
                )
            ]

            try:
                with (
                    patch.object(
                        application_service.applications,
                        "get_job",
                        return_value=job,
                    ),
                    patch.object(
                        application_service.applications,
                        "ranked_rows",
                        return_value=rows,
                    ),
                ):
                    content, file_name = application_service.download_all_cvs(
                        SimpleNamespace(),
                        job_id=11,
                        account=account,
                    )
            finally:
                settings.upload_dir = original_upload_dir

        self.assertEqual(file_name, "Backend-Engineer-cvs.zip")
        with ZipFile(BytesIO(content)) as archive:
            self.assertEqual(archive.namelist(), ["101-alice.pdf"])
            self.assertEqual(
                archive.read("101-alice.pdf"),
                b"%PDF-1.4\nAlice CV",
            )

        with patch.object(
            application_service.applications,
            "get_job",
            return_value=job,
        ):
            with self.assertRaises(HTTPException) as denied:
                application_service.download_all_cvs(
                    SimpleNamespace(),
                    job_id=11,
                    account=SimpleNamespace(company_id=99),
                )
        self.assertEqual(denied.exception.status_code, 404)
