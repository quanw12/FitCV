from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

from app.models.account import AccountRole
from app.schemas.profile import ProfileUpdate
from app.services import profile_service


class ProfileCompanyValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = Mock()
        self.account = SimpleNamespace(
            role=AccountRole.hr,
            company_id=None,
            account_id=1,
        )

    def test_new_company_requires_industry(self) -> None:
        payload = ProfileUpdate(company_name="FitCV")

        with self.assertRaises(HTTPException) as raised:
            profile_service.update_profile(self.db, self.account, payload)

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(
            raised.exception.detail,
            "Industry is required when creating a company.",
        )

    def test_company_role_cannot_clear_industry(self) -> None:
        self.account.company_id = 10
        payload = ProfileUpdate(industry_name="")

        with self.assertRaises(HTTPException) as raised:
            profile_service.update_profile(self.db, self.account, payload)

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail, "Industry cannot be empty.")

    @patch("app.services.profile_service.get_profile")
    @patch("app.services.profile_service.save_profile")
    def test_complete_company_profile_is_saved(
        self,
        save_profile: Mock,
        get_profile: Mock,
    ) -> None:
        expected = object()
        get_profile.return_value = expected
        payload = ProfileUpdate(
            company_name="FitCV",
            industry_name="Information Technology",
        )

        result = profile_service.update_profile(self.db, self.account, payload)

        self.assertIs(result, expected)
        self.assertEqual(save_profile.call_args.kwargs["company_name"], "FitCV")
        self.assertEqual(
            save_profile.call_args.kwargs["industry_name"],
            "Information Technology",
        )
