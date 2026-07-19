from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import (
    Account,
    Application,
    Candidate,
    Company,
    Cv,
    CvParseResult,
    JdParseResult,
    Job,
    JobDescription,
    MatchResult,
)


def lock_account(db: Session, account_id: int) -> None:
    db.scalar(
        select(Account.account_id)
        .where(Account.account_id == account_id)
        .with_for_update()
    )


def get_job(db: Session, job_id: int) -> Job | None:
    return db.get(Job, job_id)


def job_for_apply(db: Session, job_id: int) -> Job | None:
    return db.scalar(select(Job).where(Job.job_id == job_id).with_for_update())


def candidate_for_account(db: Session, account_id: int) -> Candidate | None:
    return db.scalar(
        select(Candidate)
        .where(Candidate.account_id == account_id)
        .order_by(Candidate.candidate_id)
        .limit(1)
    )


def active_application(db: Session, account_id: int, job_id: int) -> Application | None:
    return db.scalar(
        select(Application)
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .where(
            Candidate.account_id == account_id,
            Application.job_id == job_id,
            Application.status == "Active",
        )
    )


def create_application_records(
    db: Session,
    *,
    account_id: int,
    job_id: int,
    full_name: str,
    email: str,
    phone: str,
    file_name: str,
    file_path: str,
    file_size_kb: int,
    file_sha256: str,
    parser_version: str,
    algorithm_version: str,
    model_name: str | None,
) -> tuple[Application, Cv, MatchResult]:
    candidate = candidate_for_account(db, account_id)
    if candidate is None:
        candidate = Candidate(account_id=account_id)
        db.add(candidate)
    candidate.full_name = full_name
    candidate.email = email
    candidate.phone = phone
    db.flush()

    db.execute(
        update(Cv)
        .where(Cv.account_id == account_id, Cv.is_latest.is_(True))
        .values(is_latest=False)
    )
    version_number = int(
        db.scalar(
            select(func.coalesce(func.max(Cv.version_number), 0)).where(
                Cv.account_id == account_id
            )
        )
        or 0
    ) + 1
    cv = Cv(
        account_id=account_id,
        candidate_id=candidate.candidate_id,
        file_name=file_name,
        file_path=file_path,
        file_type="PDF",
        file_size_kb=file_size_kb,
        file_sha256=file_sha256,
        version_number=version_number,
        is_latest=True,
    )
    db.add(cv)
    db.flush()
    db.add(
        CvParseResult(
            cv_id=cv.cv_id,
            parse_status="Pending",
            parser_version=parser_version,
        )
    )
    application = Application(
        candidate_id=candidate.candidate_id,
        job_id=job_id,
        cv_id=cv.cv_id,
    )
    db.add(application)
    db.flush()
    match = MatchResult(
        cv_id=cv.cv_id,
        job_id=job_id,
        application_id=application.application_id,
        status="Pending",
        algorithm_version=algorithm_version,
        model_name=model_name or algorithm_version,
    )
    db.add(match)
    db.commit()
    db.refresh(application)
    db.refresh(cv)
    db.refresh(match)
    return application, cv, match


def analysis_context(db: Session, application_id: int):
    return db.execute(
        select(Application, Cv, CvParseResult, Job, MatchResult)
        .join(Cv, Cv.cv_id == Application.cv_id)
        .join(CvParseResult, CvParseResult.cv_id == Cv.cv_id)
        .join(Job, Job.job_id == Application.job_id)
        .join(MatchResult, MatchResult.application_id == Application.application_id)
        .where(Application.application_id == application_id)
        .order_by(
            CvParseResult.cv_parse_id.desc(),
            MatchResult.match_result_id.desc(),
        )
        .limit(1)
    ).first()


def create_job_parse(
    db: Session,
    *,
    match: MatchResult,
    account_id: int,
    job_id: int,
    title: str,
    raw_text: str,
    content_sha256: str,
    parser_version: str,
) -> JdParseResult:
    description = JobDescription(
        account_id=account_id,
        job_id=job_id,
        title=title,
        source_type="Job",
        raw_text=raw_text,
        content_sha256=content_sha256,
    )
    db.add(description)
    db.flush()
    parsed = JdParseResult(
        job_description_id=description.job_description_id,
        parse_status="Processing",
        parser_version=parser_version,
    )
    db.add(parsed)
    db.flush()
    match.job_description_id = description.job_description_id
    match.jd_parse_id = parsed.jd_parse_id
    db.commit()
    return parsed


def set_job_parse_success(
    db: Session, parsed: JdParseResult, payload: dict
) -> None:
    parsed.parsed_json = payload
    parsed.parse_status = "Success"
    parsed.error_message = None
    parsed.parsed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()


def set_job_parse_failed(
    db: Session, parsed: JdParseResult, error_message: str
) -> None:
    parsed.parse_status = "Failed"
    parsed.error_message = error_message[:500]
    parsed.parsed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()


def reset_analysis(
    db: Session,
    *,
    parsed_cv: CvParseResult,
    match: MatchResult,
    parser_version: str,
    reparse_cv: bool,
) -> None:
    if reparse_cv:
        parsed_cv.parse_status = "Pending"
        parsed_cv.parser_version = parser_version
        parsed_cv.parsed_json = None
        parsed_cv.error_message = None
        parsed_cv.parsed_at = None

    match.status = "Pending"
    match.overall_score = None
    match.skill_score = None
    match.experience_score = None
    match.education_score = None
    match.soft_skill_score = None
    match.pass_probability = None
    match.match_label = None
    match.evidence_json = None
    match.match_summary = None
    match.strengths = None
    match.weaknesses = None
    match.recommendation = None
    match.error_message = None
    match.completed_at = None
    db.commit()


def ranked_rows(db: Session, job_id: int):
    latest_parse = (
        select(
            CvParseResult.cv_id.label("cv_id"),
            func.max(CvParseResult.cv_parse_id).label("cv_parse_id"),
        )
        .group_by(CvParseResult.cv_id)
        .subquery()
    )
    latest_match = (
        select(
            MatchResult.application_id.label("application_id"),
            func.max(MatchResult.match_result_id).label("match_result_id"),
        )
        .where(MatchResult.application_id.is_not(None))
        .group_by(MatchResult.application_id)
        .subquery()
    )
    statement = (
        select(Application, Candidate, Cv, CvParseResult, MatchResult)
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Cv, Cv.cv_id == Application.cv_id)
        .outerjoin(latest_parse, latest_parse.c.cv_id == Cv.cv_id)
        .outerjoin(
            CvParseResult,
            CvParseResult.cv_parse_id == latest_parse.c.cv_parse_id,
        )
        .outerjoin(
            latest_match,
            latest_match.c.application_id == Application.application_id,
        )
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match.c.match_result_id,
        )
        .where(Application.job_id == job_id)
        .order_by(
            MatchResult.overall_score.is_(None),
            MatchResult.overall_score.desc(),
            Application.applied_at,
        )
    )
    return db.execute(statement).all()


def student_rows(db: Session, account_id: int):
    latest_parse = (
        select(
            CvParseResult.cv_id.label("cv_id"),
            func.max(CvParseResult.cv_parse_id).label("cv_parse_id"),
        )
        .group_by(CvParseResult.cv_id)
        .subquery()
    )
    latest_match = (
        select(
            MatchResult.application_id.label("application_id"),
            func.max(MatchResult.match_result_id).label("match_result_id"),
        )
        .where(MatchResult.application_id.is_not(None))
        .group_by(MatchResult.application_id)
        .subquery()
    )
    statement = (
        select(
            Application,
            Job,
            Company,
            Cv,
            CvParseResult,
            MatchResult,
        )
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Job, Job.job_id == Application.job_id)
        .join(Company, Company.company_id == Job.company_id)
        .join(Cv, Cv.cv_id == Application.cv_id)
        .outerjoin(latest_parse, latest_parse.c.cv_id == Cv.cv_id)
        .outerjoin(
            CvParseResult,
            CvParseResult.cv_parse_id == latest_parse.c.cv_parse_id,
        )
        .outerjoin(
            latest_match,
            latest_match.c.application_id == Application.application_id,
        )
        .outerjoin(
            MatchResult,
            MatchResult.match_result_id == latest_match.c.match_result_id,
        )
        .where(Candidate.account_id == account_id)
        .order_by(Application.applied_at.desc(), Application.application_id.desc())
    )
    return db.execute(statement).all()


def download_context(db: Session, application_id: int):
    return db.execute(
        select(Application, Candidate, Cv, Job)
        .join(Candidate, Candidate.candidate_id == Application.candidate_id)
        .join(Cv, Cv.cv_id == Application.cv_id)
        .join(Job, Job.job_id == Application.job_id)
        .where(Application.application_id == application_id)
    ).first()
