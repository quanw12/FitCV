# FitCV — hướng dẫn cho AI agent

## KHÔNG chạy `npm run format`

`package.json` có script `"format": "oxfmt"` (oxfmt `^0.2.0`). **Đừng chạy nó.**
Bản này có bug làm bẩn và làm hỏng code trên toàn repo:

1. **Chèn dòng trắng vô nghĩa** vào giữa gần như mọi câu lệnh liền nhau và mọi
   member của `interface` / `type`. Kết quả là hàng loạt file có diff kiểu
   `+30/-0` mà không sửa một ký tự code nào:

   ```diff
    export interface ReportWindow {
      from: string
   +
      to: string
   +
      label: string
    }
   ```

2. **Làm hỏng build.** Khi gộp object type literal về một dòng, nó nuốt luôn dấu
   `;` phân tách, sinh ra thứ TypeScript không parse được (TS1005):

   ```ts
   // đúng
   function MiniBars({ values, color }: { values: number[]; color: string }) {}
   // sau khi oxfmt chạy — mất dấu ;
   function MiniBars({ values, color }: { values: number[] color: string }) {}
   ```

3. Bung import list ngắn ra nhiều dòng và bẻ dòng JSX rất mạnh tay, tạo diff
   nhiễu che mất thay đổi thật.

Một lần chạy đã làm bẩn ~107 file. Dọn lại rất tốn công vì phải phân loại từng
file xem là noise định dạng hay code thật.

Chỉ mở lại script này khi đã nâng oxfmt lên bản sửa được cả 3 lỗi trên, hoặc đổi
sang Prettier. Lưu ý dải `^0.2.0` cho phép npm cài bản 0.2.x mới hơn, nên bug có
thể vẫn còn sau `npm install` — kiểm tra trước khi tin.

Cần format thì chỉnh tay theo convention bên dưới, phạm vi đúng file đang sửa.

## Convention định dạng của repo

Đối chiếu `src/types/reports.ts` và `src/ui/screens/HRDashboard.tsx` làm chuẩn:

- Member của `interface` / `type` viết liền nhau, **không** có dòng trắng ở giữa.
- Các `const` khai báo ở module scope viết liền thành khối.
- Dòng trắng chỉ dùng để tách các block nhiều dòng, hoặc đứng trước comment.
- Comment nằm **sát ngay trên** khai báo mà nó mô tả, không chừa dòng trắng.
- Repo rất ít comment. Chỉ thư mục `src/ui/components/landing` dùng block
  comment `/* ... */` ở top level.

## Lệnh

| Việc | Lệnh |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Test | `npx vitest run` |
| Typecheck | `npx tsc --noEmit` |

**Không có script `typecheck`** — gọi `npx tsc --noEmit` trực tiếp.

`tsc --noEmit` có sẵn **đúng 5 lỗi TS6133** (biến khai báo không dùng) tồn tại từ
trước ở `CVReBuildScreen.tsx` (dòng 5, 11, 12, 109) và `JobSearchScreen.tsx`
(dòng 119). Đó là baseline — nhiều hơn 5 nghĩa là thay đổi của bạn gây ra lỗi mới.

## Git trên Windows

Repo này chạy `core.autocrlf=true`. Index stat cache của git có thể bị cũ và làm
`git status` **báo thiếu file đã sửa** — từng có lần `git status --short` báo 29
file trong khi thực tế 79 file bẩn.

Đừng tin `git status` một mình khi cần biết chắc trạng thái working tree. Kiểm
chứng bằng:

```bash
git -c core.safecrlf=false diff --numstat     # diff thật, có số dòng
git diff --cached --name-only                 # rỗng = không có gì đã stage
```

Muốn refresh cache thì chạy `git checkout --` lên đúng các path đang nghi.

## Ghi chú

- `dist/` và `output/ui-design/prototype/` **được track** trong git. Mỗi lần
  build là `dist/index.html` đổi hash asset — đó là output bình thường, không
  phải thay đổi code.
- `src/ui/screens/auth.css` hiện **mồ côi**, chưa file nào import.
