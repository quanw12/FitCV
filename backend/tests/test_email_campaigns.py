from datetime import date, datetime, timezone
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.core.config import settings
from app.main import app
from app.models import (
    Application,
    Candidate,
    CandidateEmail,
    CandidateEmailCampaign,
    CandidateEmailInbound,
    CandidateEmailThread,
    Company,
    Cv,
    Job,
    MatchResult,
)
from app.models.account import Account, AccountRole, AuthProvider
from app.schemas.email_workflow import (
    CampaignGenerateRequest,
    SmartReplyBatchRequest,
)
from app.services import email_workflow_service
from app.services.gemini_client import GeminiClientError


def generated_template(*, mention_fitcv: bool = False, interview: bool = False) -> dict:
    employer = "The FitCV Team" if mention_fitcv else "the employer's recruiting team"
    outcome_sentence = (
        "We would like to invite you to an interview as the next part of our "
        "review process."
        if interview
        else (
            "After completing this review, we decided that your application will "
            "not progress further for this position."
        )
    )
    schedule_sentence = (
        "The proposed interview date is {{interview_date}}, with availability "
        "during {{interview_window}}."
        if interview
        else "Any confirmed timing will be shared directly in this email thread."
    )
    return {
        "subject_template": "An update on your {{job_title}} application",
        "greeting_template": "Dear {{candidate_name}},",
        "paragraphs": [
            (
                "Thank you for the time and care you invested in applying for the "
                "{{job_title}} position with {{company_name}}. We appreciate the "
                "opportunity to review the professional experience, interests, and "
                "information you chose to share with our recruiting team."
            ),
            (
                "Your application is currently recorded at the "
                "{{application_stage}} stage, and our recruiting team is handling "
                "the process with consistency and care. This written update is meant "
                "to make the present status clear and explain what communication you "
                f"can reasonably expect from us next. {outcome_sentence}"
            ),
            (
                f"This message is sent on behalf of {employer}, and it contains only "
                "information confirmed for this recruitment process. We will not ask "
                "you to rely on unverified dates, meeting links, compensation details, "
                "or commitments that have not been supplied by the recruiting team."
            ),
            (
                "Please keep this message for your records and reply in the same thread "
                "if there is relevant information you need us to consider. "
                f"{schedule_sentence} Keeping the conversation together helps us "
                "respond accurately and connect your message to the correct application."
            ),
        ],
        "next_steps": [
            "Review this update and keep this email thread available for future communication.",
            (
                "{{reply_hint}}"
                if interview
                else "No action is required unless you need a factual clarification."
            ),
        ],
        "closing": (
            "Thank you again for your interest and for your patience while our team "
            "coordinates the next appropriate step."
        ),
        "signature_lines": [
            "Best regards,",
            "{{hr_name}}",
            "{{company_name}} Talent Acquisition Team",
        ],
    }


class FakeGemini:
    def __init__(self, payload: dict | None = None) -> None:
        self.payload = payload or generated_template()
        self.prompts: list[str] = []

    def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
        self.prompts.append(prompt)
        return self.payload


class SequencedGemini:
    def __init__(self, outcomes: list[object]) -> None:
        self.outcomes = outcomes
        self.prompts: list[str] = []

    def generate_structured(self, *, prompt: str, response_schema: dict) -> dict:
        self.prompts.append(prompt)
        outcome = self.outcomes[len(self.prompts) - 1]
        if isinstance(outcome, Exception):
            raise outcome
        assert isinstance(outcome, dict)
        return outcome


class EmailCampaignIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_inbound_domain = settings.resend_inbound_domain
        settings.resend_inbound_domain = "inbound.example.com"
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        self.company = Company(company_name="Saigon Fintech JSC")
        other_company = Company(company_name="Other Employer Ltd")
        self.db.add_all([self.company, other_company])
        self.db.flush()
        self.manager = Account(
            email="campaign-manager@example.com",
            password_hash="test",
            full_name="Tran Hiring",
            role=AccountRole.hr,
            company_id=self.company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.outsider = Account(
            email="campaign-outsider@example.com",
            password_hash="test",
            full_name="Other Hiring",
            role=AccountRole.hr,
            company_id=other_company.company_id,
            auth_provider=AuthProvider.password,
        )
        self.db.add_all([self.manager, self.outsider])
        self.db.flush()
        self.job = Job(
            company_id=self.company.company_id,
            created_by_account_id=self.manager.account_id,
            title="Backend Engineer",
            status="Published",
        )
        self.db.add(self.job)
        self.db.flush()

        self.rejected_ids = [
            self._add_application(f"Rejected Candidate {index}", f"r{index}@example.com", "Rejected")
            for index in range(1, 4)
        ]
        self.interview_id = self._add_application(
            "Interview Candidate",
            "interview@example.com",
            "Interview",
        )
        self.db.commit()
        self.current_account = self.manager
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_account] = lambda: self.current_account
        self.client = TestClient(app)

    def tearDown(self) -> None:
        settings.resend_inbound_domain = self.previous_inbound_domain
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _add_application(
        self,
        name: str,
        email: str | None,
        stage: str,
        *,
        job: Job | None = None,
    ) -> int:
        selected_job = job or self.job
        candidate = Candidate(full_name=name, email=email)
        self.db.add(candidate)
        self.db.flush()
        cv = Cv(
            candidate_id=candidate.candidate_id,
            file_name=f"{candidate.candidate_id}.pdf",
            file_path=f"applications/{candidate.candidate_id}.pdf",
            file_type="PDF",
        )
        self.db.add(cv)
        self.db.flush()
        application = Application(
            candidate_id=candidate.candidate_id,
            job_id=selected_job.job_id,
            cv_id=cv.cv_id,
            current_stage=stage,
        )
        self.db.add(application)
        self.db.flush()
        self.db.add(
            MatchResult(
                cv_id=cv.cv_id,
                job_id=selected_job.job_id,
                application_id=application.application_id,
                status="Success",
                overall_score=75,
                match_label="Moderate Match",
                evidence_json={"strengths": ["Grounded API delivery experience."]},
                algorithm_version="fitcv-source-grounded-v2",
            )
        )
        return application.application_id

    def _campaign(
        self,
        application_ids: list[int],
        template_key: str,
        *,
        fake: FakeGemini | None = None,
        today: date | None = None,
    ):
        return email_workflow_service.generate_campaign(
            self.db,
            self.manager,
            CampaignGenerateRequest(
                application_ids=application_ids,
                template_key=template_key,
            ),
            client=fake or FakeGemini(),
            today=today,
        )

    def _add_sent_email(
        self,
        application_id: int,
        *,
        template_key: str = "rejection",
        stage: str = "Rejected",
    ) -> CandidateEmail:
        application = self.db.get(Application, application_id)
        assert application is not None
        candidate = self.db.get(Candidate, application.candidate_id)
        assert candidate is not None and candidate.email is not None
        sent = CandidateEmail(
            company_id=self.company.company_id,
            application_id=application_id,
            template_key=template_key,
            message_kind="Initial",
            stage_at_generation=stage,
            recipient_email=candidate.email,
            subject="Previous stage update",
            body="This update was already reviewed, approved, and sent.",
            status="Sent",
            sent_at=datetime(2026, 8, 1, 9, 0, 0),
            created_by_account_id=self.manager.account_id,
        )
        self.db.add(sent)
        self.db.commit()
        return sent

    @staticmethod
    def _without_greeting(body: str) -> str:
        return "\n\n".join(body.split("\n\n")[1:])

    def _add_thread(
        self,
        application_id: int,
        subject: str,
        *,
        inbound: bool = True,
        inbound_body: str = "Could you clarify the next step and expected timing?",
        in_reply_to: str | None = None,
    ) -> int:
        thread = CandidateEmailThread(
            company_id=self.company.company_id,
            application_id=application_id,
            reply_token=f"token-{application_id}",
            subject=subject,
        )
        self.db.add(thread)
        self.db.flush()
        if inbound:
            self.db.add(
                CandidateEmailInbound(
                    thread_id=thread.thread_id,
                    provider_email_id=f"received-{application_id}",
                    provider_message_id=f"<candidate-{application_id}@example.com>",
                    sender_email=f"candidate-{application_id}@example.com",
                    recipient_email="reply@inbound.example.com",
                    subject=subject,
                    body_text=inbound_body,
                    in_reply_to=in_reply_to,
                    received_at=datetime.now(timezone.utc).replace(tzinfo=None),
                )
            )
        self.db.commit()
        return thread.thread_id

    def test_audience_lists_only_requested_stage(self) -> None:
        response = self.client.get("/api/hr/emails/audience?stage=Rejected")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["stage"], "Rejected")
        self.assertEqual(
            len(payload["eligible"]) + len(payload["blocked"]),
            3,
        )
        self.assertTrue(
            all(item["current_stage"] == "Rejected" for item in payload["eligible"])
        )

    def test_audience_marks_blocked_recipients(self) -> None:
        missing_id = self._add_application("No Email", None, "Rejected")
        pending_id = self.rejected_ids[0]
        pending_app = self.db.get(Application, pending_id)
        assert pending_app is not None
        candidate = self.db.get(Candidate, pending_app.candidate_id)
        assert candidate is not None and candidate.email is not None
        self.db.add(
            CandidateEmail(
                company_id=self.company.company_id,
                application_id=pending_id,
                template_key="rejection",
                message_kind="Initial",
                stage_at_generation="Rejected",
                recipient_email=candidate.email,
                subject="Pending",
                body="Pending review",
                status="Draft",
                created_by_account_id=self.manager.account_id,
            )
        )
        self.db.commit()

        payload = self.client.get("/api/hr/emails/audience?stage=Rejected").json()
        blocked = {item["application_id"]: item for item in payload["blocked"]}
        self.assertEqual(blocked[missing_id]["blocked_reason"], "Missing candidate email.")
        self.assertEqual(blocked[pending_id]["blocked_reason"], "Draft already pending.")

    def test_audience_blocks_candidate_already_emailed_for_same_stage(self) -> None:
        application_id = self.rejected_ids[0]
        self._add_sent_email(application_id)

        response = self.client.get("/api/hr/emails/audience?stage=Rejected")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        eligible_ids = {item["application_id"] for item in payload["eligible"]}
        blocked = {
            item["application_id"]: item for item in payload["blocked"]
        }
        self.assertNotIn(application_id, eligible_ids)
        self.assertEqual(
            blocked[application_id]["blocked_reason"],
            "Already emailed for this stage.",
        )
        self.assertTrue(blocked[application_id]["already_emailed_for_stage"])

    def test_audience_uses_the_explicitly_selected_template(self) -> None:
        application_id = self.rejected_ids[0]
        self._add_sent_email(application_id, template_key="follow_up")

        response = self.client.get(
            "/api/hr/emails/audience"
            "?stage=Rejected&template_key=follow_up"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["template_key"], "follow_up")
        eligible_ids = {item["application_id"] for item in payload["eligible"]}
        blocked = {item["application_id"]: item for item in payload["blocked"]}
        self.assertNotIn(application_id, eligible_ids)
        self.assertEqual(
            blocked[application_id]["blocked_reason"],
            "Already emailed for this stage.",
        )

    def test_campaign_api_skips_already_emailed_candidate_by_default(self) -> None:
        sent_application_id = self.rejected_ids[0]
        eligible_application_id = self.rejected_ids[1]
        self._add_sent_email(sent_application_id)
        sent_count_before = (
            self.db.query(CandidateEmail)
            .filter(CandidateEmail.application_id == sent_application_id)
            .count()
        )

        with patch(
            "app.services.email_workflow_service.GeminiClient",
            side_effect=GeminiClientError("disabled for test"),
        ):
            response = self.client.post(
                "/api/hr/emails/campaigns",
                json={
                    "application_ids": [
                        sent_application_id,
                        eligible_application_id,
                    ],
                    "template_key": "rejection",
                },
            )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(
            [item["application_id"] for item in payload["drafts"]],
            [eligible_application_id],
        )
        self.assertEqual(len(payload["skipped"]), 1)
        self.assertEqual(
            payload["skipped"][0]["application_id"], sent_application_id
        )
        self.assertEqual(
            payload["skipped"][0]["blocked_reason"],
            "Already emailed for this stage.",
        )
        self.assertEqual(
            self.db.query(CandidateEmail)
            .filter(CandidateEmail.application_id == sent_application_id)
            .count(),
            sent_count_before,
        )

    def test_duplicate_only_campaign_returns_conflict_without_new_draft(self) -> None:
        application_id = self.rejected_ids[0]
        self._add_sent_email(application_id)
        email_count_before = self.db.query(CandidateEmail).count()
        campaign_count_before = self.db.query(CandidateEmailCampaign).count()

        response = self.client.post(
            "/api/hr/emails/campaigns",
            json={
                "application_ids": [application_id],
                "template_key": "rejection",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn(
            "Already emailed for this stage.", response.json()["detail"]
        )
        self.assertEqual(self.db.query(CandidateEmail).count(), email_count_before)
        self.assertEqual(
            self.db.query(CandidateEmailCampaign).count(), campaign_count_before
        )

    def test_campaign_api_allows_explicit_resend(self) -> None:
        application_id = self.rejected_ids[0]
        self._add_sent_email(application_id)
        request = CampaignGenerateRequest(
            application_ids=[application_id],
            template_key="rejection",
            allow_resend=True,
        )
        self.assertTrue(request.allow_resend)

        with patch(
            "app.services.email_workflow_service.GeminiClient",
            side_effect=GeminiClientError("disabled for test"),
        ):
            response = self.client.post(
                "/api/hr/emails/campaigns",
                json=request.model_dump(mode="json"),
            )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(len(payload["drafts"]), 1)
        self.assertEqual(payload["drafts"][0]["application_id"], application_id)
        self.assertEqual(payload["skipped"], [])

    def test_older_matching_sent_still_blocks_after_newer_unrelated_sent(self) -> None:
        sent_application_id = self.rejected_ids[0]
        eligible_application_id = self.rejected_ids[1]
        matching = self._add_sent_email(sent_application_id)
        unrelated = self._add_sent_email(
            sent_application_id,
            template_key="follow_up",
        )
        self.assertGreater(unrelated.email_id, matching.email_id)

        audience = self.client.get(
            "/api/hr/emails/audience?stage=Rejected"
        ).json()
        blocked = {
            item["application_id"]: item for item in audience["blocked"]
        }
        self.assertEqual(
            blocked[sent_application_id]["blocked_reason"],
            "Already emailed for this stage.",
        )
        self.assertEqual(
            blocked[sent_application_id]["last_email_template_key"],
            "rejection",
        )

        with patch(
            "app.services.email_workflow_service.GeminiClient",
            side_effect=GeminiClientError("disabled for test"),
        ):
            response = self.client.post(
                "/api/hr/emails/campaigns",
                json={
                    "application_ids": [
                        sent_application_id,
                        eligible_application_id,
                    ],
                    "template_key": "rejection",
                },
            )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(
            [item["application_id"] for item in payload["drafts"]],
            [eligible_application_id],
        )
        self.assertEqual(
            [item["application_id"] for item in payload["skipped"]],
            [sent_application_id],
        )

    def test_campaign_skips_matching_sent_discovered_after_lock(self) -> None:
        raced_application_id = self.rejected_ids[0]
        eligible_application_id = self.rejected_ids[1]
        raced_sent = self._add_sent_email(raced_application_id)

        with (
            patch(
                "app.services.email_workflow_service.GeminiClient",
                side_effect=GeminiClientError("disabled for test"),
            ),
            patch.object(
                email_workflow_service.email_workflow,
                "sent_email_summary",
                side_effect=[{}, {raced_application_id: raced_sent}],
            ) as sent_summary,
        ):
            response = self.client.post(
                "/api/hr/emails/campaigns",
                json={
                    "application_ids": [
                        raced_application_id,
                        eligible_application_id,
                    ],
                    "template_key": "rejection",
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(sent_summary.call_count, 2)
        payload = response.json()
        self.assertEqual(
            [item["application_id"] for item in payload["drafts"]],
            [eligible_application_id],
        )
        self.assertEqual(len(payload["skipped"]), 1)
        self.assertEqual(
            payload["skipped"][0]["application_id"], raced_application_id
        )
        self.assertEqual(
            payload["skipped"][0]["blocked_reason"],
            "Already emailed for this stage.",
        )

    def test_campaign_generates_identical_body_for_rejection(self) -> None:
        fake = FakeGemini()
        result = self._campaign(self.rejected_ids, "rejection", fake=fake)

        self.assertEqual(len(fake.prompts), 1)
        self.assertEqual(len(result.drafts), 3)
        shared = [self._without_greeting(draft.body) for draft in result.drafts]
        self.assertEqual(len(set(shared)), 1)
        for index, draft in enumerate(result.drafts, start=1):
            self.assertIn(f"Rejected Candidate {index}", draft.body.split("\n\n")[0])

    def test_campaign_never_names_fitcv(self) -> None:
        fake = FakeGemini(generated_template(mention_fitcv=True))
        result = self._campaign(self.rejected_ids, "rejection", fake=fake)

        self.assertEqual(len(fake.prompts), 2)
        self.assertFalse(result.ai_generated)
        for draft in result.drafts:
            self.assertNotIn("fitcv", draft.body.lower())
            self.assertIn("Saigon Fintech JSC", draft.body)

    def test_campaign_rejects_fitcv_branding_in_subject(self) -> None:
        payload = generated_template()
        payload["subject_template"] = "The FitCV Team update for {{job_title}}"
        fake = FakeGemini(payload)
        result = self._campaign(self.rejected_ids, "rejection", fake=fake)

        self.assertEqual(len(fake.prompts), 2)
        self.assertFalse(result.ai_generated)
        self.assertTrue(
            all("fitcv" not in draft.subject.lower() for draft in result.drafts)
        )

    def test_campaign_retries_structured_provider_error_once(self) -> None:
        fake = SequencedGemini(
            [
                GeminiClientError("Gemini returned an invalid structured response."),
                generated_template(),
            ]
        )
        result = self._campaign(self.rejected_ids, "rejection", fake=fake)

        self.assertEqual(len(fake.prompts), 2)
        self.assertTrue(result.ai_generated)
        self.assertIn("previous output was too short or invalid", fake.prompts[1])

    def test_long_rendered_subject_falls_back_before_database_insert(self) -> None:
        self.job.title = "J" * 200
        self.db.commit()
        payload = generated_template()
        payload["subject_template"] = (
            "Update for {{job_title}} compared with {{job_title}}"
        )
        fake = FakeGemini(payload)
        result = self._campaign([self.rejected_ids[0]], "rejection", fake=fake)

        self.assertEqual(len(fake.prompts), 2)
        self.assertFalse(result.ai_generated)
        self.assertLessEqual(len(result.drafts[0].subject), 300)

    def test_campaign_body_is_substantial(self) -> None:
        too_short = generated_template()
        too_short["paragraphs"] = ["Too short. Still too short."] * 3
        fake = FakeGemini(too_short)
        result = self._campaign(self.rejected_ids, "rejection", fake=fake)

        self.assertEqual(len(fake.prompts), 2)
        self.assertFalse(result.ai_generated)
        for draft in result.drafts:
            self.assertGreaterEqual(len(draft.body), 900)
            self.assertGreaterEqual(len(draft.body.split("\n\n")), 5)

    def test_placeholder_value_cannot_fake_rejection_semantics(self) -> None:
        self.job.title = "Will Not Progress Program"
        self.db.commit()
        payload = generated_template()
        payload["paragraphs"][1] = payload["paragraphs"][1].replace(
            (
                "After completing this review, we decided that your application "
                "will not progress further for this position."
            ),
            "The team has completed the current review step for this application.",
        )
        fake = FakeGemini(payload)

        result = self._campaign([self.rejected_ids[0]], "rejection", fake=fake)

        self.assertEqual(len(fake.prompts), 2)
        self.assertFalse(result.ai_generated)
        self.assertIn("will not progress", result.drafts[0].body.lower())

    def test_multi_job_campaign_never_hardcodes_one_recipient_job(self) -> None:
        frontend_job = Job(
            company_id=self.company.company_id,
            created_by_account_id=self.manager.account_id,
            title="Frontend Engineer",
            status="Published",
        )
        self.db.add(frontend_job)
        self.db.flush()
        frontend_id = self._add_application(
            "Frontend Candidate",
            "frontend@example.com",
            "Rejected",
            job=frontend_job,
        )
        self.db.commit()
        payload = generated_template()
        payload["paragraphs"][2] += (
            " The Backend Engineer team will keep the process record available."
        )
        fake = FakeGemini(payload)

        result = self._campaign(
            [self.rejected_ids[0], frontend_id],
            "rejection",
            fake=fake,
        )

        self.assertEqual(len(fake.prompts), 2)
        self.assertNotIn("Backend Engineer", fake.prompts[0])
        self.assertNotIn("Frontend Engineer", fake.prompts[0])
        self.assertFalse(result.ai_generated)
        frontend_draft = next(
            draft for draft in result.drafts if draft.application_id == frontend_id
        )
        self.assertNotIn("Backend Engineer", frontend_draft.body)
        campaign = self.db.get(CandidateEmailCampaign, result.campaign_id)
        assert campaign is not None
        self.assertIsNone(campaign.job_id)

    def test_interview_campaign_schedules_three_days_ahead(self) -> None:
        ids = [
            self.interview_id,
            self._add_application("Interview Two", "i2@example.com", "Interview"),
            self._add_application("Interview Three", "i3@example.com", "Interview"),
        ]
        fake = FakeGemini(generated_template(interview=True))
        result = self._campaign(
            ids,
            "interview",
            fake=fake,
            today=date(2026, 8, 10),
        )

        self.assertEqual(result.interview_date, date(2026, 8, 13))
        self.assertTrue(
            all("Thursday, 13 August 2026" in draft.body for draft in result.drafts)
        )

    def test_interview_template_without_schedule_placeholders_falls_back(self) -> None:
        fake = FakeGemini(generated_template(interview=False))
        result = self._campaign(
            [self.interview_id],
            "interview",
            fake=fake,
            today=date(2026, 8, 10),
        )

        self.assertEqual(len(fake.prompts), 2)
        self.assertFalse(result.ai_generated)
        self.assertIn("Thursday, 13 August 2026", result.drafts[0].body)

    def test_interview_date_skips_weekend(self) -> None:
        result = self._campaign(
            [self.interview_id],
            "interview",
            fake=FakeGemini(generated_template(interview=True)),
            today=date(2026, 8, 13),
        )
        self.assertEqual(result.interview_date, date(2026, 8, 17))

    def test_template_rejects_wrong_stage(self) -> None:
        response = self.client.post(
            "/api/hr/emails/campaigns",
            json={
                "application_ids": [self.rejected_ids[0]],
                "template_key": "interview",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_campaign_is_company_scoped(self) -> None:
        self.current_account = self.outsider
        response = self.client.post(
            "/api/hr/emails/campaigns",
            json={
                "application_ids": [self.rejected_ids[0]],
                "template_key": "rejection",
            },
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.db.query(CandidateEmail).count(), 0)

    def test_all_pending_selection_does_not_create_empty_campaign(self) -> None:
        first = self._campaign([self.rejected_ids[0]], "rejection")
        campaign_count = self.db.query(CandidateEmailCampaign).count()

        response = self.client.post(
            "/api/hr/emails/campaigns",
            json={
                "application_ids": [self.rejected_ids[0]],
                "template_key": "rejection",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.db.query(CandidateEmailCampaign).count(), campaign_count)
        self.assertEqual(first.recipient_count, 1)

    def test_stale_follow_up_draft_does_not_block_new_stage(self) -> None:
        first = self._campaign([self.rejected_ids[0]], "follow_up")
        application = self.db.get(Application, self.rejected_ids[0])
        assert application is not None
        application.current_stage = "Interview"
        self.db.commit()

        second = self._campaign([self.rejected_ids[0]], "follow_up")

        self.assertNotEqual(first.drafts[0].email_id, second.drafts[0].email_id)
        self.assertEqual(second.drafts[0].stage_at_generation, "Interview")

    def test_stage_change_blocks_send(self) -> None:
        result = self._campaign([self.rejected_ids[0]], "rejection")
        draft = result.drafts[0]
        application = self.db.get(Application, draft.application_id)
        assert application is not None
        application.current_stage = "Interview"
        self.db.commit()
        self.assertEqual(
            self.client.post(f"/api/hr/emails/drafts/{draft.email_id}/approve").status_code,
            200,
        )
        with patch("app.services.email_workflow_service.send_candidate_email") as sender:
            blocked = self.client.post(f"/api/hr/emails/drafts/{draft.email_id}/send")
        self.assertEqual(blocked.status_code, 409)
        self.assertIn("moved from Rejected to Interview", blocked.json()["detail"])
        sender.assert_not_called()

    def test_campaign_still_requires_hr_approval(self) -> None:
        result = self._campaign([self.rejected_ids[0]], "rejection")
        draft = result.drafts[0]
        self.assertEqual(draft.status, "Draft")
        with patch("app.services.email_workflow_service.send_candidate_email") as sender:
            blocked = self.client.post(f"/api/hr/emails/drafts/{draft.email_id}/send")
        self.assertEqual(blocked.status_code, 409)
        sender.assert_not_called()

    def test_withdrawn_application_blocks_initial_send(self) -> None:
        result = self._campaign([self.rejected_ids[0]], "rejection")
        draft = result.drafts[0]
        self.assertEqual(
            self.client.post(
                f"/api/hr/emails/drafts/{draft.email_id}/approve"
            ).status_code,
            200,
        )
        application = self.db.get(Application, draft.application_id)
        assert application is not None
        application.status = "Withdrawn"
        self.db.commit()

        with patch("app.services.email_workflow_service.send_candidate_email") as sender:
            blocked = self.client.post(
                f"/api/hr/emails/drafts/{draft.email_id}/send"
            )

        self.assertEqual(blocked.status_code, 409)
        self.assertIn("withdrawn", blocked.json()["detail"].lower())
        sender.assert_not_called()

    def test_atomic_claim_catches_stage_change_after_initial_check(self) -> None:
        result = self._campaign([self.rejected_ids[0]], "rejection")
        draft = result.drafts[0]
        self.client.post(f"/api/hr/emails/drafts/{draft.email_id}/approve")

        def move_stage(_db: Session, _company_id: int) -> str:
            application = self.db.get(Application, draft.application_id)
            assert application is not None
            application.current_stage = "Interview"
            self.db.commit()
            return self.company.company_name

        with (
            patch.object(
                email_workflow_service.email_workflow,
                "employer_name",
                side_effect=move_stage,
            ),
            patch("app.services.email_workflow_service.send_candidate_email") as sender,
        ):
            blocked = self.client.post(
                f"/api/hr/emails/drafts/{draft.email_id}/send"
            )

        self.assertEqual(blocked.status_code, 409)
        self.assertIn("while the email was being sent", blocked.json()["detail"])
        sender.assert_not_called()

    def test_smart_reply_batch_shares_body_across_threads(self) -> None:
        first_body = "I can attend on Tuesday; please confirm the meeting link."
        second_body = "Could you tell me when the hiring decision will be available?"
        first = self._add_thread(
            self.rejected_ids[0],
            "Question about application",
            inbound_body=first_body,
        )
        second = self._add_thread(
            self.rejected_ids[1],
            "Question about timeline",
            inbound_body=second_body,
        )
        fake = FakeGemini()
        result = email_workflow_service.generate_smart_reply_batch(
            self.db,
            self.manager,
            SmartReplyBatchRequest(thread_ids=[first, second]),
            client=fake,
            today=date(2026, 8, 10),
        )

        self.assertEqual(len(fake.prompts), 1)
        self.assertNotIn(first_body, fake.prompts[0])
        self.assertNotIn(second_body, fake.prompts[0])
        self.assertEqual(len(result.drafts), 2)
        self.assertTrue(all(draft.message_kind == "Reply" for draft in result.drafts))
        self.assertEqual(
            {draft.subject for draft in result.drafts},
            {"Re: Question about application", "Re: Question about timeline"},
        )
        self.assertEqual(
            len({self._without_greeting(draft.body) for draft in result.drafts}),
            1,
        )

    def test_smart_reply_batch_skips_thread_without_inbound(self) -> None:
        with_inbound = self._add_thread(self.rejected_ids[0], "Question")
        without_inbound = self._add_thread(
            self.rejected_ids[1],
            "No candidate reply",
            inbound=False,
        )
        result = email_workflow_service.generate_smart_reply_batch(
            self.db,
            self.manager,
            SmartReplyBatchRequest(thread_ids=[with_inbound, without_inbound]),
            client=FakeGemini(),
        )

        self.assertEqual(len(result.drafts), 1)
        self.assertEqual(result.skipped[0]["thread_id"], without_inbound)
        self.assertIn("candidate reply", result.skipped[0]["reason"].lower())

    def test_smart_reply_references_include_original_outbound_ancestor(self) -> None:
        thread_id = self._add_thread(
            self.rejected_ids[0],
            "Re: Application update",
            in_reply_to="<original-outbound@example.com>",
        )
        result = email_workflow_service.generate_smart_reply_batch(
            self.db,
            self.manager,
            SmartReplyBatchRequest(thread_ids=[thread_id]),
            client=FakeGemini(),
        )

        stored = self.db.get(CandidateEmail, result.drafts[0].email_id)
        assert stored is not None
        self.assertEqual(
            stored.references_json,
            [
                "<original-outbound@example.com>",
                f"<candidate-{self.rejected_ids[0]}@example.com>",
            ],
        )

    def test_stale_smart_reply_draft_does_not_block_new_stage(self) -> None:
        thread_id = self._add_thread(self.rejected_ids[0], "Question")
        first = email_workflow_service.generate_smart_reply_batch(
            self.db,
            self.manager,
            SmartReplyBatchRequest(thread_ids=[thread_id]),
            client=FakeGemini(),
        )
        application = self.db.get(Application, self.rejected_ids[0])
        assert application is not None
        application.current_stage = "Interview"
        self.db.commit()

        second = email_workflow_service.generate_smart_reply_batch(
            self.db,
            self.manager,
            SmartReplyBatchRequest(thread_ids=[thread_id]),
            client=FakeGemini(),
        )

        self.assertNotEqual(first.drafts[0].email_id, second.drafts[0].email_id)
        self.assertEqual(second.drafts[0].stage_at_generation, "Interview")

    def test_interview_smart_reply_requires_interview_stage(self) -> None:
        thread_id = self._add_thread(self.rejected_ids[0], "Interview question")
        fake = FakeGemini(generated_template(interview=True))

        result = email_workflow_service.generate_smart_reply_batch(
            self.db,
            self.manager,
            SmartReplyBatchRequest(
                thread_ids=[thread_id],
                intent="interview_details",
            ),
            client=fake,
        )

        self.assertEqual(result.drafts, [])
        self.assertIn("Move the candidate to Interview", result.skipped[0]["reason"])
        self.assertEqual(fake.prompts, [])


if __name__ == "__main__":
    unittest.main()
