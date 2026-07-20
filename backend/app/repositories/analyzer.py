import json
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.analyzer import (
    Cv,
    CvParseResult,
    JdParseResult,
    JobDescription,
    MatchResult,
)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_cv(
    db: Session,
    *,
    account_id: int,
    file_name: str,
    file_path: str,
    file_type: str,
    file_size_kb: int,
    file_sha256: str,
    parser_version: str,
) -> tuple[Cv, CvParseResult]:
    db.execute(
        update(Cv)
        .where(Cv.account_id == account_id, Cv.is_latest.is_(True))
        .values(is_latest=False)
    )
    version_number = (
        int(
            db.scalar(
                select(func.coalesce(func.max(Cv.version_number), 0)).where(
                    Cv.account_id == account_id
                )
            )
            or 0
        )
        + 1
    )
    cv = Cv(
        account_id=account_id,
        file_name=file_name,
        file_path=file_path,
        file_type=file_type,
        file_size_kb=file_size_kb,
        file_sha256=file_sha256,
        version_number=version_number,
        is_latest=True,
    )
    db.add(cv)
    db.flush()
    parsed = CvParseResult(
        cv_id=cv.cv_id, parse_status="Pending", parser_version=parser_version
    )
    db.add(parsed)
    db.commit()
    db.refresh(cv)
    db.refresh(parsed)
    return cv, parsed


def get_owned_cv(db: Session, cv_id: int, account_id: int) -> Cv | None:
    return db.scalar(select(Cv).where(Cv.cv_id == cv_id, Cv.account_id == account_id))


def get_cv_for_parse(db: Session, cv_id: int) -> Cv | None:
    return db.get(Cv, cv_id)


def get_latest_parse(db: Session, cv_id: int) -> CvParseResult | None:
    return db.scalar(
        select(CvParseResult)
        .where(CvParseResult.cv_id == cv_id)
        .order_by(CvParseResult.cv_parse_id.desc())
    )


def get_cv_record(
    db: Session, cv_id: int, account_id: int
) -> tuple[Cv, CvParseResult | None] | None:
    cv = get_owned_cv(db, cv_id, account_id)
    return (cv, get_latest_parse(db, cv.cv_id)) if cv else None


def list_cv_records(
    db: Session, account_id: int
) -> list[tuple[Cv, CvParseResult | None]]:
    cvs = list(
        db.scalars(
            select(Cv)
            .where(Cv.account_id == account_id)
            .order_by(Cv.version_number.desc())
        )
    )
    # ponytail: CV histories are small in the MVP; replace with a latest-parse subquery if pagination is added.
    return [(cv, get_latest_parse(db, cv.cv_id)) for cv in cvs]


def list_owned_match_records(
    db: Session, account_id: int
) -> list[tuple[MatchResult, Cv, JobDescription]]:
    return list(
        db.execute(
            select(MatchResult, Cv, JobDescription)
            .join(Cv, Cv.cv_id == MatchResult.cv_id)
            .join(
                JobDescription,
                JobDescription.job_description_id == MatchResult.job_description_id,
            )
            .where(
                Cv.account_id == account_id,
                JobDescription.account_id == account_id,
                MatchResult.status == "Success",
                MatchResult.overall_score.is_not(None),
            )
            .order_by(
                JobDescription.created_at.desc(),
                Cv.version_number,
                MatchResult.match_result_id,
            )
        ).all()
    )


def get_latest_jd_parse(db: Session, job_description_id: int) -> JdParseResult | None:
    return db.scalar(
        select(JdParseResult)
        .where(JdParseResult.job_description_id == job_description_id)
        .order_by(JdParseResult.jd_parse_id.desc())
        .limit(1)
    )


def list_jd_records(
    db: Session, account_id: int, query: str | None = None
) -> list[tuple[JobDescription, JdParseResult | None]]:
    statement = select(JobDescription).where(JobDescription.account_id == account_id)
    if query:
        pattern = f"%{query.strip().lower()}%"
        statement = statement.where(
            func.lower(JobDescription.title).like(pattern)
            | func.lower(JobDescription.raw_text).like(pattern)
        )
    descriptions = list(
        db.scalars(statement.order_by(JobDescription.created_at.desc()))
    )
    return [
        (description, get_latest_jd_parse(db, description.job_description_id))
        for description in descriptions
    ]


def get_owned_job_description(
    db: Session, job_description_id: int, account_id: int
) -> JobDescription | None:
    return db.scalar(
        select(JobDescription).where(
            JobDescription.job_description_id == job_description_id,
            JobDescription.account_id == account_id,
        )
    )


def delete_owned_job_description(db: Session, description: JobDescription) -> None:
    db.delete(description)
    db.commit()


def set_parse_processing(db: Session, parsed: CvParseResult) -> None:
    parsed.parse_status = "Processing"
    parsed.error_message = None
    db.commit()


def set_parse_success(
    db: Session, parsed: CvParseResult, *, text: str, payload: dict
) -> None:
    parsed.parse_status = "Success"
    parsed.parsed_text = text
    parsed.parsed_json = payload
    parsed.error_message = None
    parsed.parsed_at = _utcnow_naive()
    db.commit()


def set_parse_failed(db: Session, parsed: CvParseResult, error_message: str) -> None:
    parsed.parse_status = "Failed"
    parsed.error_message = error_message[:500]
    parsed.parsed_at = _utcnow_naive()
    db.commit()


def delete_owned_cv(db: Session, cv: Cv) -> str:
    file_path = cv.file_path
    account_id = cv.account_id
    was_latest = cv.is_latest
    db.delete(cv)
    db.flush()
    if was_latest and account_id is not None:
        next_latest = db.scalar(
            select(Cv)
            .where(Cv.account_id == account_id)
            .order_by(Cv.version_number.desc())
            .limit(1)
        )
        if next_latest:
            next_latest.is_latest = True
    db.commit()
    return file_path


def get_or_create_job_description(
    db: Session,
    *,
    account_id: int,
    title: str,
    raw_text: str,
    content_sha256: str,
    parsed_payload: dict,
    parser_version: str,
) -> tuple[JobDescription, JdParseResult]:
    existing = db.execute(
        select(JobDescription, JdParseResult)
        .join(
            JdParseResult,
            JdParseResult.job_description_id == JobDescription.job_description_id,
        )
        .where(
            JobDescription.account_id == account_id,
            JobDescription.content_sha256 == content_sha256,
            JdParseResult.parse_status == "Success",
            JdParseResult.parser_version == parser_version,
        )
        .order_by(JdParseResult.jd_parse_id.desc())
        .limit(1)
    ).first()
    if existing:
        return existing[0], existing[1]

    description = JobDescription(
        account_id=account_id,
        title=title,
        raw_text=raw_text,
        content_sha256=content_sha256,
        source_type="PastedText",
    )
    db.add(description)
    db.flush()
    parsed = JdParseResult(
        job_description_id=description.job_description_id,
        parsed_json=parsed_payload,
        parse_status="Success",
        parser_version=parser_version,
        parsed_at=_utcnow_naive(),
    )
    db.add(parsed)
    db.commit()
    db.refresh(description)
    db.refresh(parsed)
    return description, parsed


def find_exact_match(
    db: Session, cv_parse_id: int, jd_parse_id: int, algorithm_version: str
) -> MatchResult | None:
    return db.scalar(
        select(MatchResult).where(
            MatchResult.cv_parse_id == cv_parse_id,
            MatchResult.jd_parse_id == jd_parse_id,
            MatchResult.algorithm_version == algorithm_version,
        )
    )


def create_pending_match(
    db: Session,
    *,
    cv: Cv,
    parsed_cv: CvParseResult,
    description: JobDescription,
    parsed_jd: JdParseResult,
    algorithm_version: str,
    model_name: str | None = None,
) -> MatchResult:
    match = MatchResult(
        cv_id=cv.cv_id,
        job_description_id=description.job_description_id,
        cv_parse_id=parsed_cv.cv_parse_id,
        jd_parse_id=parsed_jd.jd_parse_id,
        status="Pending",
        algorithm_version=algorithm_version,
        model_name=model_name or algorithm_version,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


def restart_match(db: Session, match: MatchResult) -> None:
    match.status = "Pending"
    match.error_message = None
    match.completed_at = None
    db.commit()


def get_owned_match(
    db: Session, match_result_id: int, account_id: int
) -> MatchResult | None:
    return db.scalar(
        select(MatchResult)
        .join(Cv, Cv.cv_id == MatchResult.cv_id)
        .where(
            MatchResult.match_result_id == match_result_id, Cv.account_id == account_id
        )
    )


def get_match_title(db: Session, match: MatchResult) -> str:
    description = (
        db.get(JobDescription, match.job_description_id)
        if match.job_description_id
        else None
    )
    return description.title if description else "Job match"


def get_match_context(
    db: Session, match_result_id: int
) -> tuple[MatchResult, CvParseResult, JdParseResult, JobDescription]:
    match = db.get(MatchResult, match_result_id)
    if match is None or match.cv_parse_id is None or match.jd_parse_id is None:
        raise LookupError("Match context not found.")
    parsed_cv = db.get(CvParseResult, match.cv_parse_id)
    parsed_jd = db.get(JdParseResult, match.jd_parse_id)
    description = (
        db.get(JobDescription, match.job_description_id)
        if match.job_description_id
        else None
    )
    if parsed_cv is None or parsed_jd is None or description is None:
        raise LookupError("Parsed CV or job description not found.")
    return match, parsed_cv, parsed_jd, description


def set_match_processing(db: Session, match: MatchResult) -> None:
    match.status = "Processing"
    match.error_message = None
    db.commit()


def set_match_success(db: Session, match: MatchResult, result: dict) -> None:
    breakdown = result["breakdown"]
    match.status = "Success"
    match.overall_score = result["overall_score"]
    match.skill_score = _score(breakdown, "skills")
    match.experience_score = _score(breakdown, "experience")
    match.education_score = _score(breakdown, "education")
    match.soft_skill_score = _score(breakdown, "soft_skills")
    match.pass_probability = result["pass_probability"]
    match.match_label = result["match_label"]
    evidence = {
        "breakdown": breakdown,
        "strengths": result["strengths"],
        "weaknesses": result["weaknesses"],
        "suggestions": result["suggestions"],
    }
    if isinstance(result.get("matching_inputs"), dict):
        evidence["matching_inputs"] = result["matching_inputs"]
    match.evidence_json = evidence
    match.match_summary = result["match_summary"]
    match.strengths = json.dumps(result["strengths"], ensure_ascii=False)
    match.weaknesses = json.dumps(result["weaknesses"], ensure_ascii=False)
    match.recommendation = json.dumps(result["suggestions"], ensure_ascii=False)
    match.error_message = None
    match.completed_at = _utcnow_naive()
    db.commit()


def set_match_failed(db: Session, match: MatchResult, error_message: str) -> None:
    match.status = "Failed"
    match.error_message = error_message[:1000]
    match.completed_at = _utcnow_naive()
    db.commit()


def _score(breakdown: dict, category: str) -> float | None:
    item = breakdown.get(category)
    return float(item["score"]) if item else None
