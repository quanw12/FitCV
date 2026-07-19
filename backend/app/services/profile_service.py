from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.account import Account, AccountRole
from app.repositories.profiles import get_candidate_phone, get_company_summary, save_avatar_url, save_profile
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.services.avatar_storage import delete_local_avatar, store_avatar, validate_avatar

def _url(value: object) -> object:
    return str(value) if value is not None else None


def get_profile(db: Session, account: Account) -> ProfileResponse:
    company_roles = {AccountRole.hr, AccountRole.hiring_manager, AccountRole.admin}
    return ProfileResponse(
        account_id=account.account_id, email=account.email, full_name=account.full_name,
        role=account.role, avatar_url=account.avatar_url, auth_provider=account.auth_provider,
        created_at=account.created_at, updated_at=account.updated_at,
        phone=get_candidate_phone(db, account.account_id) if account.role == AccountRole.student else None,
        company=get_company_summary(db, account.company_id) if account.role in company_roles else None,
    )


def update_profile(db: Session, account: Account, payload: ProfileUpdate) -> ProfileResponse:
    values = payload.model_dump(exclude_unset=True)
    if values.get("full_name") is None and "full_name" in values:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Full name cannot be empty.")
    if "phone" in values and account.role != AccountRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Phone can only be updated by Student accounts.")

    company_keys = {"company_name", "industry_name", "company_website_url", "company_logo_url"}
    sent_company_keys = company_keys.intersection(values)
    company_roles = {AccountRole.hr, AccountRole.hiring_manager, AccountRole.admin}
    if sent_company_keys and account.role not in company_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company fields can only be updated by HR, HiringManager, or Admin accounts.")
    if sent_company_keys and account.company_id is None and not values.get("company_name"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Company name is required when creating a company.")
    if "company_name" in values and values["company_name"] is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Company name cannot be empty.")

    account_fields = {key: _url(values[key]) for key in ("full_name", "avatar_url") if key in values}
    save_profile(
        db,
        account=account,
        account_fields=account_fields,
        phone_was_sent="phone" in values,
        phone=values.get("phone"),
        synchronize_candidate=account.role == AccountRole.student and "full_name" in values,
        company_fields_were_sent=bool(sent_company_keys),
        company_name=values.get("company_name"),
        industry_name_was_sent="industry_name" in values,
        industry_name=values.get("industry_name"),
        company_website_url_was_sent="company_website_url" in values,
        company_website_url=_url(values.get("company_website_url")),
        company_logo_url_was_sent="company_logo_url" in values,
        company_logo_url=_url(values.get("company_logo_url")),
    )
    return get_profile(db, account)


def upload_avatar(db: Session, account: Account, data: bytes, content_type: str | None, request_base_url: str) -> ProfileResponse:
    extension, mime = validate_avatar(data, content_type)
    old_url = account.avatar_url
    stored = store_avatar(data, extension, mime, request_base_url)
    try:
        save_avatar_url(db, account, stored.url)
    except Exception:
        delete_local_avatar(stored.url)
        raise
    delete_local_avatar(old_url)
    return get_profile(db, account)


def delete_avatar(db: Session, account: Account) -> ProfileResponse:
    old_url = account.avatar_url
    save_avatar_url(db, account, None)
    delete_local_avatar(old_url)
    return get_profile(db, account)
