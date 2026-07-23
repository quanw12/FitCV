import json
import unittest
import base64
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.account import Account, AuthProvider
from app.models.analyzer import Cv, CvParseResult, JdParseResult, Job, JobDescription, MatchResult
from app.repositories import analyzer
from app.services.document_parser import (
    PARSER_VERSION,
    extract_document_text,
    parse_cv_text,
    parse_jd_text,
    preprocess_document_text,
    validate_cv_content,
)
from app.services.matching_service import (
    ALGORITHM_VERSION,
    match_documents,
    supplement_semantic_cv,
)
from app.services.analyzer_service import _selected_analyzer_config
from app.services import ocr_service
from app.services.gemini_analyzer import (
    GeminiAnalyzerError,
    extract_match_inputs,
)


class DocumentParserTests(unittest.TestCase):
    def test_extracts_shared_cv_and_jd_contract(self) -> None:
        cv = parse_cv_text(
            """Technical Skills
            Python, FastAPI, MySQL, Docker, Git
            Experience
            4 years building REST APIs in Agile teams.
            Education
            Bachelor's degree in Computer Science.
            Communication and teamwork."""
        )
        jd = parse_jd_text(
            """Backend Developer requirements: 3 years of experience with Python, FastAPI, MySQL and REST APIs.
            Bachelor's degree required. Strong communication and teamwork.
            Docker and Redis are nice to have for this position."""
        )

        self.assertIn("FastAPI", cv["skills"])
        self.assertIn("Redis", jd["preferred_skills"])
        self.assertNotIn("Redis", jd["required_skills"])
        self.assertEqual(jd["experience_years"], 3.0)

    def test_preprocesses_ocr_text_and_recognizes_master_of_science(self) -> None:
        text = preprocess_document_text(
            "EDUCATION\nMaster of Science in Artificial\n"
            "Intelligence\nProficient in profes-\nsional Python development."
        )
        parsed = parse_cv_text(text)

        self.assertIn("professional Python", text)
        self.assertEqual(parsed["education"], "Master")
        self.assertIn("Python", parsed["skills"])

    def test_rejects_fake_pdf(self) -> None:
        with self.assertRaisesRegex(ValueError, "valid PDF"):
            validate_cv_content("resume.pdf", b"not a pdf")

    def test_extracts_docx_text(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "resume.docx"
            document = Document()
            document.add_heading("Technical Skills")
            document.add_paragraph("Python, FastAPI, MySQL")
            document.save(path)
            self.assertIn("FastAPI", extract_document_text(path, "DOCX"))

    def test_scanned_pdf_uses_ocr_fallback(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "scanned.pdf"
            path.write_bytes(b"%PDF-1.4\nscanned")
            page = MagicMock()
            page.extract_text.return_value = ""
            reader = MagicMock()
            reader.pages = [page]
            with (
                patch("pypdf.PdfReader", return_value=reader),
                patch(
                    "app.services.ocr_service.extract_pdf_text",
                    return_value=(
                        "Technical Skills\nPython FastAPI SQL\n"
                        "Experience\nThree years building APIs"
                    ),
                ) as ocr,
            ):
                text = extract_document_text(path, "PDF")

        self.assertIn("FastAPI", text)
        ocr.assert_called_once_with(path)


class OcrServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_provider = settings.ocr_provider
        self.original_model = settings.ocr_model
        self.original_key = settings.gemini_api_key
        self.original_timeout = settings.ocr_timeout_seconds
        settings.ocr_provider = "gemini"
        settings.ocr_model = "gemini-ocr-test"
        settings.gemini_api_key = "test-key"
        settings.ocr_timeout_seconds = 7

    def tearDown(self) -> None:
        settings.ocr_provider = self.original_provider
        settings.ocr_model = self.original_model
        settings.gemini_api_key = self.original_key
        settings.ocr_timeout_seconds = self.original_timeout

    def test_sends_pdf_inline_and_returns_transcription(self) -> None:
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "candidates": [
                {
                    "finishReason": "STOP",
                    "content": {
                        "parts": [
                            {
                                "text": (
                                    "Technical Skills\nPython, FastAPI\n"
                                    "Experience\n3 years"
                                )
                            }
                        ]
                    },
                }
            ]
        }
        with TemporaryDirectory() as directory:
            path = Path(directory) / "scan.pdf"
            pdf_bytes = b"%PDF-1.4\nimage-only"
            path.write_bytes(pdf_bytes)
            with patch(
                "app.services.ocr_service.requests.post",
                return_value=response,
            ) as post:
                text = ocr_service.extract_pdf_text(path)

        self.assertIn("FastAPI", text)
        request = post.call_args
        self.assertEqual(
            request.args[0],
            (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                "gemini-ocr-test:generateContent"
            ),
        )
        self.assertEqual(request.kwargs["timeout"], 7)
        inline = request.kwargs["json"]["contents"][0]["parts"][0]["inlineData"]
        self.assertEqual(inline["mimeType"], "application/pdf")
        self.assertEqual(base64.b64decode(inline["data"]), pdf_bytes)
        self.assertEqual(
            request.kwargs["json"]["generationConfig"]["thinkingConfig"],
            {"thinkingLevel": "minimal"},
        )

    def test_reports_ocr_finish_reason(self) -> None:
        with self.assertRaisesRegex(ocr_service.OcrError, "MAX_TOKENS"):
            ocr_service._output_text(
                {"candidates": [{"finishReason": "MAX_TOKENS", "content": {}}]}
            )

    def test_requires_api_key_for_scanned_pdf_ocr(self) -> None:
        settings.gemini_api_key = None
        with TemporaryDirectory() as directory:
            path = Path(directory) / "scan.pdf"
            path.write_bytes(b"%PDF-1.4\nimage-only")
            with self.assertRaisesRegex(ocr_service.OcrError, "GEMINI_API_KEY"):
                ocr_service.extract_pdf_text(path)


class MatchingServiceTests(unittest.TestCase):
    def test_scores_evidence_and_probability(self) -> None:
        result = match_documents(
            {
                "skills": ["Python", "FastAPI", "MySQL", "REST APIs", "Docker"],
                "experience_years": 4.0,
                "education": "Bachelor",
                "soft_skills": ["Communication", "Teamwork"],
            },
            {
                "required_skills": ["Python", "FastAPI", "MySQL", "REST APIs"],
                "preferred_skills": ["Docker", "Redis"],
                "experience_years": 3.0,
                "education": "Bachelor",
                "soft_skills": ["Communication", "Teamwork"],
            },
        )

        self.assertEqual(result["match_label"], "Strong Match")
        self.assertGreaterEqual(result["overall_score"], 80)
        self.assertLessEqual(result["pass_probability"], 95)
        self.assertEqual(result["breakdown"]["skills"]["missing"], ["Redis"])

    def test_redistributes_weights_when_jd_omits_categories(self) -> None:
        result = match_documents(
            {"skills": [], "experience_years": None, "education": "Master", "soft_skills": []},
            {"required_skills": [], "preferred_skills": [], "experience_years": None, "education": "Bachelor", "soft_skills": []},
        )
        self.assertEqual(result["overall_score"], 100.0)

    def test_custom_job_weights_change_the_candidate_score(self) -> None:
        cv = {
            "skills": ["Python"],
            "experience_years": 1,
            "education": None,
            "soft_skills": [],
        }
        jd = {
            "required_skills": ["Python"],
            "preferred_skills": [],
            "experience_years": 4,
            "education": None,
            "soft_skills": [],
        }

        skills_first = match_documents(
            cv,
            jd,
            weights={
                "skills": 80,
                "experience": 20,
                "education": 0,
                "soft_skills": 0,
            },
        )
        experience_first = match_documents(
            cv,
            jd,
            weights={
                "skills": 20,
                "experience": 80,
                "education": 0,
                "soft_skills": 0,
            },
        )

        self.assertEqual(skills_first["overall_score"], 85.0)
        self.assertEqual(experience_first["overall_score"], 40.0)
        self.assertEqual(skills_first["scoring_weights"]["skills"], 80.0)

    def test_custom_weights_still_redistribute_missing_categories(self) -> None:
        result = match_documents(
            {"skills": ["Python"], "soft_skills": []},
            {
                "required_skills": ["Python"],
                "preferred_skills": [],
                "experience_years": None,
                "education": None,
                "soft_skills": [],
            },
            weights={
                "skills": 25,
                "experience": 50,
                "education": 15,
                "soft_skills": 10,
            },
        )

        self.assertEqual(result["overall_score"], 100.0)

    def test_rejects_invalid_custom_weights(self) -> None:
        with self.assertRaisesRegex(ValueError, "total 100"):
            match_documents(
                {"skills": ["Python"]},
                {"required_skills": ["Python"]},
                weights={
                    "skills": 50,
                    "experience": 30,
                    "education": 15,
                    "soft_skills": 10,
                },
            )

    def test_rejects_unscorable_jd(self) -> None:
        with self.assertRaisesRegex(ValueError, "no scorable"):
            match_documents(
                {"skills": [], "experience_years": None, "education": None, "soft_skills": []},
                {"required_skills": [], "preferred_skills": [], "experience_years": None, "education": None, "soft_skills": []},
            )

    def test_matches_canonical_skill_variants(self) -> None:
        result = match_documents(
            {
                "skills": ["REST APIs"],
                "experience_years": None,
                "education": None,
                "soft_skills": [],
            },
            {
                "required_skills": ["REST API"],
                "preferred_skills": [],
                "experience_years": None,
                "education": None,
                "soft_skills": [],
            },
        )
        self.assertEqual(result["breakdown"]["skills"]["score"], 100.0)
        self.assertEqual(result["breakdown"]["skills"]["matched"], ["REST API"])

    def test_one_of_group_is_satisfied_by_one_matching_skill(self) -> None:
        result = match_documents(
            {
                "skills": ["C++"],
                "experience_years": None,
                "education": None,
                "soft_skills": [],
            },
            {
                "required_skills": [],
                "preferred_skills": [],
                "required_skill_groups": [
                    {
                        "skills": ["C++", "Python", "C#", "Java"],
                        "minimum_required": 1,
                    }
                ],
                "experience_years": None,
                "education": None,
                "soft_skills": [],
            },
        )

        skills = result["breakdown"]["skills"]
        self.assertEqual(skills["score"], 100.0)
        self.assertEqual(skills["matched"], ["C++"])
        self.assertEqual(skills["missing"], [])
        self.assertTrue(skills["groups"][0]["satisfied"])

    def test_minimum_skill_group_reports_one_group_gap(self) -> None:
        result = match_documents(
            {"skills": ["Python"], "soft_skills": []},
            {
                "required_skills": [],
                "preferred_skills": [],
                "required_skill_groups": [
                    {
                        "skills": ["Python", "Java", "Go"],
                        "minimum_required": 2,
                    }
                ],
                "soft_skills": [],
            },
        )

        skills = result["breakdown"]["skills"]
        self.assertEqual(skills["score"], 50.0)
        self.assertEqual(
            skills["missing"],
            ["At least 2 of: Go, Java, Python"],
        )
        self.assertFalse(skills["groups"][0]["satisfied"])

    def test_supplements_semantic_cv_with_locally_parsed_terms(self) -> None:
        semantic_cv = {
            "skills": ["TensorFlow"],
            "experience_years": None,
            "education": None,
            "soft_skills": [],
        }
        parsed_cv = {
            "skills": ["Machine Learning", "Python"],
            "experience_years": None,
            "education": "Master",
            "soft_skills": ["Problem Solving"],
        }
        jd = {
            "required_skills": ["Python", "FastAPI"],
            "preferred_skills": [],
            "experience_years": None,
            "education": None,
            "soft_skills": [],
        }

        supplemented = supplement_semantic_cv(semantic_cv, parsed_cv)
        result = match_documents(supplemented, jd)

        self.assertIn("Python", supplemented["skills"])
        self.assertEqual(supplemented["education"], "Master")
        self.assertEqual(result["breakdown"]["skills"]["matched"], ["Python"])
        self.assertEqual(result["breakdown"]["skills"]["score"], 50.0)


class GeminiAnalyzerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_provider = settings.analyzer_provider
        self.original_key = settings.gemini_api_key
        self.original_model = settings.gemini_model
        self.original_timeout = settings.gemini_timeout_seconds
        self.original_retries = settings.gemini_max_retries
        settings.analyzer_provider = "gemini"
        settings.gemini_api_key = "test-key"
        settings.gemini_model = "gemini-3.1-flash-lite"
        settings.gemini_timeout_seconds = 1
        settings.gemini_max_retries = 1

    def tearDown(self) -> None:
        settings.analyzer_provider = self.original_provider
        settings.gemini_api_key = self.original_key
        settings.gemini_model = self.original_model
        settings.gemini_timeout_seconds = self.original_timeout
        settings.gemini_max_retries = self.original_retries

    def test_extracts_structured_keywords_for_weighted_matching(self) -> None:
        output = {
            "cv": {
                "skills": [
                    {"name": "splunk", "evidence": "Splunk, Wireshark, and Python"},
                    {"name": "Wireshark", "evidence": "Splunk, Wireshark, and Python"},
                    {"name": "Python", "evidence": "Splunk, Wireshark, and Python"},
                    {"name": "Invented Skill", "evidence": "not present in the CV"},
                ],
                "experience_years": None,
                "experience_evidence": None,
                "education": "Bachelor",
                "education_evidence": "Bachelor student",
                "soft_skills": [
                    {"name": "Communication", "evidence": "Communication"}
                ],
            },
            "jd": {
                "required_skills": [
                    {"name": "Splunk", "evidence": "Requires Splunk, Wireshark, Python"},
                    {"name": "wireshark", "evidence": "Requires Splunk, Wireshark, Python"},
                    {"name": "Python", "evidence": "Requires Splunk, Wireshark, Python"},
                ],
                "preferred_skills": [
                    {"name": "Nessus", "evidence": "Nessus preferred"}
                ],
                "experience_years": None,
                "experience_evidence": None,
                "education": "Bachelor",
                "education_evidence": "Bachelor required",
                "soft_skills": [
                    {"name": "communication", "evidence": "communication required"}
                ],
            },
        }
        response = MagicMock(status_code=200)
        response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": f"```json\n{json.dumps(output)}\n```"}
                        ]
                    },
                    "finishReason": "STOP",
                }
            ]
        }

        with patch(
            "app.services.gemini_analyzer.requests.post", return_value=response
        ) as post:
            cv, jd = extract_match_inputs(
                cv_text="""Jane Doe
jane@example.com | +84 901 234 567
Bachelor student using Splunk, Wireshark, and Python. Communication.""",
                job_description="Requires Splunk, Wireshark, Python. Nessus preferred. Bachelor required; communication required.",
            )

        self.assertEqual(
            post.call_args.args[0],
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
        )
        request_body = post.call_args.kwargs["json"]
        self.assertEqual(post.call_args.kwargs["headers"]["x-goog-api-key"], "test-key")
        self.assertEqual(post.call_args.kwargs["timeout"], 1)
        self.assertEqual(
            request_body["generationConfig"]["responseMimeType"],
            "application/json",
        )
        self.assertIn(
            "cv", request_body["generationConfig"]["responseJsonSchema"]["properties"]
        )
        jd_schema = request_body["generationConfig"]["responseJsonSchema"][
            "properties"
        ]["jd"]
        self.assertIn("required_skill_groups", jd_schema["properties"])
        group_skills_schema = jd_schema["properties"]["required_skill_groups"][
            "items"
        ]["properties"]["skills"]
        self.assertNotIn("minItems", group_skills_schema)
        self.assertNotIn("maxItems", group_skills_schema)
        submitted = json.loads(request_body["contents"][0]["parts"][0]["text"])[
            "cv_text"
        ]
        self.assertNotIn("Jane Doe", submitted)
        self.assertNotIn("jane@example.com", submitted)
        self.assertNotIn("+84 901 234 567", submitted)
        self.assertEqual(cv["skills"], ["Python", "splunk", "Wireshark"])
        self.assertEqual(jd["required_skills"], ["Python", "splunk", "Wireshark"])
        self.assertEqual(match_documents(cv, jd)["match_label"], "Strong Match")

    def test_extracts_and_scores_one_of_requirement_group(self) -> None:
        jd_quote = "Know at least one of C++, Python, C#, or Java."
        output = {
            "cv": {
                "skills": [{"name": "C++", "evidence": "C++ development"}],
                "experience_years": None,
                "experience_evidence": None,
                "education": None,
                "education_evidence": None,
                "soft_skills": [],
            },
            "jd": {
                "required_skills": [],
                "preferred_skills": [],
                "required_skill_groups": [
                    {
                        "skills": [
                            {"name": skill, "evidence": jd_quote}
                            for skill in ["C++", "Python", "C#", "Java"]
                        ],
                        "minimum_required": 1,
                        "evidence": jd_quote,
                    }
                ],
                "preferred_skill_groups": [],
                "experience_years": None,
                "experience_evidence": None,
                "education": None,
                "education_evidence": None,
                "soft_skills": [],
            },
        }
        response = MagicMock(status_code=200)
        response.json.return_value = {
            "candidates": [
                {
                    "content": {"parts": [{"text": json.dumps(output)}]},
                    "finishReason": "STOP",
                }
            ]
        }

        with patch(
            "app.services.gemini_analyzer.requests.post", return_value=response
        ):
            cv, jd = extract_match_inputs(
                cv_text="Projects include C++ development and algorithms.",
                job_description=jd_quote,
            )

        self.assertEqual(jd["required_skills"], [])
        self.assertEqual(jd["required_skill_groups"][0]["minimum_required"], 1)
        result = match_documents(cv, jd)
        self.assertEqual(result["breakdown"]["skills"]["score"], 100.0)
        self.assertEqual(result["breakdown"]["skills"]["missing"], [])

    def test_retries_rate_limit_once(self) -> None:
        output = {
            "cv": {
                "skills": [],
                "experience_years": None,
                "experience_evidence": None,
                "education": None,
                "education_evidence": None,
                "soft_skills": [],
            },
            "jd": {
                "required_skills": [],
                "preferred_skills": [],
                "experience_years": None,
                "experience_evidence": None,
                "education": None,
                "education_evidence": None,
                "soft_skills": [],
            },
        }
        response = MagicMock(status_code=200)
        response.json.return_value = {
            "candidates": [
                {
                    "content": {"parts": [{"text": json.dumps(output)}]},
                    "finishReason": "STOP",
                }
            ]
        }
        rate_limit = MagicMock(status_code=429)

        with (
            patch(
                "app.services.gemini_analyzer.requests.post",
                side_effect=[rate_limit, response],
            ) as post,
            patch("app.services.gemini_analyzer.time.sleep") as retry_sleep,
        ):
            extract_match_inputs(
                cv_text="Readable CV text",
                job_description="Readable job description text",
            )

        self.assertEqual(post.call_count, 2)
        retry_sleep.assert_called_once_with(0.5)

    def test_requires_server_side_api_key(self) -> None:
        settings.gemini_api_key = None
        with self.assertRaisesRegex(GeminiAnalyzerError, "GEMINI_API_KEY"):
            extract_match_inputs(cv_text="Readable CV text", job_description="Readable job description text")

    def test_selects_gemini_model_and_new_cache_version(self) -> None:
        algorithm_version, model_name = _selected_analyzer_config()
        self.assertTrue(algorithm_version.startswith("fitcv-gemini-"))
        self.assertLessEqual(len(algorithm_version), 50)
        self.assertTrue(algorithm_version.endswith("-v2"))
        self.assertEqual(model_name, "gemini-3.1-flash-lite")


class AnalyzerRepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                Account.__table__,
                Cv.__table__,
                CvParseResult.__table__,
                Job.__table__,
                JobDescription.__table__,
                JdParseResult.__table__,
                MatchResult.__table__,
            ],
        )
        self.db = Session(self.engine)
        self.account = Account(
            email="student@example.com",
            password_hash="test",
            full_name="Student",
            auth_provider=AuthProvider.password,
        )
        self.db.add(self.account)
        self.db.commit()
        self.db.refresh(self.account)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_versions_dedupe_and_persist_match_evidence(self) -> None:
        first, _ = analyzer.create_cv(
            self.db,
            account_id=self.account.account_id,
            file_name="cv-v1.pdf",
            file_path="cv/1/v1.pdf",
            file_type="PDF",
            file_size_kb=10,
            file_sha256="1" * 64,
            parser_version=PARSER_VERSION,
        )
        second, parsed_cv = analyzer.create_cv(
            self.db,
            account_id=self.account.account_id,
            file_name="cv-v2.docx",
            file_path="cv/1/v2.docx",
            file_type="DOCX",
            file_size_kb=20,
            file_sha256="2" * 64,
            parser_version=PARSER_VERSION,
        )
        self.assertEqual((first.version_number, second.version_number), (1, 2))
        self.assertFalse(first.is_latest)
        self.assertTrue(second.is_latest)

        cv_payload = {"skills": ["Python"], "experience_years": 2, "education": None, "soft_skills": []}
        jd_payload = {"required_skills": ["Python"], "preferred_skills": [], "experience_years": 2, "education": None, "soft_skills": []}
        analyzer.set_parse_success(self.db, parsed_cv, text="Python developer with 2 years experience", payload=cv_payload)
        description, parsed_jd = analyzer.get_or_create_job_description(
            self.db,
            account_id=self.account.account_id,
            title="Python Developer",
            raw_text="Python developer with 2 years experience required for this backend role.",
            content_sha256="3" * 64,
            parsed_payload=jd_payload,
            parser_version=PARSER_VERSION,
        )
        duplicate, duplicate_parse = analyzer.get_or_create_job_description(
            self.db,
            account_id=self.account.account_id,
            title="Python Developer",
            raw_text="Python developer with 2 years experience required for this backend role.",
            content_sha256="3" * 64,
            parsed_payload=jd_payload,
            parser_version=PARSER_VERSION,
        )
        self.assertEqual((description.job_description_id, parsed_jd.jd_parse_id), (duplicate.job_description_id, duplicate_parse.jd_parse_id))

        match = analyzer.create_pending_match(
            self.db,
            cv=second,
            parsed_cv=parsed_cv,
            description=description,
            parsed_jd=parsed_jd,
            algorithm_version=ALGORITHM_VERSION,
        )
        analyzer.set_match_success(self.db, match, match_documents(cv_payload, jd_payload))
        self.assertEqual(match.status, "Success")
        self.assertEqual(float(match.overall_score or 0), 100.0)
        self.assertIsNotNone(match.evidence_json)


class AnalyzerApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.session_factory = sessionmaker(bind=self.engine)
        Base.metadata.create_all(
            self.engine,
            tables=[
                Account.__table__,
                Cv.__table__,
                CvParseResult.__table__,
                Job.__table__,
                JobDescription.__table__,
                JdParseResult.__table__,
                MatchResult.__table__,
            ],
        )
        db = self.session_factory()
        self.account = Account(
            email="api-student@example.com",
            password_hash="test",
            full_name="API Student",
            auth_provider=AuthProvider.password,
        )
        db.add(self.account)
        db.commit()
        db.refresh(self.account)
        db.expunge(self.account)
        db.close()

        def override_db():
            session = self.session_factory()
            try:
                yield session
            finally:
                session.close()

        self.uploads = TemporaryDirectory()
        self.original_upload_dir = settings.upload_dir
        self.original_analyzer_provider = settings.analyzer_provider
        settings.upload_dir = Path(self.uploads.name)
        settings.analyzer_provider = "deterministic"
        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_account] = lambda: self.account
        self.session_patch = patch("app.services.analyzer_service.SessionLocal", self.session_factory)
        self.session_patch.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self.session_patch.stop()
        app.dependency_overrides.clear()
        settings.upload_dir = self.original_upload_dir
        settings.analyzer_provider = self.original_analyzer_provider
        self.uploads.cleanup()
        self.engine.dispose()

    def test_upload_analyze_history_and_delete(self) -> None:
        document = Document()
        document.add_heading("Technical Skills")
        document.add_paragraph("Python, FastAPI, MySQL, Docker and communication")
        document.add_heading("Experience")
        document.add_paragraph("3 years building REST APIs.")
        buffer = BytesIO()
        document.save(buffer)

        upload = self.client.post(
            "/api/cvs",
            files={"file": ("resume.docx", buffer.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        self.assertEqual(upload.status_code, 201, upload.text)
        cv_id = upload.json()["cv_id"]
        parsed = self.client.get(f"/api/cvs/{cv_id}")
        self.assertEqual(parsed.json()["parse_status"], "Success")

        analysis = self.client.post(
            "/api/analyzer/matches",
            json={
                "cv_id": cv_id,
                "job_description": "Backend role requires 2 years of Python, FastAPI, MySQL and REST API experience with strong communication skills.",
                "title": "Backend Developer",
            },
        )
        self.assertEqual(analysis.status_code, 202, analysis.text)
        match_id = analysis.json()["match_result_id"]
        completed = self.client.get(f"/api/analyzer/matches/{match_id}")
        self.assertEqual(completed.json()["status"], "Success")
        self.assertIn(completed.json()["match_label"], {"Strong Match", "Moderate Match", "Weak Match"})
        self.assertEqual(len(self.client.get("/api/cvs").json()), 1)
        self.assertEqual(self.client.delete(f"/api/cvs/{cv_id}").status_code, 204)
        self.assertEqual(self.client.get("/api/cvs").json(), [])


if __name__ == "__main__":
    unittest.main()
