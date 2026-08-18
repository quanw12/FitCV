"""Seed demo recruitment data so the HR dashboard and reports screens render.

Inserts new rows only (never updates or deletes existing team data):

- a few catalog ``position`` rows (Engineering, Data & Analytics, ...)
- demo jobs for the target HR account's company
- demo candidates + CVs (emails end in ``@fitcv-demo.dev``)
- applications spread across the current month, the previous month and the
  month before that, with match scores covering every score band
- stage history so review progress, screening pass rate and the
  time-to-shortlist / time-to-hire / offer-acceptance KPIs all have values

Usage (from ``backend/`` with the venv active):

    python scripts/seed_demo_reports.py --email akiet2808@gmail.com
    python scripts/seed_demo_reports.py --email akiet2808@gmail.com --clean

``--clean`` removes only the demo rows this script created.
"""

from __future__ import annotations

import argparse
import hashlib
import random
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pymysql

DEMO_EMAIL_DOMAIN = "@fitcv-demo.dev"

POSITIONS = [
    ("ENG", "Engineering"),
    ("DATA", "Data & Analytics"),
    ("DES", "Design"),
    ("POPS", "People & Operations"),
]

JOBS = [
    # (title, position full name, status, description)
    ("Senior Backend Engineer", "Engineering", "Published",
     "Design and scale our core services with Python and PostgreSQL."),
    ("Frontend Engineer (React)", "Engineering", "Published",
     "Build the FitCV seeker portal with React 19 and Tailwind."),
    ("Data Analyst", "Data & Analytics", "Published",
     "Turn hiring funnel data into dashboards and reports."),
    ("People Operations Coordinator", "People & Operations", "Published",
     "Own onboarding and candidate experience operations."),
    ("Product Designer", "Design", "Draft",
     "Shape the FitCV design system (draft — not visible in reports)."),
]

CANDIDATE_NAMES = [
    "Nguyễn Văn An", "Trần Thị Bảo", "Lê Minh Châu", "Phạm Quốc Đạt",
    "Hoàng Thu Dung", "Vũ Tuấn Anh", "Đặng Khánh Linh", "Bùi Gia Hưng",
    "Ngô Phương Uyên", "Đỗ Trí Nam", "Lý Thanh Trúc", "Dương Hồng Phúc",
    "Mai Nhật Quang", "Trịnh Bảo Vy", "Phan Anh Tú", "Lâm Diễm My",
    "Tạ Hoàng Long", "Chu Kiều Trinh", "Lý Công Minh", "Tống Mỹ Duyên",
]

# (day offset from today, job index, score, stage path after Applied)
# stage path entries are (stage, extra days after applied)
APPLICATIONS = [
    (-57, 0, 58.0, [("Screening", 2)]),
    (-52, 1, 71.0, [("Screening", 3), ("Interview", 8)]),
    (-47, 2, 47.0, []),
    (-44, 0, 85.0, [("Screening", 1)]),
    (-40, 1, 54.0, []),
    (-37, 2, 91.0, [("Screening", 2), ("Interview", 6), ("Offer", 11)]),
    (-33, 0, 66.0, [("Screening", 3), ("Rejected", 4)]),
    (-31, 3, 62.0, []),
    (-27, 0, 83.0, [("Screening", 2)]),
    (-24, 1, 76.0, [("Screening", 1), ("Interview", 4)]),
    (-22, 2, 45.0, []),
    (-19, 0, 88.0, [("Screening", 2), ("Interview", 6), ("Offer", 10)]),
    (-17, 3, 74.0, [("Screening", 3)]),
    (-14, 1, 68.0, [("Screening", 2)]),
    (-11, 0, 91.0, [("Screening", 1), ("Interview", 4), ("Hired", 9)]),
    (-8, 2, 58.0, []),
    (-5, 1, 52.0, []),
    (-2, 3, 79.0, [("Screening", 1)]),
]


def match_label(score: float) -> str:
    if score >= 80:
        return "Strong Match"
    if score >= 50:
        return "Moderate Match"
    return "Weak Match"


def parse_database_url(url: str) -> dict:
    matched = re.match(
        r"mysql\+pymysql://([^:]+):([^@]+)@([^:/]+):(\d+)/(.+)", url.strip()
    )
    if not matched:
        raise SystemExit("DATABASE_URL in backend/.env is not a pymysql URL.")
    user, password, host, port, database = matched.groups()
    return dict(
        user=user, password=password, host=host,
        port=int(port), database=database,
    )


def load_connection() -> pymysql.connections.Connection:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        raise SystemExit("backend/.env not found — configure DATABASE_URL first.")
    url = next(
        (
            line.split("=", 1)[1].strip()
            for line in env_path.read_text().splitlines()
            if line.startswith("DATABASE_URL=")
        ),
        None,
    )
    if not url:
        raise SystemExit("DATABASE_URL is not set in backend/.env.")
    return pymysql.connect(**parse_database_url(url), autocommit=False)


def resolve_company(cur, email: str) -> tuple[int, int, str]:
    cur.execute(
        "SELECT account_id, company_id, full_name FROM account "
        "WHERE email = %s AND role IN ('HR', 'HiringManager', 'Admin')",
        (email,),
    )
    row = cur.fetchone()
    if row is None:
        raise SystemExit(f"No HR account found for {email}.")
    account_id, company_id, full_name = row
    if company_id is None:
        raise SystemExit(
            f"Account {email} has no company yet — set one in HR Settings first."
        )
    return account_id, company_id, full_name


def demo_rows_exist(cur) -> bool:
    cur.execute(
        "SELECT 1 FROM candidate WHERE email LIKE %s LIMIT 1",
        (f"%{DEMO_EMAIL_DOMAIN}",),
    )
    return cur.fetchone() is not None


def clean(cur, company_id: int) -> None:
    cur.execute(
        "SELECT application_id FROM application a "
        "JOIN candidate c ON c.candidate_id = a.candidate_id "
        "WHERE c.email LIKE %s",
        (f"%{DEMO_EMAIL_DOMAIN}",),
    )
    app_ids = [row[0] for row in cur.fetchall()]
    if app_ids:
        cur.execute(
            "DELETE FROM application_stage_history "
            "WHERE application_id IN (%s)" % ",".join(map(str, app_ids))
        )
        cur.execute(
            "DELETE FROM match_result WHERE application_id IN (%s)"
            % ",".join(map(str, app_ids))
        )
        cur.execute(
            "DELETE FROM application WHERE application_id IN (%s)"
            % ",".join(map(str, app_ids))
        )
    cur.execute("DELETE FROM cv WHERE file_path LIKE 'uploads/demo/%'")
    cur.execute(
        "DELETE FROM candidate WHERE email LIKE %s",
        (f"%{DEMO_EMAIL_DOMAIN}",),
    )
    cur.execute(
        "DELETE FROM job WHERE company_id = %s AND title IN ("
        + ",".join(["%s"] * len(JOBS))
        + ")",
        [company_id, *(job[0] for job in JOBS)],
    )
    print("Demo rows removed.")


def seed(cur, account_id: int, company_id: int) -> None:
    now = datetime.now()
    random.seed(20260816)

    position_ids: dict[str, int] = {}
    for abbreviation, full_name in POSITIONS:
        cur.execute(
            "SELECT position_id FROM position WHERE full_name = %s",
            (full_name,),
        )
        row = cur.fetchone()
        if row:
            position_ids[full_name] = row[0]
        else:
            cur.execute(
                "INSERT INTO position (abbreviation, full_name) VALUES (%s, %s)",
                (abbreviation, full_name),
            )
            position_ids[full_name] = cur.lastrowid

    job_ids: list[int] = []
    for title, position_name, status, description in JOBS:
        cur.execute(
            "INSERT INTO job (company_id, created_by_account_id, position_id, "
            "title, description, status, deadline, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (
                company_id, account_id, position_ids[position_name], title,
                description, status, now + timedelta(days=30),
                now - timedelta(days=40),
            ),
        )
        job_ids.append(cur.lastrowid)

    candidate_ids: list[int] = []
    cv_ids: list[int] = []
    for index, name in enumerate(CANDIDATE_NAMES, start=1):
        cur.execute(
            "INSERT INTO candidate (full_name, email, created_by_hr_account_id) "
            "VALUES (%s, %s, %s)",
            (name, f"demo.cv{index:02d}{DEMO_EMAIL_DOMAIN}", account_id),
        )
        candidate_ids.append(cur.lastrowid)
        cur.execute(
            "INSERT INTO cv (candidate_id, file_name, file_path, file_type, "
            "file_size_kb, file_sha256, uploaded_at) "
            "VALUES (%s, %s, %s, 'PDF', %s, %s, %s)",
            (
                candidate_ids[-1],
                f"demo-cv-{index:02d}.pdf",
                f"uploads/demo/demo-cv-{index:02d}.pdf",
                random.randint(120, 480),
                hashlib.sha256(f"fitcv-demo-{index}".encode()).hexdigest(),
                now - timedelta(days=45),
            ),
        )
        cv_ids.append(cur.lastrowid)

    seeded = 0
    for index, (day_offset, job_index, score, path) in enumerate(APPLICATIONS):
        applied_at = now + timedelta(days=day_offset, hours=-random.randint(1, 8))
        final_stage = path[-1][0] if path else "Applied"
        status = "Active"
        if final_stage == "Hired":
            status = "Hired"
        elif final_stage == "Rejected":
            status = "Rejected"

        cur.execute(
            "INSERT INTO application (candidate_id, job_id, cv_id, "
            "current_stage, status, applied_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (
                candidate_ids[index], job_ids[job_index], cv_ids[index],
                final_stage, status, applied_at,
            ),
        )
        application_id = cur.lastrowid

        cur.execute(
            "INSERT INTO match_result (application_id, cv_id, job_id, status, "
            "overall_score, match_label, algorithm_version, generated_at) "
            "VALUES (%s, %s, %s, 'Success', %s, %s, 'fitcv-source-grounded-v2', %s)",
            (
                application_id, cv_ids[index], job_ids[job_index], score,
                match_label(score), applied_at + timedelta(minutes=5),
            ),
        )

        previous_stage = "Applied"
        for stage, extra_days in path:
            changed_at = applied_at + timedelta(days=extra_days, hours=1)
            if changed_at > now:
                changed_at = now - timedelta(hours=1)
            cur.execute(
                "INSERT INTO application_stage_history "
                "(application_id, previous_stage, new_stage, changed_by_account_id, changed_at) "
                "VALUES (%s, %s, %s, %s, %s)",
                (application_id, previous_stage, stage, account_id, changed_at),
            )
            previous_stage = stage
        seeded += 1

    print(
        f"Seeded {len(POSITIONS)} positions (catalog), {len(JOBS)} jobs, "
        f"{len(CANDIDATE_NAMES)} candidates+CVs, {seeded} applications "
        "with match scores and stage history."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", default="akiet2808@gmail.com",
                        help="HR account email that owns the demo company data")
    parser.add_argument("--clean", action="store_true",
                        help="remove previously seeded demo rows instead of seeding")
    args = parser.parse_args()

    connection = load_connection()
    try:
        with connection.cursor() as cur:
            account_id, company_id, full_name = resolve_company(cur, args.email)

            if args.clean:
                clean(cur, company_id)
                connection.commit()
                return 0

            if demo_rows_exist(cur):
                print(
                    "Demo data already exists — run with --clean first if you "
                    "want to reseed."
                )
                return 0

            print(f"Seeding demo data for {full_name} (company_id={company_id})…")
            seed(cur, account_id, company_id)
            connection.commit()
            print("Done. Log in as the HR account to view the dashboard and reports.")
            return 0
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    sys.exit(main())
