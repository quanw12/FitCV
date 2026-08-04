from datetime import datetime

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.models.platform import (
    HrScreeningBatch,
    HrScreeningCandidate,
    ScreeningBatchStatus,
    ScreeningCandidateStatus,
)


def create_batch(
    db: Session,
    *,
    company_id: int,
    account_id: int,
    title: str,
    job_description: str,
    total_files: int,
) -> HrScreeningBatch:
    batch = HrScreeningBatch(
        company_id=company_id,
        created_by_account_id=account_id,
        title=title,
        job_description=job_description,
        total_files=total_files,
        status=ScreeningBatchStatus.pending,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def add_candidates(db: Session, rows: list[HrScreeningCandidate]) -> None:
    db.add_all(rows)
    db.commit()


def get_owned(
    db: Session, batch_id: int, company_id: int, *, for_update: bool = False
) -> HrScreeningBatch | None:
    statement = select(HrScreeningBatch).where(
        HrScreeningBatch.screening_batch_id == batch_id,
        HrScreeningBatch.company_id == company_id,
    )
    if for_update:
        statement = statement.with_for_update()
    return db.scalar(statement)


def get(db: Session, batch_id: int) -> HrScreeningBatch | None:
    return db.get(HrScreeningBatch, batch_id)


def list_candidates(db: Session, batch_id: int) -> list[HrScreeningCandidate]:
    return list(
        db.scalars(
            select(HrScreeningCandidate)
            .where(HrScreeningCandidate.screening_batch_id == batch_id)
            .order_by(HrScreeningCandidate.source_index)
        )
    )


def get_candidate(
    db: Session, batch_id: int, candidate_id: int
) -> HrScreeningCandidate | None:
    return db.scalar(
        select(HrScreeningCandidate).where(
            HrScreeningCandidate.screening_batch_id == batch_id,
            HrScreeningCandidate.screening_candidate_id == candidate_id,
        )
    )


def list_history(
    db: Session,
    *,
    company_id: int,
    query: str | None,
    status: ScreeningBatchStatus | None,
    created_from: datetime | None,
    created_to: datetime | None,
    min_score: float | None,
    limit: int,
    offset: int,
) -> list[HrScreeningBatch]:
    statement = select(HrScreeningBatch).where(
        HrScreeningBatch.company_id == company_id
    )
    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(
            HrScreeningBatch.title.ilike(pattern)
            | HrScreeningBatch.job_description.ilike(pattern)
        )
    if status:
        statement = statement.where(HrScreeningBatch.status == status)
    if created_from:
        statement = statement.where(HrScreeningBatch.created_at >= created_from)
    if created_to:
        statement = statement.where(HrScreeningBatch.created_at <= created_to)
    if min_score is not None:
        statement = statement.where(
            exists(
                select(HrScreeningCandidate.screening_candidate_id).where(
                    HrScreeningCandidate.screening_batch_id
                    == HrScreeningBatch.screening_batch_id,
                    HrScreeningCandidate.score >= min_score,
                )
            )
        )
    return list(
        db.scalars(
            statement.order_by(
                HrScreeningBatch.created_at.desc(),
                HrScreeningBatch.screening_batch_id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
    )


def mark_processing(db: Session, batch: HrScreeningBatch) -> None:
    batch.status = ScreeningBatchStatus.processing
    batch.error_message = None
    db.commit()


def save_result(
    db: Session,
    batch: HrScreeningBatch,
    *,
    required_skills: list[str],
    preferred_skills: list[str],
    warnings: list[str],
    results: dict[int, dict],
    completed_at: datetime,
) -> None:
    rows = list_candidates(db, batch.screening_batch_id)
    for row in rows:
        payload = results.get(row.source_index)
        if payload is None:
            row.status = ScreeningCandidateStatus.failed
            row.error_message = next(
                (item for item in warnings if item.startswith(f"{row.file_name}:")),
                "CV processing failed.",
            )[:1000]
            continue
        row.name = payload["name"]
        row.email = payload["email"]
        row.phone = payload["phone"]
        row.location = payload["location"]
        row.position = payload["position"]
        row.skills_json = payload["skills"]
        row.matched_skills_json = payload["matched_skills"]
        row.missing_skills_json = payload["missing_skills"]
        row.experience_years = payload["experience_years"]
        row.education = payload["education"]
        row.score = payload["score"]
        row.match_label = payload["match_label"]
        row.score_breakdown_json = payload["score_breakdown"]
        row.strengths_json = payload["strengths"]
        row.weaknesses_json = payload["weaknesses"]
        row.parse_notes_json = payload["parse_notes"]
        row.status = ScreeningCandidateStatus.ready
        row.error_message = None
    ready_count = sum(row.status == ScreeningCandidateStatus.ready for row in rows)
    batch.required_skills_json = required_skills
    batch.preferred_skills_json = preferred_skills
    batch.warnings_json = warnings
    batch.processed_count = ready_count
    batch.completed_at = completed_at
    batch.status = (
        ScreeningBatchStatus.completed
        if ready_count == batch.total_files
        else ScreeningBatchStatus.partial
        if ready_count > 0
        else ScreeningBatchStatus.failed
    )
    if ready_count == 0:
        batch.error_message = "No CV in this screening batch could be processed."
    db.commit()


def update_selection(
    db: Session,
    batch: HrScreeningBatch,
    *,
    selected_keys: set[str],
    confirmed_keys: set[str],
) -> None:
    rows = list_candidates(db, batch.screening_batch_id)
    valid_keys = {row.candidate_key for row in rows}
    selected_keys &= valid_keys
    confirmed_keys &= selected_keys
    for row in rows:
        row.is_selected = row.candidate_key in selected_keys
        row.is_confirmed = row.candidate_key in confirmed_keys
    batch.selected_count = len(confirmed_keys)
    db.commit()
