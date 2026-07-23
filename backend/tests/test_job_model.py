from sqlalchemy import CheckConstraint, Numeric

from app.models import Job


def test_job_archive_and_scoring_column_contract() -> None:
    columns = Job.__table__.c

    assert columns.archived_at.nullable is True

    expected_weights = {
        "skill_weight": 45.0,
        "experience_weight": 30.0,
        "education_weight": 15.0,
        "soft_skill_weight": 10.0,
    }
    assert sum(expected_weights.values()) == 100.0

    for name, expected_default in expected_weights.items():
        column = columns[name]
        assert isinstance(column.type, Numeric)
        assert column.type.precision == 5
        assert column.type.scale == 2
        assert column.nullable is False
        assert column.default is not None
        assert column.default.arg == expected_default
        assert column.server_default is not None
        assert float(str(column.server_default.arg)) == expected_default


def test_job_scoring_constraints_and_visibility_indexes() -> None:
    checks = {
        constraint.name: str(constraint.sqltext)
        for constraint in Job.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }
    assert checks == {
        "chk_job_skill_weight": "skill_weight >= 0 AND skill_weight <= 100",
        "chk_job_experience_weight": (
            "experience_weight >= 0 AND experience_weight <= 100"
        ),
        "chk_job_education_weight": (
            "education_weight >= 0 AND education_weight <= 100"
        ),
        "chk_job_soft_skill_weight": (
            "soft_skill_weight >= 0 AND soft_skill_weight <= 100"
        ),
        "chk_job_weight_total": (
            "skill_weight + experience_weight + education_weight + "
            "soft_skill_weight = 100"
        ),
    }

    indexes = {
        index.name: tuple(column.name for column in index.columns)
        for index in Job.__table__.indexes
    }
    assert indexes["idx_job_company_archive_status"] == (
        "company_id",
        "archived_at",
        "status",
    )
    assert indexes["idx_job_public_visibility"] == (
        "status",
        "archived_at",
        "deadline",
    )
