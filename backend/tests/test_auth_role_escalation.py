from contextlib import contextmanager
from unittest.mock import patch

from fastapi import Request
from fastapi import HTTPException
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_account
from app.core.config import settings
from app.db.session import Base, get_db
from app.main import app
from app.models.account import Account, AccountRole, AuthProvider
from app.schemas.auth import SelectableRole
from app.services import auth_service


@contextmanager
def _role_selection_client(*, initial_role: AccountRole | None = None):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    db: Session = factory()
    account = Account(
        email="role-selection@example.com",
        password_hash="test-password-hash",
        full_name="Role Selection Test",
        role=initial_role,
        auth_provider=AuthProvider.password,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    def override_db():
        yield db

    def override_current_account(request: Request) -> Account:
        request.state.auth_session_id = "role-selection-test-session"
        return account

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_account] = override_current_account
    try:
        with TestClient(app) as client:
            yield client, db, account
    finally:
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()


def _allowed_origin_headers() -> dict[str, str]:
    return {"Origin": settings.cors_origins[0]}


def test_select_role_rejects_admin_payload() -> None:
    """Regression: public role selection must never grant Admin privileges."""
    with _role_selection_client() as (client, db, account):
        response = client.post(
            "/api/auth/select-role",
            json={"role": "Admin"},
            headers=_allowed_origin_headers(),
        )

        assert response.status_code == 422, response.text
        db.refresh(account)
        assert account.role is None


def test_select_role_rejects_a_second_selection_attempt() -> None:
    """Regression: a selected role cannot be replaced through onboarding."""
    with _role_selection_client() as (client, db, account):
        first = client.post(
            "/api/auth/select-role",
            json={"role": "Student"},
            headers=_allowed_origin_headers(),
        )
        second = client.post(
            "/api/auth/select-role",
            json={"role": "HR"},
            headers=_allowed_origin_headers(),
        )

        assert first.status_code == 200, first.text
        assert second.status_code == 409, second.text
        assert second.json()["detail"] == (
            "Role has already been selected for this account."
        )
        db.refresh(account)
        assert account.role == AccountRole.student


def test_fresh_account_can_select_hr() -> None:
    with _role_selection_client() as (client, db, account):
        response = client.post(
            "/api/auth/select-role",
            json={"role": "HR"},
            headers=_allowed_origin_headers(),
        )

        assert response.status_code == 200, response.text
        assert response.json()["user"]["role"] == "HR"
        assert response.json()["requires_role_selection"] is False
        db.refresh(account)
        assert account.role == AccountRole.hr


def test_select_role_rejects_a_stale_unset_account_after_role_was_saved() -> None:
    """Regression: a stale concurrent request cannot overwrite a saved role."""
    with _role_selection_client() as (_client, db, account):
        auth_service.select_role(
            db,
            account=account,
            role=SelectableRole.student,
            session_id="first-role-session",
        )
        set_committed_value(account, "role", None)

        with pytest.raises(HTTPException) as conflict:
            auth_service.select_role(
                db,
                account=account,
                role=SelectableRole.hr,
                session_id="stale-role-session",
            )

        assert conflict.value.status_code == 409
        db.refresh(account)
        assert account.role == AccountRole.student


@pytest.mark.parametrize("role", [AccountRole.hiring_manager, AccountRole.admin])
def test_select_role_service_rejects_privileged_roles(role: AccountRole) -> None:
    """Regression: internal callers cannot bypass the public input schema."""
    with _role_selection_client() as (_client, db, account):
        with pytest.raises(HTTPException) as invalid:
            auth_service.select_role(
                db,
                account=account,
                role=role,
                session_id="internal-role-session",
            )

        assert invalid.value.status_code == 422
        db.refresh(account)
        assert account.role is None


def test_select_role_rejects_disallowed_origin() -> None:
    """Regression: select-role must use the same Origin guard as auth writes."""
    with _role_selection_client() as (client, db, account):
        response = client.post(
            "/api/auth/select-role",
            json={"role": "Student"},
            headers={"Origin": "https://attacker.invalid"},
        )

        assert response.status_code == 403, response.text
        db.refresh(account)
        assert account.role is None


def test_select_role_invokes_auth_rate_limit() -> None:
    """Regression: role selection must consume its dedicated auth limit."""
    with _role_selection_client() as (client, _db, _account):
        with patch(
            "app.api.routes.auth.auth_rate_limit.consume",
            return_value="role-selection-rate-key",
        ) as consume:
            response = client.post(
                "/api/auth/select-role",
                json={"role": "HR"},
                headers=_allowed_origin_headers(),
            )

        assert response.status_code == 200, response.text
        consume.assert_called_once()
        call = consume.call_args
        assert call.kwargs["action"] == "select_role"
        assert call.kwargs["request"].url.path == "/api/auth/select-role"
        assert call.kwargs["identifier"]
