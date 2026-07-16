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

```env
DATABASE_URL=mysql+pymysql://<db_user>:<url_encoded_password>@<db_host>:3306/fitcv
JWT_SECRET_KEY=<local-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
RESEND_API_KEY=
RESEND_FROM_EMAIL=
AVATAR_STORAGE=local
BACKEND_PUBLIC_URL=http://127.0.0.1:8000
```

Avatar uploads accept JPG, PNG, and WebP images up to 5MB. With `AVATAR_STORAGE=local`, files are stored in the ignored `backend/uploads/avatars` directory and served at `/uploads`; this is intended for local development. `BACKEND_PUBLIC_URL` is optional, but should be set to the externally reachable backend origin when proxy headers do not reflect the public URL.

## Cấu Hình Cloudinary Cho Avatar Trên Render (Bắt Buộc)

Ổ đĩa cục bộ của Render là tạm thời (ephemeral), nên avatar lưu trên đó có thể mất khi service khởi động lại, redeploy hoặc chuyển instance. Vì vậy, môi trường Render bắt buộc dùng Cloudinary. Cấu hình `AVATAR_STORAGE=local` ở trên chỉ dành cho phát triển local.

1. Đăng nhập Cloudinary Dashboard và mở **Dashboard / Product Environment Credentials**.
2. Sao chép **Cloud name**, **API key** và **API secret**.
3. Trong Render Dashboard, chọn backend service, mở **Environment** và thêm chính xác các biến sau bằng thông tin Cloudinary của bạn:

```env
AVATAR_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
BACKEND_PUBLIC_URL=https://<your-backend>.onrender.com
```

4. Bấm **Save Changes**, sau đó redeploy backend để cấu hình mới có hiệu lực.

Không ghi giá trị secret thật vào README, Git, frontend hoặc `backend/.env.example`. Nếu chọn `AVATAR_STORAGE=cloudinary` nhưng thiếu một trong ba thông tin Cloudinary, upload avatar sẽ báo lỗi cấu hình và không tự chuyển sang ổ đĩa tạm thời của Render.

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
http://127.0.0.1:8000/api/health/database
```

Endpoint `/api/health/database` thực hiện `SELECT 1`. Nếu trả `503`, kiểm tra MySQL, firewall và kết nối Tailscale trước khi kiểm tra Auth hoặc Profile.

## Database

Schema chính nằm ở:

```text
database/full_schema.sql
```

Profile chỉ dùng các bảng `account`, `candidate`, `company`, và `industry` đã có trong `database/full_schema.sql`. Tính năng này không cần migration riêng hoặc bảng mới.

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

## Profile API

Các endpoint dưới đây yêu cầu access token trong header `Authorization: Bearer <token>`:

```text
GET   /api/profile
PATCH /api/profile
POST  /api/profile/avatar
DELETE /api/profile/avatar
```

Mọi role có thể cập nhật `account.full_name` và avatar qua upload flow. `Student` có thể cập nhật thêm `candidate.phone` qua candidate liên kết bằng `candidate.account_id`. `HR`, `HiringManager`, và `Admin` có thể cập nhật thông tin công ty và ngành nghề qua các bảng `company` và `industry` hiện có.

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
