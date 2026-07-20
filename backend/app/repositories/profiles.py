from sqlalchemy import MetaData, Table, func, insert, select, update
from sqlalchemy.orm import Session

from app.models.account import Account


def _table(db: Session, name: str) -> Table:
    return Table(name, MetaData(), autoload_with=db.get_bind())


def get_candidate_phone(db: Session, account_id: int) -> str | None:
    candidate = _table(db, "candidate")
    row = db.execute(
        select(candidate.c.phone)
        .where(candidate.c.account_id == account_id)
        .order_by(candidate.c.candidate_id.asc())
        .limit(1)
    ).first()
    return row[0] if row else None


def get_company_summary(db: Session, company_id: int | None) -> dict[str, object] | None:
    if company_id is None:
        return None
    company = _table(db, "company")
    industry = _table(db, "industry")
    row = db.execute(
        select(
            company.c.company_id,
            company.c.company_name,
            company.c.industry_id,
            industry.c.industry_name,
            company.c.website_url,
            company.c.logo_url,
        )
        .outerjoin(industry, company.c.industry_id == industry.c.industry_id)
        .where(company.c.company_id == company_id)
    ).mappings().first()
    return dict(row) if row else None


def save_profile(
    db: Session,
    *,
    account: Account,
    account_fields: dict[str, object],
    phone_was_sent: bool,
    phone: str | None,
    synchronize_candidate: bool,
    company_fields_were_sent: bool,
    company_name: str | None,
    industry_name_was_sent: bool,
    industry_name: str | None,
    company_website_url_was_sent: bool,
    company_website_url: str | None,
    company_logo_url_was_sent: bool,
    company_logo_url: str | None,
) -> None:
    try:
        for key, value in account_fields.items():
            setattr(account, key, value)
        db.add(account)

        if phone_was_sent or synchronize_candidate:
            candidate = _table(db, "candidate")
            candidate_id = db.execute(
                select(candidate.c.candidate_id)
                .where(candidate.c.account_id == account.account_id)
                .order_by(candidate.c.candidate_id.asc())
                .limit(1)
            ).scalar_one_or_none()
            values = {"full_name": account.full_name, "email": account.email}
            if phone_was_sent:
                values["phone"] = phone
            if candidate_id is None and phone_was_sent:
                values.update({"account_id": account.account_id, "phone": phone})
                db.execute(insert(candidate).values(**values))
            elif candidate_id is not None:
                db.execute(update(candidate).where(candidate.c.candidate_id == candidate_id).values(**values))

        if company_fields_were_sent:
            company = _table(db, "company")
            industry = _table(db, "industry")
            company_id = account.company_id
            if company_id is None:
                if not company_name:
                    raise ValueError("Company name is required when creating a company.")
                result = db.execute(insert(company).values(company_name=company_name))
                company_id = result.inserted_primary_key[0]
                account.company_id = company_id
                db.add(account)

            company_values: dict[str, object] = {}
            if company_name is not None:
                company_values["company_name"] = company_name
            if company_website_url_was_sent:
                company_values["website_url"] = company_website_url
            if company_logo_url_was_sent:
                company_values["logo_url"] = company_logo_url
            if industry_name_was_sent:
                industry_id = None
                if industry_name:
                    normalized = industry_name.casefold()
                    industry_id = db.execute(
                        select(industry.c.industry_id).where(
                            func.lower(func.trim(industry.c.industry_name)) == normalized
                        )
                    ).scalar_one_or_none()
                    if industry_id is None:
                        result = db.execute(insert(industry).values(industry_name=industry_name))
                        industry_id = result.inserted_primary_key[0]
                company_values["industry_id"] = industry_id
            if company_values:
                db.execute(update(company).where(company.c.company_id == company_id).values(**company_values))

        db.commit()
        db.refresh(account)
    except Exception:
        db.rollback()
        raise


def save_avatar_url(db: Session, account: Account, avatar_url: str | None) -> None:
    account.avatar_url = avatar_url
    db.add(account)
    db.commit()
    db.refresh(account)
