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

```bash
cp .env.example .env.local
```

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

Frontend production currently falls back to this backend URL if `VITE_API_BASE_URL` is not set:

```text
https://fitcv-0cab.onrender.com
```

Still set `VITE_API_BASE_URL` explicitly in Vercel so future backend URL changes do not require code changes.

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

Tạo hoặc cập nhật `backend/.env`:

```bash
cp .env.example .env
```

```env
DATABASE_URL=mysql+pymysql://<db_user>:<url_encoded_password>@<db_host>:3306/fitcv
JWT_SECRET_KEY=<local-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
RESEND_API_KEY=
RESEND_FROM_EMAIL=
AVATAR_STORAGE=local
BACKEND_PUBLIC_URL=http://127.0.0.1:8000
ANALYZER_PROVIDER=deterministic
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.5-flash
```

Avatar nhận JPG, PNG và WebP tối đa 5 MB. `AVATAR_STORAGE=local` lưu file trong
`backend/uploads/avatars` (đã được Git ignore) và chỉ phù hợp cho phát triển local.
Trên Render, dùng Cloudinary vì ổ đĩa local là tạm thời:

```env
AVATAR_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
BACKEND_PUBLIC_URL=https://<your-backend>.onrender.com
```

Không commit secret Cloudinary. Nếu chọn `cloudinary` nhưng thiếu cấu hình,
backend sẽ báo lỗi rõ ràng thay vì âm thầm lưu vào ổ đĩa tạm thời.

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

## Database

Schema chính nằm ở:

```text
database/full_schema.sql
```

Nếu tạo database mới:

1. Tạo database `fitcv`.
2. Chạy toàn bộ `database/full_schema.sql` bằng MySQL user có quyền tạo bảng/index.
3. Backend runtime user cần quyền `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

### Job Post Management

Job Post Management requires no database migration or schema changes. Its
separate form/detail sections are versioned and serialized into the existing
`job.description` LONGTEXT column; `job.requirements` remains a normal column.
Active jobs are served to authenticated Student accounts under
`GET /api/jobs/public` and `GET /api/jobs/public/{id}`. Authenticated HR,
HiringManager, and Admin accounts use the company-scoped manage, create,
update, publish, and close endpoints under `/api/jobs`.

## AI Improvement Suggestions

Feature này dùng backend thật tại:

```text
POST /api/match-results/{match_result_id}/improvement-report/generate
GET  /api/match-results/{match_result_id}/improvement-report
```

Feature luôn dùng backend và Gemini thật. Cấu hình trong `backend/.env`:

```env
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.5-flash
```

Lấy key miễn phí tại Google AI Studio: https://aistudio.google.com/app/apikey. Không đặt `GEMINI_API_KEY` trong frontend `.env.local`, không commit key lên Git.

Luồng backend cần Analyzer hoàn thành trước và trả về `match_result_id` của một CV đã parse thành công cùng JD tương ứng. Sau đó frontend truyền ID này sang màn hình `AI Suggestions`; nút `Regenerate` sẽ gọi Gemini lại.

Backend không tự `create_all()` schema. Nếu database thật thiếu cột, phải migrate bằng SQL trước khi chạy API.

Các cột auth quan trọng trong bảng `account`:

- `password_hash`
- `role`
- `auth_provider`
- `reset_token_hash`
- `reset_token_expires_at`

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
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/verify-reset-code
POST /api/auth/reset-password
```

## CV & JD Match Analyzer API

```text
POST   /api/cvs
GET    /api/cvs
GET    /api/cvs/{cv_id}
DELETE /api/cvs/{cv_id}
POST   /api/analyzer/matches
GET    /api/analyzer/matches/{match_result_id}
```

- Upload chỉ nhận PDF/DOCX tối đa 10 MB; backend xác minh nội dung file trước khi lưu.
- CV parsing và matching chạy bằng FastAPI background tasks. Frontend poll trạng thái `Pending`, `Processing`, `Success`, `Failed`.
- MVP matcher dùng evidence có thể kiểm tra lại: Skills 45%, Experience 30%, Education 15%, Soft skills 10%. Nếu JD thiếu category, trọng số được phân bổ lại trên các category còn lại.
- `ANALYZER_PROVIDER=deterministic` là mặc định và không gọi dịch vụ AI bên ngoài.
- Để Gemini đọc text CV/JD và trích xuất keyword, đặt `ANALYZER_PROVIDER=gemini`, `GEMINI_API_KEY=<server-side-key>`, và `GEMINI_MODEL=gemini-3.5-flash` trong `backend/.env`, sau đó restart backend.
- Gemini chỉ làm bước semantic extraction; FitCV che các contact field phổ biến, yêu cầu quote bằng chứng có thật trong source, validate structured output bằng Pydantic, rồi mới tính score bằng trọng số cố định. PDF/DOCX binary không được gửi lên Gemini.
- Không đặt `GEMINI_API_KEY` trong `.env.local`, biến `VITE_*`, frontend source, hoặc Git.
- Pass probability là heuristic hỗ trợ quyết định, không phải dữ liệu tuyển dụng lịch sử và không tự động accept/reject ứng viên.
- PDF dạng scan chưa có OCR; cần chuyển thành PDF có text hoặc DOCX trước khi upload.
- Database hiện hữu cần chạy `database/migrations/003_add_cv_jd_analyzer.sql` trước khi bật API này.

### Bật Gemini 3.5 Flash cho Analyzer

1. Mở [Google AI Studio](https://aistudio.google.com/app/apikey), đăng nhập và tạo Gemini API key.
2. Mở `backend/.env` và đặt cấu hình sau. API key chỉ được lưu ở backend:

```env
ANALYZER_PROVIDER=gemini
GEMINI_API_KEY=<your-secret-key>
GEMINI_MODEL=gemini-3.5-flash
GEMINI_TIMEOUT_SECONDS=30
GEMINI_MAX_RETRIES=2
```

3. Mở `.env.local` ở thư mục root và bảo đảm frontend gọi backend thật:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

4. Chạy migration `database/migrations/003_add_cv_jd_analyzer.sql` trên database FitCV hiện hữu. Nếu tạo database mới từ `database/full_schema.sql` thì không cần chạy lại migration này.
5. Restart cả backend (`python app/main.py`) và frontend (`npm run dev`) vì biến môi trường chỉ được đọc khi process khởi động.
6. Đăng nhập bằng Student, vào **CV & JD Match Analyzer**, upload CV PDF/DOCX, paste JD tối thiểu 50 ký tự, rồi bấm **Analyze match**.

Pipeline thật là: FitCV lấy text từ PDF/DOCX ở backend → che email, phone, URL, contact fields và name header phổ biến → gọi Gemini GenerateContent với JSON Schema → Gemini trích xuất kỹ năng, kinh nghiệm, học vấn, soft skills và quote nguồn → FitCV validate đúng schema, loại evidence không xuất hiện trong source rồi tự tính điểm bằng trọng số cố định. File binary, API key và quyết định tuyển dụng không được gửi ra frontend.

`gemini-3.5-flash` hỗ trợ structured output. Backend gửi API key bằng header `x-goog-api-key`, không đặt key trong URL, rồi vẫn validate kết quả bằng Pydantic trước khi chấm điểm. Output sai schema hoặc evidence không có trong source sẽ fail an toàn. Redaction là best-effort, không thay thế consent và privacy policy; khi test nên dùng CV giả hoặc đã ẩn danh.

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

Backend analyzer tests:

```bash
cd backend
python -m unittest discover -s tests -v
```

TypeScript check:

```bash
npx tsc --noEmit
```

## Troubleshooting

Google OAuth lỗi `invalid_request`:

- Kiểm tra URL thật trên thanh địa chỉ.
- URL phải nằm trong Authorized JavaScript origins.
- Dùng Chrome/Edge thật, không dùng browser nhúng trong IDE.
- Với local, dùng `localhost` hoặc `127.0.0.1`.

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
