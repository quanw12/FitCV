from datetime import date, datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.db.session import Base, get_db
from app.main import app
from app.models.account import Account, AccountRole, AuthProvider
from app.models.application import TrackedApplication, TrackedApplicationNote, TrackedApplicationStatusHistory


class TestApplicationTrackerApi:
    def setup_method(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

        self.session_factory = sessionmaker(bind=self.engine)
        Base.metadata.create_all(
            self.engine,
            tables=[
                Account.__table__,
                TrackedApplication.__table__,
                TrackedApplicationNote.__table__,
                TrackedApplicationStatusHistory.__table__,
            ],
        )
        db = self.session_factory()
        self.student = Account(
            email="tracker@example.com",
            password_hash="test",
            full_name="Tracker Student",
            role=AccountRole.student,
            auth_provider=AuthProvider.password,
        )
        self.other_student = Account(
            email="other@example.com",
            password_hash="test",
            full_name="Other Student",
            role=AccountRole.student,
            auth_provider=AuthProvider.password,
        )
        self.hr = Account(
            email="hr@example.com",
            password_hash="test",
            full_name="HR User",
            role=AccountRole.hr,
            auth_provider=AuthProvider.password,
        )
        db.add_all([self.student, self.other_student, self.hr])
        db.commit()
        for account in (self.student, self.other_student, self.hr):
            db.refresh(account)
            db.expunge(account)
        db.close()
        self.current_account = self.student

        def override_db():
            session = self.session_factory()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_account] = lambda: self.current_account
        self.client = TestClient(app)

    def teardown_method(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def _payload(self, **changes) -> dict:
        payload = {
            "company_name": "VNG Corporation",
            "position_title": "Backend Developer",
            "applied_on": date.today().isoformat(),
            "source": "LinkedIn",
            "status": "Applied",
            "job_url": "https://example.com/jobs/backend",
            "reminder_at": None,
        }
        payload.update(changes)
        return payload

    def test_complete_crud_status_notes_stats_and_cascade(self) -> None:
        created = self.client.post("/api/applications", json=self._payload())
        assert created.status_code == 201, created.text
        application_id = created.json()["application_id"]
        assert created.json()["status"] == "Applied"
        assert len(created.json()["status_history"]) == 1

        listed = self.client.get("/api/applications", params={"search": "backend", "status": "Applied"})
        assert listed.status_code == 200
        assert [item["application_id"] for item in listed.json()] == [application_id]

        updated = self.client.patch(
            f"/api/applications/{application_id}",
            json={"status": "Interview", "position_title": "Senior Backend Developer"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["status"] == "Interview"
        assert updated.json()["status_history"][0]["previous_status"] == "Applied"
        assert updated.json()["status_history"][0]["new_status"] == "Interview"

        note = self.client.post(
            f"/api/applications/{application_id}/notes",
            json={"content": "Technical interview booked for Friday."},
        )
        assert note.status_code == 201, note.text
        note_id = note.json()["note_id"]
        edited_note = self.client.patch(
            f"/api/applications/{application_id}/notes/{note_id}",
            json={"content": "Technical interview completed."},
        )
        assert edited_note.status_code == 200
        assert edited_note.json()["content"] == "Technical interview completed."

        detail = self.client.get(f"/api/applications/{application_id}").json()
        assert detail["note_count"] == 1
        assert detail["notes"][0]["note_id"] == note_id

        stats = self.client.get("/api/applications/stats")
        assert stats.status_code == 200
        assert stats.json()["total"] == 1
        assert stats.json()["by_status"]["Interview"] == 1

        assert self.client.delete(f"/api/applications/{application_id}/notes/{note_id}").status_code == 204
        assert self.client.delete(f"/api/applications/{application_id}").status_code == 204
        assert self.client.get("/api/applications").json() == []
        with self.session_factory() as db:
            assert db.scalars(select(TrackedApplicationNote)).all() == []
            assert db.scalars(select(TrackedApplicationStatusHistory)).all() == []

    def test_scheduled_and_stale_reminders(self) -> None:
        scheduled = self.client.post(
            "/api/applications",
            json=self._payload(
                company_name="Scheduled Co",
                reminder_at=(datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
            ),
        )
        assert scheduled.status_code == 201
        assert scheduled.json()["reminder_due"] is True
        assert scheduled.json()["reminder_reason"] == "Scheduled follow-up is due."

        stale = self.client.post(
            "/api/applications",
            json=self._payload(company_name="Stale Co", job_url=None),
        )
        stale_id = stale.json()["application_id"]
        with self.session_factory() as db:
            record = db.get(TrackedApplication, stale_id)
            record.last_activity_at = datetime.now() - timedelta(days=31)
            db.commit()

        reminders = self.client.get("/api/applications", params={"reminders_only": True})
        assert reminders.status_code == 200
        assert {item["company_name"] for item in reminders.json()} == {"Scheduled Co", "Stale Co"}
        stale_response = next(item for item in reminders.json() if item["company_name"] == "Stale Co")
        assert stale_response["days_since_update"] == 31
        assert stale_response["reminder_reason"] == "No update in 31 days."

        terminal = self.client.patch(f"/api/applications/{stale_id}", json={"status": "Rejected"})
        assert terminal.json()["reminder_due"] is False

    def test_validation_role_and_account_ownership(self) -> None:
        future = (date.today() + timedelta(days=1)).isoformat()
        assert self.client.post("/api/applications", json=self._payload(applied_on=future)).status_code == 422
        assert self.client.post("/api/applications", json=self._payload(job_url="javascript:alert(1)")).status_code == 422
        assert self.client.post("/api/applications", json=self._payload(company_name="   ")).status_code == 422
        assert self.client.post("/api/applications", json=self._payload(status="Unknown")).status_code == 422

        created = self.client.post("/api/applications", json=self._payload()).json()
        assert self.client.patch(f"/api/applications/{created['application_id']}", json={}).status_code == 422
        assert self.client.patch(f"/api/applications/{created['application_id']}", json={"status": None}).status_code == 422
        self.current_account = self.other_student
        assert self.client.get(f"/api/applications/{created['application_id']}").status_code == 404
        assert self.client.patch(f"/api/applications/{created['application_id']}", json={"status": "Offer"}).status_code == 404
        assert self.client.delete(f"/api/applications/{created['application_id']}").status_code == 404

        self.current_account = self.hr
        assert self.client.get("/api/applications").status_code == 403
