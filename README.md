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

Tạo hoặc cập nhật `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://<db_user>:<url_encoded_password>@<db_host>:3306/fitcv
JWT_SECRET_KEY=<local-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","https://fit-cv.vercel.app"]
RESEND_API_KEY=
RESEND_FROM_EMAIL=
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
GOOGLE_CLIENT_ID=<google-oauth-client-id>
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","https://fit-cv.vercel.app"]
RESEND_API_KEY=
RESEND_FROM_EMAIL=
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
GEMINI_MODEL=gemini-3.5-flash
OCR_PROVIDER=gemini
OCR_MODEL=
OCR_TIMEOUT_SECONDS=60
OCR_MAX_OUTPUT_TOKENS=20000
```

- De trong `OCR_MODEL` de OCR dung chung `GEMINI_MODEL`.
- Dat `OCR_PROVIDER=disabled` neu khong muon gui PDF scan den Gemini.
- PDF native text khong goi OCR, do do nhanh hon va khong ton request Gemini.
- PDF scan chua thong tin ca nhan se duoc gui den Gemini de nhan dang text.
- Application bi fail co the chay lai bang nut `Retry OCR` trong Application Tracker.

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
