# Ke hoach KAN-220, KAN-224, KAN-228

Trang thai: Da duyet va da trien khai tren nhanh
`feature/kan-220-224-228-platform-hardening`.

Baseline: `origin/main` tai commit `fe25627` (`fix: preserve CV education and experience evidence`).

## Nguyen tac da chot

- Giu FastAPI modular monolith, MySQL va cac layer hien co.
- Giu `backend/app/services/match_engine.py::score_match()` la diem vao cham diem duy nhat.
- Screening CV upload ngoai FitCV tach khoi `application` cua Job Applicants.
- AI job duoc luu trong MySQL, co retry, heartbeat va khoi phuc lease het han.
- Access token song ngan; refresh token nam trong HttpOnly cookie va duoc xoay vong.
- Khong thay doi 4 role, Google sign-in hay reset password bang ma 6 so.

## Bang ke hoach va trang thai

| Thu tu | Jira | Noi dung | Dau ra | Kiem thu chap nhan | Trang thai |
|---:|---|---|---|---|---|
| 1 | KAN-221 | Schema luu HR screening batch | `hr_screening_batch`, `hr_screening_candidate`, migration 010, SQLAlchemy models | Luu batch/candidate, company scope, selection va partial failure | Hoan thanh |
| 2 | KAN-222 | API save/reload screening | Create 202, list, detail, save selection, download CV | Reload giu ket qua va shortlist; cong ty khac khong doc duoc | Hoan thanh |
| 3 | KAN-223 | History filters | Search, status, date range, minimum score, paging; UI history | Filter ket hop duoc, mo batch cu tu UI | Hoan thanh |
| 4 | KAN-225 | Durable AI queue schema | Mo rong `ai_task`: ownership, idempotency, retry, available time, lease | Enqueue trung khong tao task moi; claim doc quyen | Hoan thanh |
| 5 | KAN-226 | Worker retry lifecycle | Worker dispatcher, heartbeat, exponential backoff, max attempts | Success, retry, terminal failure deu luu DB | Hoan thanh |
| 6 | KAN-227 | Recovery va polling | Recover stale lease, task status API, frontend batch polling | Restart khong mat task; polling dung o terminal state | Hoan thanh |
| 7 | KAN-229 | Refresh session flow | `auth_session`, access token co `sid`, rotate refresh cookie, retry 401 mot lan | Refresh cu het hieu luc sau rotate; session bi revoke tra 401 | Hoan thanh |
| 8 | KAN-230 | Auth rate limiting | `auth_rate_limit` va threshold rieng theo action | Vuot nguong tra 429; counter dung chung qua cac API instance | Hoan thanh |
| 9 | KAN-231 | Logout/reset invalidation | Server logout; reset password revoke tat ca session | Cookie duoc xoa; access token cua session da revoke bi tu choi | Hoan thanh |
| 10 | Bao cao | Verification va tai lieu | README, env example, implementation report | Backend focused/full suite, frontend tests/build, compile/import checks | Hoan thanh; 1 test Tracker ngoai scope con fail |

## Thu tu deploy

1. Backup database MySQL hien tai.
2. Chay `database/migrations/010_add_platform_hardening.sql` dung mot lan.
3. Cau hinh cac bien worker va refresh cookie trong Render.
4. Deploy backend, kiem tra `/api/health` va worker log.
5. Deploy frontend Vercel, kiem tra login, refresh, upload batch va reload history.

Chi tiet file, endpoint, workflow va ket qua test nam trong
`docs/KAN-220_224_228_IMPLEMENTATION_REPORT.md`.
