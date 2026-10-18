# 05 · Cài môi trường lập trình trên máy của bạn

| Mục | Nội dung |
| --- | --- |
| Ngày | 18/10/2026 |
| Giai đoạn | Giữa giai đoạn 1 và 2: chạy, test, debug web + backend ngay trên máy cá nhân, **chưa cần Ubuntu / mini PC** |
| Đã làm | MySQL lập trình bằng Docker Desktop (`backend/docker-compose.yml`), file mẫu `backend/.env.example`, test tự đọc cấu hình từ `backend/.env`, log dễ đọc khi lập trình, cấu hình debug VS Code, web gọi được backend trên máy (`DEV_API_PROXY`), giữ xuống dòng kiểu LF trên Windows (`.gitattributes`) |
| Kết quả kiểm tra | Clone repo vào thư mục trống rồi làm đúng theo hướng dẫn: cài thư viện, bật MySQL, `npm test` 44/44, backend chạy bằng đúng lệnh debug của VS Code, web gọi backend qua proxy (trình duyệt thật 4/4), web không có backend vẫn chạy như cũ, typecheck / lint / prettier / build sạch |
| Việc tiếp theo | Giai đoạn 2: tài khoản |

Làm lần lượt từ trên xuống. Hướng dẫn viết cho **Windows 10/11**; chỗ nào khác trên macOS có ghi chú.

## 1. Cài phần mềm (một lần)

| Phần mềm | Tải ở đâu | Ghi chú |
| --- | --- | --- |
| **Git** | https://git-scm.com/download/win | Cứ bấm Next, giữ mặc định |
| **Node.js 22 LTS** | https://nodejs.org (chọn bản **22.x LTS**) | Cần bản 22.12 trở lên. Giữ mặc định |
| **Docker Desktop** | https://www.docker.com/products/docker-desktop | Chỉ để chạy MySQL. Lúc cài để tích **Use WSL 2**. Cài xong khởi động lại máy, mở Docker Desktop một lần cho nó chạy |
| **VS Code** | https://code.visualstudio.com | Trình soạn code + debug |
| Chrome hoặc Edge | (Windows đã có Edge) | Để debug web |

Mở **PowerShell** (bấm Start, gõ PowerShell) và kiểm tra:

```powershell
git --version
node -v            # phải là v22.12 trở lên
docker version     # có cả phần "Server" là Docker Desktop đang chạy
```

> **Windows báo "running scripts is disabled" khi gõ `npm`?** Chạy lệnh này một lần rồi mở lại PowerShell:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

macOS: cài Git (`xcode-select --install`), Node 22 LTS, Docker Desktop, VS Code như trên; lệnh gõ trong Terminal.

## 2. Lấy code về máy

Nên để ở đường dẫn ngắn, không dấu, không nằm trong OneDrive, VD `C:\code`:

```powershell
mkdir C:\code
cd C:\code
git clone https://github.com/PochiVanilla/BakuganStore.git
cd BakuganStore
npm install                 # thư viện của web
cd backend
npm install                 # thư viện của backend
cd ..
code .                      # mở bằng VS Code
```

Lần đầu mở, VS Code hỏi cài các tiện ích gợi ý (ESLint, Prettier, Tailwind, Vitest, Docker): chọn **Install**.

## 3. Chạy web (giống bản trên Vercel)

```powershell
npm run dev
```

Mở http://localhost:3000. Web chạy dữ liệu giả lập ngay trong trình duyệt, đăng nhập bằng nút
"Điền tài khoản quản trị demo" như trước. Sửa code trong `src/` là trang tự cập nhật.

**Muốn thử trợ lý AI thật (Gemini)**:

1. Chép `.env.example` thành `.env.local`: `Copy-Item .env.example .env.local` (macOS: `cp .env.example .env.local`).
2. Mở `.env.local`, điền `GEMINI_API_KEY=` (lấy khoá ở https://aistudio.google.com/apikey).
3. Tắt `npm run dev` (Ctrl+C) rồi chạy lại.

## 4. Chạy backend + MySQL

Mở một cửa sổ PowerShell **thứ hai** (để `npm run dev` của web vẫn chạy ở cửa sổ đầu):

```powershell
cd C:\code\BakuganStore\backend
Copy-Item .env.example .env       # macOS: cp .env.example .env
notepad .env
```

Trong `.env` điền **hai mật khẩu tự đặt** (chỉ dùng trên máy bạn), ví dụ:

```
DB_PASSWORD=mat-khau-cua-ban-1
DB_ROOT_PASSWORD=mat-khau-cua-ban-2
```

> Đặt rồi thì đừng đổi: MySQL ghi nhớ mật khẩu từ lần bật đầu tiên. Muốn đổi thì xoá dữ liệu lập
> trình bằng `docker compose down -v` rồi bật lại.

Bật MySQL (Docker Desktop phải đang mở), rồi chạy backend:

```powershell
docker compose up -d       # lần đầu tải MySQL 8.4 về, mất vài phút
npm run dev
```

Thấy dòng `TD Bakugan API đang chạy` là được. Mở http://localhost:4000/api/health, phải thấy
`{"data":{"status":"ok","database":"ok",…}}`. Lần đầu chạy, backend tự tạo đủ bảng, cài đặt, 3 mã giảm giá,
6 bài blog. Sửa code trong `backend/src/` thì backend tự khởi động lại.

## 5. Cho web gọi backend trên máy

Giống trên mini PC (Caddy chuyển `/api` vào backend), trên máy lập trình Vite làm việc đó:

1. Trong `.env.local` (thư mục gốc), bỏ dấu `#` ở dòng `# DEV_API_PROXY=http://localhost:4000`.
2. Chạy lại `npm run dev` của web.

Giờ mọi `/api/...` của web đi vào backend ở cổng 4000. Thử: đăng nhập admin demo → **Cài đặt** → **Trợ lý AI** →
**Kiểm tra kết nối**. Cửa sổ backend hiện dòng log `/api/chat-bot`. Khoá Gemini lúc này đọc từ `backend/.env`.

Bỏ dòng `DEV_API_PROXY` (thêm lại `#`) là web quay về chạy một mình như mục 3, không cần backend.

> Đăng nhập, feed, đơn hàng… vẫn là dữ liệu giả lập trong trình duyệt. Backend sẽ nhận dần các phần đó
> từ giai đoạn 2 trở đi.

## 6. Chạy test và kiểm tra code

```powershell
cd C:\code\BakuganStore\backend
npm test               # 44 test, chạy trên MySQL lập trình (tự tạo rồi xoá CSDL tdbakugan_test)
npm run check          # kiểm tra kiểu, lint, định dạng, luật dùng chung code với web

cd ..
npm run typecheck      # web
npm run lint
npm run build
```

Test không làm hỏng dữ liệu lập trình: nó dùng một CSDL riêng tên `tdbakugan_test`, chạy xong là xoá.
Quên bật MySQL thì test báo rõ: "Không kết nối được MySQL… (trong backend/: docker compose up -d)".

Trong VS Code còn có bảng **Testing** (biểu tượng bình thí nghiệm ở thanh bên trái, của tiện ích Vitest):
bấm ▶ cạnh từng test để chạy riêng test đó.

## 7. Debug trong VS Code

Mở tab **Run and Debug** (Ctrl+Shift+D), chọn cấu hình ở ô trên cùng rồi bấm **F5**:

| Cấu hình | Dùng khi |
| --- | --- |
| Backend: chạy + debug (cổng 4000) | Dừng lại ở dòng code backend để xem biến. Tắt `npm run dev` của backend trước (trùng cổng 4000) |
| Backend: debug file test đang mở | Mở một file trong `backend/test/` rồi bấm F5 |
| Backend: debug toàn bộ test | Chạy mọi test có điểm dừng |
| Web: debug trong Chrome / Edge | Chạy `npm run dev` của web trước, rồi F5: mở trình duyệt có gắn debug, điểm dừng đặt trong `src/` |

**Đặt điểm dừng** bằng cách bấm vào lề trái của dòng code (hiện chấm đỏ). Thử ngay:

1. Mở `backend/src/modules/health/routes.ts`, đặt điểm dừng ở dòng `res.setHeader('Cache-Control', 'no-store');`.
2. Chọn "Backend: chạy + debug", bấm F5.
3. Mở http://localhost:4000/api/health. VS Code dừng ở dòng đó, xem biến bên trái; F10 chạy từng dòng, F5 chạy tiếp.

## 8. Xem dữ liệu trong MySQL

Dùng chương trình quản lý CSDL bất kỳ (DBeaver, MySQL Workbench, hoặc tiện ích "Database Client" của VS Code):

| Ô | Giá trị |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `3307` |
| User / Password | `tdbakugan` / mật khẩu `DB_PASSWORD` trong `backend/.env` |
| Database | `tdbakugan` |

Hoặc gõ lệnh: `docker compose exec mysql mysql -utdbakugan -p tdbakugan` (trong thư mục `backend`).

## 9. Hằng ngày

```powershell
# Mở Docker Desktop, rồi:
cd C:\code\BakuganStore\backend
docker compose up -d
npm run dev                  # cửa sổ 1: backend
cd C:\code\BakuganStore
npm run dev                  # cửa sổ 2: web
```

**Lấy bản mới**:

1. `git pull`.
2. Chạy `npm install` ở thư mục gốc và ở `backend` (khi có thư viện mới).
3. Backend tự cập nhật CSDL khi khởi động.
4. So `backend/.env.example` với `backend/.env` để thêm biến mới (tài liệu giai đoạn sẽ ghi).

**Tắt cho nhẹ máy**: `docker compose stop` (dữ liệu giữ nguyên). **Xoá sạch dữ liệu lập trình**: `docker compose down -v`.

## 10. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| `npm` báo "running scripts is disabled" | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` rồi mở lại PowerShell |
| `docker compose up` báo "error during connect" / không thấy Docker | Mở Docker Desktop, chờ biểu tượng cá voi đứng yên rồi chạy lại |
| `bad option: --env-file-if-exists` | Node quá cũ: cài lại Node 22 LTS mới nhất |
| Backend báo "Biến môi trường chưa đúng" | Dòng báo lỗi ghi tên biến; sửa trong `backend/.env` (thường là quên điền `DB_PASSWORD`) |
| Backend báo "Access denied" / test báo MySQL từ chối root | Đã đổi mật khẩu sau lần bật đầu: `docker compose down -v` rồi `docker compose up -d` |
| Cổng 3000 / 4000 / 3307 đã có chương trình khác dùng | Đổi `PORT` (backend) hoặc `DB_PORT` trong `backend/.env`; web: `npm run dev -- --port 3001` (nhớ sửa `DEV_API_PROXY` / `PUBLIC_ORIGIN` cho khớp) |
| Bấm F5 "Backend: chạy + debug" báo cổng 4000 bị chiếm | Đang chạy `npm run dev` của backend ở cửa sổ khác: tắt nó đi |
| Prettier báo lỗi định dạng ở rất nhiều file | Repo đã ép xuống dòng kiểu LF (`.gitattributes`). Nếu clone trước khi có file này: `git rm -r --cached .` rồi `git reset --hard` (chỉ làm khi không có thay đổi chưa commit) |

## 11. Những gì đã thêm vào repo cho việc này

| File | Làm gì |
| --- | --- |
| `backend/docker-compose.yml` | MySQL 8.4 cho lập trình, chỉ mở trên `127.0.0.1:3307`, đọc mật khẩu từ `backend/.env` |
| `backend/.env.example` | Mẫu cấu hình backend khi lập trình |
| `backend/test/global-setup.ts` | Test tự lấy mật khẩu root từ `backend/.env`, báo lỗi dễ hiểu khi MySQL chưa bật hoặc sai mật khẩu |
| `backend/src/lib/logger.ts`, `src/config/env.ts` | `LOG_FORMAT=pretty` (mặc định khi lập trình): log có màu, dễ đọc. Mini PC vẫn ghi JSON |
| `backend/package.json` | Thêm lệnh `format`, `format:check`, `check` |
| `vite.config.ts`, `.env.example` | `DEV_API_PROXY`: web trên máy gọi backend trên máy qua `/api`, `/ws` |
| `.vscode/launch.json`, `settings.json`, `extensions.json` | Cấu hình debug, ESLint cho cả web và backend, định dạng khi lưu, tiện ích gợi ý |
| `.gitattributes` | Ép xuống dòng LF cho mọi file chữ (script `.sh` chạy được trên mini PC; Prettier không báo lỗi trên Windows) |

Đã thử trên Linux bằng bản clone mới làm theo đúng các bước trên. Chưa có máy Windows thật để thử: nếu gặp
lỗi ở bước nào, gửi nguyên dòng báo lỗi để mình sửa.
