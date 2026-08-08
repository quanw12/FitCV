# FitCV

FitCV là nền tảng sàng lọc CV và đánh giá độ phù hợp công việc bằng AI cho 2 nhóm người dùng:

- Student / Job Seeker: đăng nhập, chọn role, upload CV, phân tích CV với JD, xem gợi ý cải thiện, lịch sử CV và application tracker.
- HR / Recruiter / Hiring Manager / Admin: quản lý tin tuyển dụng, upload CV ứng viên, xếp hạng ứng viên, pipeline, email và báo cáo.

Repo hiện có:

- Frontend: React 19 + Vite + Tailwind CSS v4.
- Backend: FastAPI + SQLAlchemy + MySQL.
- Auth flow: register/login, Google sign-in, chọn 4 role, forgot/reset password bằng mã xác minh 6 số.

## Đọc Trước Khi Code

Trước khi giao việc cho AI hoặc thành viên khác, yêu cầu đọc:

1. `AGENTS.md`
2. `README.md`
3. `database/full_schema.sql` nếu thay đổi database, user/auth, model hoặc repository
4. File trong layer sắp sửa trước khi tạo file mới

 Context dự án hiện nằm trong `AGENTS.md`, `README.md`, `database/full_schema.sql`, và source code hiện tại.

Không tạo folder theo tên thành viên trong production code. Code phải nằm đúng layer:

- Frontend: `src/app`, `src/ui`, `src/api`, `src/services`, `src/data`, `src/types`
- Backend: `backend/app/api`, `core`, `db`, `models`, `repositories`, `schemas`, `services`, `middleware`

## Yêu Cầu Cài Đặt

- Node.js 20+ khuyến nghị
- Python 3.11+ khuyến nghị
- MySQL server
- npm
- Git

## Cài Frontend

Từ thư mục root:

```bash
npm install
```
Tạo hoặc cập nhật `.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```
Use local backend while testing on your machine. If `.env.local` points to Render, requests will go to Render and the local backend terminal will not show auth logs.

Frontend production currently falls back to this backend URL if `VITE_API_BASE_URL` is not set:

```text
https://fitcv-0cab.onrender.com
```

Still set `VITE_API_BASE_URL` explicitly in Vercel so future backend URL changes do not require code changes.

Vercel environment:

```env
VITE_API_BASE_URL=https://fitcv-0cab.onrender.com
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

Chạy frontend:

```bash
npm run dev
```

Frontend thường chạy ở:

```text
http://localhost:5173
```

Nếu Google OAuth báo lỗi origin, mở app bằng `http://localhost:5173` hoặc `http://127.0.0.1:5173`, không dùng IP LAN/Tailscale dạng `http://100.x.x.x:5173`.

## Cài Backend

Từ thư mục root:

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Cài headless Chromium dùng cho AI Rebuild CV:

```powershell
cd backend
.venv\Scripts\python.exe -m playwright install chromium
```

Tạo hoặc cập nhật `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://<db_user>:<url_encoded_password>@<db_host>:3306/fitcv
JWT_SECRET_KEY=<local-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_COOKIE_SECURE=false
GOOGLE_CLIENT_ID=<google-oauth-client-id>
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","https://fit-cv.vercel.app"]
RESEND_API_KEY=
RESEND_FROM_EMAIL=
AVATAR_STORAGE=local
BACKEND_PUBLIC_URL=http://127.0.0.1:8000
ANALYZER_PROVIDER=deterministic
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
AI_WORKER_ENABLED=true
```

Chạy backend:

```bash
python app/main.py
```

Backend chạy ở:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/api/health
```

## Deploy Backend Render

Khi deploy backend lên Render, vào Render service > Environment và thêm các biến:

```env
DATABASE_URL=mysql+pymysql://<db_user>:<url_encoded_password>@<db_host>:3306/fitcv
JWT_SECRET_KEY=<strong-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_COOKIE_SECURE=true
GOOGLE_CLIENT_ID=<google-oauth-client-id>
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","https://fit-cv.vercel.app"]
RESEND_API_KEY=
RESEND_FROM_EMAIL=
AI_WORKER_ENABLED=true
```

Nếu frontend Vercel đổi domain, thêm domain mới vào `CORS_ORIGINS`, ví dụ:

```env
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","https://fit-cv.vercel.app","https://your-preview.vercel.app"]
```

Sau khi đổi env trên Render, phải redeploy backend.

Render health check:

```text
https://fitcv-0cab.onrender.com/api/health
```

Nếu browser báo CORS khi register/login, kiểm tra:

- Request origin trên DevTools là domain nào.
- Domain đó có nằm trong `CORS_ORIGINS` của Render không.
- Render đã redeploy sau khi sửa env chưa.

## Database

Schema chính nằm ở:

```text
database/full_schema.sql
```

Nếu tạo database mới:

1. Tạo database `fitcv`.
2. Chạy toàn bộ `database/full_schema.sql` bằng MySQL user có quyền tạo bảng/index.
3. Backend runtime user cần quyền `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

### Platform Hardening: Screening, AI Queue, Auth Session

Database hiện hữu phải backup rồi chạy migration sau đúng một lần trước khi
deploy phiên bản backend này:

```text
database/migrations/010_add_platform_hardening.sql
```

Migration thêm `hr_screening_batch`, `hr_screening_candidate`, `auth_session`,
`auth_rate_limit` và mở rộng `ai_task` thành hàng đợi bền vững. Database mới tạo
từ `database/full_schema.sql` đã có sẵn các bảng/cột này nên không chạy lại
migration `010`.

Mặc định API chạy một worker nền trong cùng process (`AI_WORKER_ENABLED=true`).
Có thể tách worker thành Render Background Worker bằng lệnh sau và đặt
`AI_WORKER_ENABLED=false` trên Web Service để tránh chạy hai worker không cần thiết:

```powershell
cd backend
python -m app.worker
```

Các biến liên quan:

```env
AI_WORKER_ENABLED=true
AI_WORKER_POLL_SECONDS=1
AI_WORKER_LEASE_SECONDS=1800
AI_WORKER_HEARTBEAT_SECONDS=30
AI_TASK_MAX_ATTEMPTS=3
```

Local dùng `REFRESH_COOKIE_SECURE=false`. Render dùng
`REFRESH_COOKIE_SECURE=true`; backend khi đó đặt cookie `SameSite=None; Secure`
để frontend Vercel gọi `/api/auth/refresh` với `credentials: include`. Domain
Vercel chính xác vẫn phải có trong `CORS_ORIGINS`.

### Job Post Archiving And Scoring Schema

Database hiện hữu phải chạy migration sau trước khi deploy backend sử dụng
`archived_at` hoặc custom scoring weights:

```text
database/migrations/005_add_job_archiving_and_scoring.sql
```

Migration giữ nguyên recruitment status `Draft`, `Published`, `Closed`, thêm
thời điểm lưu trữ độc lập và bốn trọng số mặc định:

```text
Skills 45% · Experience 30% · Education 15% · Soft Skills 10%
```

Bốn trọng số phải nằm trong khoảng 0-100 và có tổng bằng 100. Migration có thể
chạy lại, nhưng vẫn phải backup database trước vì MySQL DDL tự commit. Chỉ dùng
`005_rollback_job_archiving_and_scoring.sql` trước khi production bắt đầu lưu
archive timestamp hoặc custom weights vì rollback sẽ xóa vĩnh viễn dữ liệu đó.

### Job Post Management API

Các endpoint quản lý yêu cầu role `HR`, `HiringManager` hoặc `Admin` và chỉ thao
tác job thuộc company của tài khoản:

```text
GET   /api/jobs/manage?archived=false
GET   /api/jobs/public
GET   /api/jobs/public/{job_id}
POST  /api/jobs/extract
POST  /api/jobs
PATCH /api/jobs/{job_id}
POST  /api/jobs/{job_id}/publish
POST  /api/jobs/{job_id}/close
POST  /api/jobs/{job_id}/archive
POST  /api/jobs/{job_id}/unarchive
```

Archive không thay đổi recruitment status. Job archived bị ẩn khỏi public list,
public detail và không nhận application mới. Create/update có thể nhận
`skill_weight`, `experience_weight`, `education_weight`, `soft_skill_weight`;
tổng hiệu lực sau khi merge phải bằng 100.

Hai public endpoint chỉ trả job `Published`, chưa archived và chưa quá deadline;
không yêu cầu đăng nhập để share JD ra ngoài. `POST /api/jobs/extract` yêu cầu
role quản lý, dùng Gemini server-side để đề xuất draft và không tự save/publish.
Scoring application dùng bốn trọng số của đúng job, đồng thời chuẩn hóa lại trên
những nhóm thực sự có yêu cầu trong JD.

### Recruiter Pipeline And Candidate Email

Database hiện hữu cần chạy tuần tự năm migration sau trước khi bật màn hình
Pipeline và Auto Email:

```text
database/migrations/006_add_recruiter_pipeline.sql
database/migrations/007_add_candidate_email_workflow.sql
database/migrations/009_add_smart_reply_workflow.sql
database/migrations/011_add_reliable_email_delivery.sql
database/migrations/012_add_email_campaigns.sql
```

Migration 006 thêm notes và lịch sử cho sáu stage backend hiện tại:
`Applied`, `Screening`, `Interview`, `Offer`, `Hired`, `Rejected`. Migration 007
lưu AI draft, bước HR approval, provider message ID, trạng thái `Failed` và thời
điểm gửi. Migration 009 thêm application-scoped email thread, địa chỉ reply
riêng, inbound message, delivery event, idempotency key và metadata chuẩn
`In-Reply-To`/`References`. Migration 011 thêm `retryable`, `retry_count` và
`last_attempt_at`, các cột bắt buộc cho màn hình Auto Email hiện tại. Migration
012 thêm campaign theo stage, template dùng chung cho cả lô và dấu stage tại
thời điểm tạo draft để chặn gửi nhầm khi ứng viên đã chuyển pipeline. Các
migration có preflight/postflight, có thể chạy lại, và có file rollback tương
ứng; rollback sẽ xóa vĩnh viễn dữ liệu workflow được nêu trong file.

```text
GET   /api/hr/pipeline
PATCH /api/hr/pipeline/applications/{application_id}/stage
GET   /api/hr/pipeline/applications/{application_id}/notes
POST  /api/hr/pipeline/applications/{application_id}/notes
GET   /api/hr/pipeline/applications/{application_id}/history

GET   /api/hr/emails/templates
GET   /api/hr/emails/drafts
GET   /api/hr/emails/audience?stage={stage}&job_id={job_id}
POST  /api/hr/emails/campaigns
POST  /api/hr/emails/drafts/generate
PATCH /api/hr/emails/drafts/{email_id}
POST  /api/hr/emails/drafts/{email_id}/approve
POST  /api/hr/emails/drafts/{email_id}/reopen
POST  /api/hr/emails/drafts/{email_id}/send
POST  /api/hr/emails/bulk-send
GET   /api/hr/emails/threads
GET   /api/hr/emails/threads/{thread_id}
PATCH /api/hr/emails/threads/{thread_id}/read
POST  /api/hr/emails/threads/{thread_id}/smart-reply
POST  /api/hr/emails/threads/smart-reply/batch

POST  /api/webhooks/email/resend
```

Email ứng viên luôn theo luồng `Draft -> Approved -> Sent`. Backend từ chối gửi
Draft chưa được HR duyệt. Khác password-reset fallback, candidate email không
giả lập thành công khi thiếu Resend; record chuyển `Failed`, hiển thị lỗi và cho
Retry chỉ với lỗi tạm thời. Lỗi cấu hình/403 là non-retryable: cấu hình lại
`RESEND_API_KEY` cùng `RESEND_FROM_EMAIL`, rồi `Reopen -> Approve -> Send`.

Auto Email và Smart Reply chỉ áp dụng cho ứng viên thuộc `application` của
company job post, tức `Job Applicants/Pipeline`. Không dùng `application` để gửi
email cho CV từ `Upload CV Batch`.

Auto Email lấy stage hiện tại làm nguồn sự thật và tạo đúng một template dùng
chung cho cả campaign; chỉ các placeholder đã cho phép mới thay đổi theo người
nhận. Nếu Gemini thiếu cấu hình hoặc trả nội dung sai/ngắn, backend dùng template
chuẩn có sẵn. Display name trong header `From` được lấy từ công ty đăng job, còn
mailbox vẫn là địa chỉ thuộc domain đã verify trong `RESEND_FROM_EMAIL`.

Smart Reply là inbound email thật:

```text
Outbound email with per-application Reply-To
  -> candidate replies
  -> verified Resend email.received webhook
  -> FitCV retrieves and sanitizes the plain-text body
  -> sender must match candidate.email
  -> Gemini drafts a reply from trusted application/conversation context
  -> HR edits, approves, and explicitly sends
```

Backend không bao giờ auto-send AI reply. Candidate content là untrusted input
và không được dùng như model instruction. Delivery webhooks được deduplicate
bằng `svix-id`; outbound retry dùng Resend idempotency key.

Cấu hình Smart Reply trong `backend/.env`:

```env
RESEND_API_KEY=<server-side-key>
RESEND_FROM_EMAIL=Recruiting <recruiting@verified-sender-domain>
RESEND_WEBHOOK_SECRET=<whsec-from-resend-webhook>
RESEND_INBOUND_DOMAIN=replies.example.com
RESEND_TIMEOUT_SECONDS=15
RESEND_MAX_RETRIES=2
```

`onboarding@resend.dev` chỉ dùng để test gửi tới đúng email của tài khoản/team
Resend. Muốn gửi cho mọi Job Seeker, phải thêm domain riêng trong Resend, verify
SPF/DKIM, chờ trạng thái `Verified`, rồi đổi `RESEND_FROM_EMAIL` sang mailbox của
domain đó. Không thể verify `gmail.com` hoặc `*.vercel.app`.

Để nhận reply, API key cần quyền `Full access` vì backend phải lấy nội dung email
inbound. Cấu hình MX cho inbound subdomain (hoặc dùng receiving domain do Resend
cấp), rồi đăng ký webhook public
`https://<backend-domain>/api/webhooks/email/resend` cho `email.received` cùng các
delivery event cần theo dõi. `localhost` không nhận webhook nếu không có tunnel.
Copy signing secret vào đúng runtime `RESEND_WEBHOOK_SECRET`; webhook verification
phải dùng raw request body, không parse rồi serialize lại trước khi verify.

Sau mỗi lần đổi key/domain/webhook secret, restart backend local hoặc redeploy
service. Record đã lỗi 403 là non-retryable: trong UI phải đi lại
`Reopen for review -> Approve -> Send` sau khi cấu hình đúng.

## AI Improvement Suggestions

Feature này dùng backend thật tại:

```text
POST /api/match-results/{match_result_id}/improvement-report/generate
GET  /api/match-results/{match_result_id}/improvement-report
```

Feature luôn dùng backend và Gemini thật. Cấu hình trong `backend/.env`:

```env
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
```

Lấy key miễn phí tại Google AI Studio: https://aistudio.google.com/app/apikey. Không đặt `GEMINI_API_KEY` trong frontend `.env.local`, không commit key lên Git.

Luồng backend cần Analyzer hoàn thành trước và trả về `match_result_id` của một CV đã parse thành công cùng JD tương ứng. Sau đó frontend truyền ID này sang màn hình `AI Suggestions`; nút `Regenerate` sẽ gọi Gemini lại.

Backend không tự `create_all()` schema. Nếu database thật thiếu cột, phải migrate bằng SQL trước khi chạy API.

Với database hiện hữu đã chạy migration 002 một phần hoặc đang thiếu bảng `ai_task`, chạy
`database/migrations/004_reconcile_improvement_runtime.sql` bằng MySQL 8 với đúng database đã được chọn.
Migration 004 có thể chạy lại: nó kiểm tra `information_schema`, backfill dữ liệu suggestion cũ rồi mới
siết constraint, và chỉ tạo lại index khi cấu trúc hiện tại chưa đúng. Nếu bảng `ai_task` đã tồn tại
nhưng thiếu/sai cột runtime, migration sẽ dừng rõ ràng thay vì báo thành công giả; đối chiếu preflight
trước khi sửa schema thủ công. Không cần chạy lại migration 002.

Các cột auth quan trọng trong bảng `account`:

- `password_hash`
- `role`
- `auth_provider`
- `reset_token_hash`
- `reset_token_expires_at`

## AI Rebuild CV

Feature giúp Student tạo lại CV thành file PDF chuẩn hóa từ CV đang có. Pipeline
hoàn toàn stateless: backend đọc text từ PDF/DOCX đã upload, gọi Gemini một lần
để trích xuất và làm gọn dữ liệu CV, render HTML bằng Jinja2 rồi tạo PDF và
thumbnail bằng headless Chromium (Playwright). Toàn bộ chạy trong
`TemporaryDirectory`; không ghi file vào `backend/uploads/` và không thay đổi
database.

Endpoint (yêu cầu đăng nhập):

```text
POST /api/cv/rebuild
```

Gửi `multipart/form-data` với field `file` (PDF/DOCX, tối đa 10 MB). Response trả
về `preview_json` (dữ liệu CV đã trích xuất), `pdf_base64` và `thumbnail_base64`.

Cấu hình trong `backend/.env`:

```env
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.1-flash-lite
```

Ngoài ra backend cần headless Chromium cho bước render PDF, xem phần
"Cài đặt headless Chromium dùng cho AI Rebuild CV" trong mục Cài Backend:

```powershell
cd backend
.venv\Scripts\python.exe -m playwright install chromium
```

Lỗi thường gặp:

- `400`: file rỗng, lớn hơn 10 MB hoặc không phải PDF/DOCX hợp lệ.
- `422`: Gemini trả cấu trúc CV sai sau nhiều lần thử; kiểm tra `GEMINI_API_KEY`/`GEMINI_MODEL` và log backend.
- `502`: lỗi gọi Gemini hoặc render PDF; kiểm tra key, quota Gemini và cài đặt Chromium ở trên.
- `502` kèm `NotImplementedError` / `PDF rendering failed` khi chạy trên Windows: uvicorn
  `reload=True` ép `WindowsSelectorEventLoopPolicy`, không hỗ trợ subprocess của
  Playwright. Backend đã tự đặt `WindowsProactorEventLoopPolicy` + `loop="none"`
  trong `backend/app/main.py`; nếu chạy uvicorn bằng lệnh riêng, thêm
  `--loop none` và đặt policy Proactor trước khi `uvicorn.run(...)`.

## Google Sign-In

Google sign-in dùng Google Identity Services:

- Frontend lấy credential từ Google.
- Backend verify credential bằng `GOOGLE_CLIENT_ID`.
- Không gửi email/name tự khai từ frontend lên backend.

Google Cloud Console cần cấu hình Authorized JavaScript origins:

```text
http://localhost:5173
http://127.0.0.1:5173
https://<your-vercel-domain>
https://fit-cv.vercel.app
```

Nếu OAuth consent screen đang ở Testing, thêm email test user vào Google Cloud Console.

Không commit các file secret như:

- `google.json`
- `client_secret_*.json`
- `.env.local`
- `backend/.env`

## Reset Password

Flow hiện tại dùng mã xác minh 6 số:

1. User nhập email ở Forgot password.
2. Backend tạo mã 6 số.
3. Backend lưu hash của mã vào `account.reset_token_hash`.
4. User nhập mã ở màn hình Verify code.
5. Nếu mã đúng và chưa hết hạn, UI mới hiện Set new password.
6. Reset thành công thì backend xóa mã khỏi DB.

Nếu chưa cấu hình email provider, backend in mã trong terminal:

```text
PASSWORD_RESET_CODE for user@example.com: 123456
```

Nếu muốn gửi email thật bằng Resend:

```env
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=FitCV <verified-sender@your-domain.com>
```

Resend cần domain riêng đã verify. Không verify được domain dạng `*.vercel.app`.

## Auth API Chính

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/oauth/google
POST /api/auth/select-role
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/verify-reset-code
POST /api/auth/reset-password
```

Access token sống ngắn và được giữ trong `sessionStorage`. Refresh token chỉ
nằm trong HttpOnly cookie, được xoay sau mỗi lần refresh và không thể đọc từ
JavaScript. Logout thu hồi session phía server; reset password thu hồi toàn bộ
session của tài khoản. Các endpoint auth nhạy cảm dùng rate limit lưu trong
MySQL nên giới hạn vẫn còn hiệu lực sau khi API restart.

## CV & JD Match Analyzer API

```text
POST   /api/cvs
GET    /api/cvs
GET    /api/cvs/{cv_id}
DELETE /api/cvs/{cv_id}
POST   /api/analyzer/matches
GET    /api/analyzer/matches/{match_result_id}
```

## HR CV Ranking

CV Ranking supports two CV sources while preserving one parser and score engine.

### Upload CV Batch

Use this flow for externally sourced CVs. It does not require candidates to
apply through FitCV and it does not require HR to publish a FitCV job first.

```text
POST /api/hr/cv-ranking/parse
GET  /api/hr/cv-ranking/batches
GET  /api/hr/cv-ranking/batches/{batch_id}
PATCH /api/hr/cv-ranking/batches/{batch_id}/selection
GET  /api/hr/cv-ranking/batches/{batch_id}/candidates/{candidate_id}/cv
GET  /api/ai/tasks/{task_id}
```

Send a `multipart/form-data` request with:

- `job_description`: the JD or screening criteria entered by HR, minimum 50 characters.
- `files`: 1-20 PDF/DOCX CV files, maximum 10MB per file.

Processing pipeline:

```text
HR JD + bulk CV files
  -> PDF/DOCX validation
  -> native text extraction or OCR for scanned PDF
  -> preprocessing and structured CV parsing
  -> Gemini evidence extraction when ANALYZER_PROVIDER=gemini
  -> FitCV weighted score engine
  -> ranked list with matched/missing evidence
  -> manual or score-threshold selection by HR
```

### Unified CV/JD scoring contract

Student Analyzer, Upload CV Batch, and Job Applicants now call the same backend
orchestrator: `backend/app/services/match_engine.py`.

- Framework version: `fitcv-source-grounded-v2`.
- Weights: Skills 45%, Experience 30%, Education 15%, Soft skills 10%.
- Missing JD categories are excluded and the remaining weights are normalized.
- Gemini performs evidence extraction only. Pydantic validation, local
  parser supplementation, and deterministic weighted aggregation remain in
  FitCV.
- The same local parser facts are merged into both semantic CV and semantic JD
  data so an LLM omission does not silently remove verified source evidence.
- `match_result.evidence_json` records `matching_inputs`, engine metadata,
  rubric, eligibility state, strengths, weaknesses, and category evidence.
- Improvement Suggestions use that completed `match_result` and do not run a
  separate scoring formula.

For a published job, only Title, About the job, Responsibilities, and
Requirements form the scoring document. We Offer, benefits, Life at company,
Hiring Process, location, employment type, deadline, and openings count are
kept for display/workflow but do not affect candidate fit.

Existing successful `match_result` rows keep their historical score. Use
Re-analyze/Retry Analysis to recompute them with `fitcv-source-grounded-v2`;
the retry path updates the stored algorithm/model version before processing.

The source-grounding, explicit-gap, eligibility-gate, and shared-rubric ideas
were adapted from the public
[AI Job Search evaluation workflow](https://github.com/MadsLorentzen/ai-job-search/blob/master/.claude/skills/job-application-assistant/04-job-evaluation.md).
FitCV keeps its own four evidence categories because it does not currently have
verified behavioral-interview or career-goal profile data. Source documents are
untrusted input and are never treated as model instructions.

`POST /parse` returns `202 Accepted` after files and the screening batch have
been persisted. The worker parses and scores each CV; the frontend polls the
batch detail until it reaches `Completed`, `Partial`, or `Failed`. Search,
status/date/min-score filters, ranked results, manual selection and confirmed
shortlist survive page reload. Every read/write is scoped by `company_id`.

External screening batches remain separate from `application`: they represent
CVs collected outside FitCV, while `application` is reserved for a Student who
applied to a published FitCV job.

### Job Applicants

Use this flow for CVs submitted by Students to an existing company job post.

```text
GET /api/jobs/manage
GET /api/hr/cv-ranking/jobs/{job_id}/applications
GET /api/hr/cv-ranking/jobs/{job_id}/cvs/archive
GET /api/applications/{application_id}/cv/download
POST /api/applications/{application_id}/retry-analysis
```

```text
job
  -> application
  -> candidate + cv
  -> cv_parse_result + jd_parse_result
  -> match_result
  -> ranked applicant list
```

The backend checks the manager account's `company_id` before returning a job or
its applications. Existing parse and match records are reused. Both tabs support
side-by-side raw CV and parsed-score review, manual selection, and score-threshold
selection. Job Applicants can download one CV or a ZIP containing all available
CVs for the selected job. Neither flow automatically accepts or rejects an
applicant. Selection remains local to the current screen until the team adds an
agreed shortlist or screening-session schema.

- Upload chỉ nhận PDF/DOCX tối đa 10 MB; backend xác minh nội dung file trước khi lưu.
- CV parsing và matching chạy bằng FastAPI background tasks. Frontend poll trạng thái `Pending`, `Processing`, `Success`, `Failed`.
- MVP matcher dùng evidence có thể kiểm tra lại: Skills 45%, Experience 30%, Education 15%, Soft skills 10%. Nếu JD thiếu category, trọng số được phân bổ lại trên các category còn lại.
- `ANALYZER_PROVIDER=deterministic` là mặc định và không gọi dịch vụ AI bên ngoài.
- Để Gemini đọc CV/JD và trích xuất keyword, đặt `ANALYZER_PROVIDER=gemini`, `GEMINI_API_KEY=<server-side-key>`, `GEMINI_MODEL=gemini-3.6-flash`, và `GEMINI_THINKING_LEVEL=high` trong `backend/.env`, sau đó restart backend.
- Gemini chỉ làm bước semantic extraction; FitCV che các contact field phổ biến trong text CV/JD, gửi PDF/DOCX gốc cho bước CV parsing, yêu cầu quote bằng chứng có thật trong source, validate structured output bằng Pydantic, rồi mới tính score bằng trọng số cố định.
- Không đặt `GEMINI_API_KEY` trong `.env.local`, biến `VITE_*`, frontend source, hoặc Git.
- Pass probability là heuristic hỗ trợ quyết định, không phải dữ liệu tuyển dụng lịch sử và không tự động accept/reject ứng viên.
- PDF dạng scan chưa có OCR; cần chuyển thành PDF có text hoặc DOCX trước khi upload.
- Database hiện hữu cần chạy `database/migrations/003_add_cv_jd_analyzer.sql` trước khi bật API này.

### Bật Gemini 3.6 Flash với high thinking cho Analyzer

1. Mở [Google AI Studio](https://aistudio.google.com/app/apikey), đăng nhập và tạo Gemini API key.
2. Mở `backend/.env` và đặt cấu hình sau. API key chỉ được lưu ở backend:

```env
ANALYZER_PROVIDER=gemini
GEMINI_API_KEY=<your-secret-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
GEMINI_TIMEOUT_SECONDS=90
GEMINI_MAX_RETRIES=2
```

3. Mở `.env.local` ở thư mục root và bảo đảm frontend gọi backend thật:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

4. Chạy migration `database/migrations/003_add_cv_jd_analyzer.sql` trên database FitCV hiện hữu. Nếu tạo database mới từ `database/full_schema.sql` thì không cần chạy lại migration này.
5. Restart cả backend (`python app/main.py`) và frontend (`npm run dev`) vì biến môi trường chỉ được đọc khi process khởi động.
6. Đăng nhập bằng Student, vào **CV & JD Match Analyzer**, upload CV PDF/DOCX, paste JD tối thiểu 50 ký tự, rồi bấm **Analyze match**.

Pipeline thật là: FitCV lấy text từ PDF/DOCX ở backend → gửi file CV gốc cùng text phụ trợ vào Gemini GenerateContent với JSON Schema và `thinkingLevel=high` → Gemini trích xuất kỹ năng, kinh nghiệm, học vấn, soft skills và quote nguồn → FitCV validate đúng schema, loại evidence không xuất hiện trong source rồi tự tính điểm bằng trọng số cố định. Với bước match text CV/JD, FitCV che email, phone, URL, contact fields và name header phổ biến trước khi gọi Gemini. File binary, API key và quyết định tuyển dụng không được gửi ra frontend.

`gemini-3.6-flash` là model mặc định cho Analyzer, AI Improvement và OCR. `GEMINI_THINKING_LEVEL=high` ưu tiên độ sâu suy luận khi đọc CV phức tạp, nên timeout mặc định được tăng lên 90 giây (OCR: 120 giây). Backend gửi API key bằng header `x-goog-api-key`, không đặt key trong URL, rồi vẫn validate kết quả bằng Pydantic trước khi chấm điểm. Output sai schema hoặc evidence không có trong source sẽ fail an toàn. Redaction là best-effort, không thay thế consent và privacy policy; khi test nên dùng CV giả hoặc đã ẩn danh.

Analyzer luôn gọi backend thật; không còn nhánh fixture hoặc kết quả hard-code ở frontend.

Lỗi thường gặp:

- `400`: model/schema/request không hợp lệ; kiểm tra `GEMINI_MODEL` và log backend.
- `401`/`403`: Gemini key sai, bị thu hồi, hoặc project chưa có quyền gọi API.
- `429`: project đã chạm quota/rate limit; chờ retry hoặc kiểm tra quota trong Google AI Studio.
- `503` kèm `GEMINI_API_KEY is required`: backend chưa đọc đúng `backend/.env`, hoặc chưa restart.
- `Analyzer backend is not configured`: thêm `VITE_API_BASE_URL` vào `.env.local` rồi restart Vite.
- Không commit hoặc gửi `GEMINI_API_KEY` vào chat, Git, frontend source, `.env.local`, hay bất kỳ biến `VITE_*` nào.

Role hợp lệ theo database:

```text
Student
HR
HiringManager
Admin
```

Frontend portal map:

- `Student` -> Job Seeker portal
- `HR`, `HiringManager`, `Admin` -> HR portal

## Lệnh Kiểm Tra

Frontend build:

```bash
npm run build
```

Format:

```bash
npm run format
```

Backend import check:

```bash
cd backend
python -c "from app.main import app; print('BACKEND_IMPORT_OK')"
```

Backend tests:

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests -q
```

Railway + Gemini E2E (chỉ chạy sau khi rotate credential và áp dụng migration 004):

```powershell
cd backend
$env:FITCV_RUN_RAILWAY_E2E="1"
python -m pytest tests/test_live_analyzer_improvement.py -q -s
Remove-Item Env:FITCV_RUN_RAILWAY_E2E
```

Test này tạo Student/CV/JD tổng hợp, chạy Analyzer → AI Improvement bằng cùng
`match_result_id`, rồi xóa account, dữ liệu AI và file upload trong bước cleanup. Không bật
biến này trong CI thường xuyên vì test sử dụng database và quota Gemini thật.

TypeScript check:

```bash
npx tsc --noEmit
```

## OCR Cho PDF Scan

Backend doc text truc tiep bang `pypdf` truoc. Neu PDF khong co text layer,
backend tu dong gui PDF den Gemini Document OCR, sau do tiep tuc parse JSON va
cham diem bang cung workflow Analyzer/CV Ranking.

Them cac bien sau vao `backend/.env` khi test local va Render Environment khi deploy:

```env
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-3.6-flash
GEMINI_THINKING_LEVEL=high
OCR_PROVIDER=gemini
OCR_MODEL=
OCR_TIMEOUT_SECONDS=120
OCR_MAX_OUTPUT_TOKENS=20000
```

- De trong `OCR_MODEL` de OCR dung chung `GEMINI_MODEL`.
- Dat `OCR_PROVIDER=disabled` neu khong muon gui PDF scan den Gemini.
- PDF native text khong goi OCR, do do nhanh hon va khong ton request Gemini.
- PDF scan chua thong tin ca nhan se duoc gui den Gemini de nhan dang text.
- Application bi fail co the chay lai bang nut `Retry OCR` trong Application Tracker.
- `OCR service is unavailable after retries`: kiem tra ket noi HTTPS/DNS/SSL/proxy
  cua backend toi `generativelanguage.googleapis.com`, sau do retry. Backend log
  se ghi loai loi ket noi va tu dong retry theo `GEMINI_MAX_RETRIES`.

Frontend tests:

```bash
npm test
```

## Application Tracker

Application Tracker dùng backend thật và chỉ cho tài khoản có role `Student`. Mỗi tài khoản chỉ có thể đọc hoặc thay đổi application, note và status history thuộc chính mình.

API chính:

```text
POST   /api/applications
GET    /api/applications
GET    /api/applications/stats
GET    /api/applications/{application_id}
PATCH  /api/applications/{application_id}
DELETE /api/applications/{application_id}
POST   /api/applications/{application_id}/notes
PATCH  /api/applications/{application_id}/notes/{note_id}
DELETE /api/applications/{application_id}/notes/{note_id}
```

Trạng thái hợp lệ là `Applied`, `Screening`, `Interview`, `Offer`, `Rejected`. Mỗi lần đổi trạng thái được lưu vào history. Reminder được xem là đến hạn khi ngày người dùng đặt đã qua; nếu không đặt ngày riêng, application ở `Applied`, `Screening`, hoặc `Interview` sẽ được cảnh báo sau 30 ngày không có cập nhật. `Offer` và `Rejected` không tạo cảnh báo stale.

Database hiện hữu phải chạy migration sau trước khi dùng feature:

```text
database/migrations/004_add_application_tracker.sql
database/migrations/008_add_application_notifications.sql
```

Lỗi thường gặp:

- `400`: model/schema/request không hợp lệ; kiểm tra `GEMINI_MODEL` và log backend.
- `401`/`403`: Gemini key sai, bị thu hồi, hoặc project chưa có quyền gọi API.
- `429`: project đã chạm quota/rate limit; chờ retry hoặc kiểm tra quota trong Google AI Studio.
- `503` kèm `GEMINI_API_KEY is required`: backend chưa đọc đúng `backend/.env`, hoặc chưa restart.
- `Analyzer backend is not configured`: thêm `VITE_API_BASE_URL` vào `.env.local` rồi restart Vite.
- Không commit hoặc gửi `GEMINI_API_KEY` vào chat, Git, frontend source, `.env.local`, hay bất kỳ biến `VITE_*` nào.

Role hợp lệ theo database:

```text
Student
HR
HiringManager
Admin
```

Frontend portal map:

- `Student` -> Job Seeker portal
- `HR`, `HiringManager`, `Admin` -> HR portal

## Troubleshooting

Google OAuth lỗi `invalid_request`:

- Kiểm tra URL thật trên thanh địa chỉ.
- URL phải nằm trong Authorized JavaScript origins.
- Dùng Chrome/Edge thật, không dùng browser nhúng trong IDE.
- Với local, dùng `localhost` hoặc `127.0.0.1`.

Backend trả lỗi `Google auth dependency is not installed.`:

- Kiểm tra `backend/requirements.txt` có `google-auth>=2.29.0,<3.0.0`.
- Commit và push `backend/requirements.txt`.
- Trên Render, chạy Manual Deploy / Clear build cache and deploy để Render cài lại dependency.
- Kiểm tra Render env có `GOOGLE_CLIENT_ID`.
- Nếu vẫn lỗi, vào Render Shell và chạy:

```bash
python -c "import google.auth; print('GOOGLE_AUTH_INSTALLED')"
```

Reset code đúng nhưng verify lỗi:

- Restart backend sau khi pull code mới.
- Bấm gửi mã mới.
- Kiểm tra terminal backend có `PASSWORD_RESET_CODE`.
- Mã hết hạn theo `RESET_TOKEN_EXPIRE_MINUTES` / `reset_token_expire_minutes`.

Backend không connect DB:

- Kiểm tra `backend/.env`.
- Password trong `DATABASE_URL` phải URL-encode ký tự đặc biệt, ví dụ `!` thành `%21`.
- MySQL user runtime cần quyền đọc/ghi trên database `fitcv`.

## Prompt Mẫu Cho AI

```text
Read AGENTS.md and README.md first. Inspect the existing files in the target layer before coding.
Keep frontend code in src/app, src/ui, src/api, src/services, src/data, and src/types.
Keep backend code in backend/app/api, core, db, models, repositories, schemas, services, and middleware.
Do not create member-specific production folders.
For auth, preserve 4 roles and the 6-digit reset-code flow.
Do not overwrite unrelated work.
```
