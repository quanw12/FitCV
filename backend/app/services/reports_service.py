from collections import defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.account import Account
from app.repositories import reports as reports_repo
from app.schemas.reports import (
    ReportBucket,
    ReportCharts,
    ReportJobRow,
    ReportKpis,
    ReportPassRate,
    ReportPrev,
    ReportScoreBucket,
    ReportSummaryResponse,
    ReportWindow,
)

MAX_WINDOW_DAYS = 366
SCREENED_STAGES = {"Screening", "Interview", "Offer", "Hired"}
SCORE_BUCKETS = [
    ("90-100%", lambda score: score >= 90),
    ("80-89%", lambda score: score >= 80),
    ("70-79%", lambda score: score >= 70),
    ("60-69%", lambda score: score >= 60),
    ("50-59%", lambda score: score >= 50),
    ("<50%", lambda score: score < 50),
]


def _company_id(account: Account) -> int:
    if account.company_id is None:
        raise HTTPException(
            status_code=400,
            detail="A company must be assigned to view reports.",
        )
    return account.company_id


def _window(from_date: date | None, to_date: date | None) -> tuple[date, date]:
    to_date = to_date or date.today()
    from_date = from_date or (to_date - timedelta(days=29))
    if from_date > to_date:
        raise HTTPException(
            status_code=422, detail="from must be on or before to."
        )
    if (to_date - from_date).days + 1 > MAX_WINDOW_DAYS:
        raise HTTPException(
            status_code=422,
            detail="Report window must not exceed 366 days.",
        )
    return from_date, to_date


def _window_label(from_date: date, to_date: date) -> str:
    is_full_month = from_date.day == 1 and to_date == _month_last_day(from_date)
    if is_full_month:
        return f"{from_date.strftime('%b')} {from_date.year}"
    return f"{from_date.isoformat()} - {to_date.isoformat()}"


def _month_last_day(value: date) -> date:
    if value.month == 12:
        next_month = date(value.year + 1, 1, 1)
    else:
        next_month = date(value.year, value.month + 1, 1)
    return next_month - timedelta(days=1)


def _avg_days(
    apps, first_at_map: dict[int, datetime]
) -> float | None:
    days = []
    for app, _ in apps:
        first_at = first_at_map.get(app.application_id)
        if first_at is not None and first_at >= app.applied_at:
            days.append(
                (first_at - app.applied_at).total_seconds() / 86400
            )
    return round(sum(days) / len(days), 1) if days else None


def _offer_acceptance(apps, offer: dict[int, datetime], hired: dict[int, datetime]):
    offered = [app for app, _ in apps if app.application_id in offer]
    if not offered:
        return None
    hired_count = sum(
        1 for app in offered if app.application_id in hired
    )
    return round(hired_count * 100 / len(offered), 1)


def _kpis(apps, screening, hired, offer, active_job_posts: int | None) -> dict:
    total = len(apps)
    scores = [float(score) for _, score in apps if score is not None]
    moved = sum(1 for app, _ in apps if app.current_stage != "Applied")
    passed = sum(
        1
        for app, _ in apps
        if app.current_stage in SCREENED_STAGES
        or app.application_id in screening
    )
    return {
        "active_job_posts": active_job_posts,
        "total_cvs_reviewed": total,
        "avg_candidate_score": (
            round(sum(scores) / len(scores), 1) if scores else None
        ),
        "review_progress": (
            round(moved * 100 / total, 1) if total else None
        ),
        "time_to_shortlist_days": _avg_days(apps, screening),
        "time_to_hire_days": _avg_days(apps, hired),
        "offer_acceptance_rate": _offer_acceptance(apps, offer, hired),
        "passed_count": passed,
        "not_passed_count": total - passed,
    }


def _job_rows(jobs, apps) -> list[ReportJobRow]:
    by_job: dict[int, list] = defaultdict(list)
    for app, score in apps:
        by_job[app.job_id].append((app, score))
    rows = []
    for job, department in jobs:
        job_apps = by_job.get(job.job_id, [])
        scores = [float(score) for _, score in job_apps if score is not None]
        moved = sum(1 for app, _ in job_apps if app.current_stage != "Applied")
        rows.append(
            ReportJobRow(
                job_id=job.job_id,
                title=job.title,
                department=department,
                cv_count=len(job_apps),
                avg_score=(
                    round(sum(scores) / len(scores), 1) if scores else None
                ),
                review_progress=(
                    round(moved * 100 / len(job_apps), 1)
                    if job_apps
                    else None
                ),
                status=job.status,
            )
        )
    return rows


def _time_series(apps, from_dt: datetime, to_dt: datetime, weekly: bool) -> list[ReportBucket]:
    counts: dict[str, int] = {}
    for app, _ in apps:
        key = _period_key(app.applied_at, weekly)
        counts[key] = counts.get(key, 0) + 1
    buckets: list[ReportBucket] = []
    seen: set[str] = set()
    day = from_dt
    while day <= to_dt:
        key = _period_key(day, weekly)
        if key not in seen:
            seen.add(key)
            buckets.append(
                ReportBucket(
                    period=key,
                    label=_period_label(day, weekly),
                    count=counts.get(key, 0),
                )
            )
        day += timedelta(days=1)
    return buckets


def _period_key(value: datetime, weekly: bool) -> str:
    if weekly:
        iso = value.isocalendar()
        return f"{iso.year:04d}-W{iso.week:02d}"
    return f"{value.year:04d}-{value.month:02d}"


def _period_label(value: datetime, weekly: bool) -> str:
    if weekly:
        return f"{value.strftime('%b')} {value.day}"
    return value.strftime("%b")


def _score_distribution(apps) -> list[ReportScoreBucket]:
    counts = {name: 0 for name, _ in SCORE_BUCKETS}
    for _, score in apps:
        if score is None:
            continue
        value = float(score)
        for name, matches in SCORE_BUCKETS:
            if matches(value):
                counts[name] += 1
                break
    return [
        ReportScoreBucket(range=name, count=count)
        for name, count in counts.items()
    ]


def _collect(
    db: Session,
    company_id: int,
    from_dt: datetime,
    to_dt: datetime,
):
    apps = reports_repo.application_rows_with_scores(
        db, company_id, from_dt, to_dt
    )
    screening = reports_repo.first_reached_stage_map(
        db, company_id, from_dt, to_dt, "Screening"
    )
    hired = reports_repo.first_reached_stage_map(
        db, company_id, from_dt, to_dt, "Hired"
    )
    offer = reports_repo.first_reached_stage_map(
        db, company_id, from_dt, to_dt, "Offer"
    )
    return apps, screening, hired, offer


def summary(
    db: Session,
    account: Account,
    from_date: date | None = None,
    to_date: date | None = None,
) -> ReportSummaryResponse:
    company_id = _company_id(account)
    from_date, to_date = _window(from_date, to_date)

    window_days = (to_date - from_date).days + 1
    prev_from = from_date - timedelta(days=window_days)
    prev_to = from_date - timedelta(days=1)

    from_dt = datetime.combine(from_date, time.min)
    to_dt = datetime.combine(to_date, time.max)
    prev_from_dt = datetime.combine(prev_from, time.min)
    prev_to_dt = datetime.combine(prev_to, time.max)

    jobs = reports_repo.job_rows(db, company_id)
    apps, screening, hired, offer = _collect(
        db, company_id, from_dt, to_dt
    )
    prev_apps, prev_screening, prev_hired, prev_offer = _collect(
        db, company_id, prev_from_dt, prev_to_dt
    )

    current = _kpis(apps, screening, hired, offer, len(jobs))
    previous = _kpis(prev_apps, prev_screening, prev_hired, prev_offer, None)

    weekly = window_days <= 62
    charts = ReportCharts(
        applications_over_time=_time_series(apps, from_dt, to_dt, weekly),
        screening_pass_rate=ReportPassRate(
            passed_count=current["passed_count"],
            not_passed_count=current["not_passed_count"],
        ),
        score_distribution=_score_distribution(apps),
    )

    return ReportSummaryResponse(
        window=ReportWindow(
            from_=from_date.isoformat(),
            to=to_date.isoformat(),
            label=_window_label(from_date, to_date),
        ),
        kpis=ReportKpis(
            active_job_posts=current["active_job_posts"],
            total_cvs_reviewed=current["total_cvs_reviewed"],
            avg_candidate_score=current["avg_candidate_score"],
            review_progress=current["review_progress"],
            time_to_shortlist_days=current["time_to_shortlist_days"],
            time_to_hire_days=current["time_to_hire_days"],
            offer_acceptance_rate=current["offer_acceptance_rate"],
            prev=ReportPrev(
                active_job_posts=previous["active_job_posts"],
                total_cvs_reviewed=previous["total_cvs_reviewed"],
                avg_candidate_score=previous["avg_candidate_score"],
                review_progress=previous["review_progress"],
                time_to_shortlist_days=previous["time_to_shortlist_days"],
                time_to_hire_days=previous["time_to_hire_days"],
                offer_acceptance_rate=previous["offer_acceptance_rate"],
            ),
        ),
        charts=charts,
        jobs=_job_rows(jobs, apps),
    )
