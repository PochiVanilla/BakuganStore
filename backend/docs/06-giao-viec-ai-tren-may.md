# Giao việc cho AI trên máy: cài và chạy TD Bakugan

> File này để **chủ shop copy nguyên văn gửi cho AI đang chạy trên máy tính (PC Windows)**.
> AI trên máy làm từng việc bên dưới, chạy lệnh thật, rồi gửi lại kết quả theo mẫu ở mục 9.

## 0. Bối cảnh (AI trên máy đọc trước)

- Dự án: web bán Bakugan **TD Bakugan**.
  - Repo: https://github.com/PochiVanilla/BakuganStore, nhánh `master`.
  - Web: React 19 + Vite + TypeScript, ở thư mục gốc repo.
  - Backend: Express 5 + TypeScript + MySQL 8.4, thư mục `backend/`.
  - Tài liệu backend: thư mục `backend/docs/` (đọc `README.md` trước).
- **Chia việc**:
  - Code đang được viết ở một phiên Claude trên cloud và đẩy thẳng lên `master`.
  - Việc của AI trên máy: **cài môi trường, kéo code mới về, chạy, test, báo lỗi**.
  - **Không tự sửa code, không commit, không push** trừ khi chủ shop dặn riêng. Nếu thấy lỗi thì báo lại
    (mục 9) để phiên cloud sửa, tránh hai bên sửa chồng lên nhau.
- **Đang chuyển sang dữ liệu thật**:
  - Chủ shop đã quyết định bỏ toàn bộ dữ liệu giả lập (feed, đơn, khách… mẫu); mọi dữ liệu sẽ lưu trong MySQL.
  - Trong lúc chuyển, web có thể chạy ở một trong hai chế độ:
    - **giả lập**: dữ liệu nằm trong trình duyệt, như bản Vercel hiện tại;
    - **thật**: web gọi backend.
  - Tài liệu mới nhất trong `backend/docs/` ghi rõ đang ở chế độ nào. Luôn `git pull` trước khi làm.
- Hệ điều hành: Windows 10/11. Lệnh dưới đây chạy trong **PowerShell**.

## 1. Luật bắt buộc

1. Không đưa mật khẩu, khoá API, file `.env` / `.env.local` lên git, lên chat công khai hay vào code.
   Mật khẩu chỉ nằm trong `backend/.env` và `.env.local` trên máy này.
2. Không mở cổng MySQL (3307) ra mạng; file cấu hình đã chỉ mở trên `127.0.0.1`.
3. Không chạy lệnh xoá dữ liệu (`docker compose down -v`, xoá thư mục) nếu chủ shop chưa đồng ý,
   trừ khi mục "Sự cố" bên dưới chỉ rõ.
4. Báo lỗi bằng **nguyên văn dòng lỗi**, không tóm tắt, không đoán.

## 2. Việc 1 — Cài phần mềm (bỏ qua cái nào đã có)

Kiểm tra trước:

```powershell
git --version
node -v
docker version
code --version
```

Cần có:

- Git.
- **Node.js 22 LTS** (từ 22.12 trở lên).
- **Docker Desktop**: phải đang chạy, `docker version` có phần `Server`.
- VS Code.

Cái nào thiếu thì cài bằng winget:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Docker.DockerDesktop -e
winget install --id Microsoft.VisualStudioCode -e
```

Sau khi cài Docker Desktop:

1. Khởi động lại máy.
2. Mở Docker Desktop một lần, đồng ý điều khoản, chờ biểu tượng cá voi đứng yên. Docker Desktop dùng WSL 2;
   nếu nó báo thiếu WSL thì chạy `wsl --install` rồi khởi động lại.

Nếu `npm` báo "running scripts is disabled on this system":

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 3. Việc 2 — Lấy code

```powershell
if (-not (Test-Path C:\code)) { mkdir C:\code }
cd C:\code
if (Test-Path C:\code\BakuganStore) { cd BakuganStore; git pull } else { git clone https://github.com/PochiVanilla/BakuganStore.git; cd BakuganStore }
git log --oneline -1
```

Nếu repo đã có sẵn ở chỗ khác trên máy thì dùng chỗ đó, chỉ cần `git pull`.

## 4. Việc 3 — Cài thư viện

```powershell
cd C:\code\BakuganStore
npm install
cd backend
npm install
cd ..
```

## 5. Việc 4 — Tạo file cấu hình

**Backend** (`backend/.env`): tạo từ mẫu, tự sinh 2 mật khẩu ngẫu nhiên.

```powershell
cd C:\code\BakuganStore\backend
if (-not (Test-Path .env)) {
  function New-Pass { -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ }) }
  $lines = (Get-Content .env.example -Encoding UTF8) `
    -replace '^DB_PASSWORD=$', "DB_PASSWORD=$(New-Pass)" `
    -replace '^DB_ROOT_PASSWORD=$', "DB_ROOT_PASSWORD=$(New-Pass)"
  # Ghi UTF-8 không BOM (Set-Content của Windows PowerShell 5.1 thêm BOM, Docker đọc sai)
  [IO.File]::WriteAllLines((Join-Path $PWD '.env'), $lines)
}
Select-String -Path .env -Pattern '^DB_(PASSWORD|ROOT_PASSWORD)=.+' | Measure-Object | Select-Object -ExpandProperty Count
```

Dòng cuối phải in ra `2` (đã có đủ 2 mật khẩu). **Không in mật khẩu ra màn hình, không gửi cho ai.**
Nếu `backend/.env` đã có từ trước thì giữ nguyên, không tạo lại: MySQL ghi nhớ mật khẩu cũ.

Nếu `backend/.env.example` có biến mới mà `backend/.env` chưa có, ví dụ `JWT_SECRET` hay `BANK_DATA_KEY`:
chép dòng đó sang `.env`. Biến nào là khoá bí mật để trống trong mẫu thì sinh giá trị ngẫu nhiên bằng lệnh:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Web** (`.env.local` ở thư mục gốc):

```powershell
cd C:\code\BakuganStore
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
$lines = (Get-Content .env.local -Encoding UTF8) -replace '^# DEV_API_PROXY=', 'DEV_API_PROXY='
[IO.File]::WriteAllLines((Join-Path $PWD '.env.local'), $lines)
Select-String -Path .env.local -Pattern '^DEV_API_PROXY='
```

Dòng `DEV_API_PROXY=http://localhost:4000` cho web gọi backend trên máy. Muốn thử trợ lý AI thật: chủ shop tự
điền `GEMINI_API_KEY=` trong `backend/.env` (AI trên máy không tự lấy khoá).

## 6. Việc 5 — Chạy và kiểm tra

**a) MySQL**:

```powershell
cd C:\code\BakuganStore\backend
docker compose up -d --wait
docker compose ps
```

Phải thấy `mysql` ở trạng thái `healthy`.

**b) Test backend và kiểm tra code**:

```powershell
cd C:\code\BakuganStore\backend
npm test
npm run check
cd ..
npm run typecheck
npm run lint
npm run build
```

Ghi lại số test qua / hỏng và mọi dòng lỗi.

**c) Chạy backend** trong một cửa sổ PowerShell riêng, để chạy luôn:

```powershell
cd C:\code\BakuganStore\backend
npm run dev
```

Chờ dòng `TD Bakugan API đang chạy`. Kiểm tra ở cửa sổ khác:

```powershell
Invoke-RestMethod http://localhost:4000/api/health | ConvertTo-Json
```

Phải có `"status": "ok"` và `"database": "ok"`.

**d) Chạy web** trong một cửa sổ PowerShell riêng nữa:

```powershell
cd C:\code\BakuganStore
npm run dev
```

Mở http://localhost:3000. Kiểm tra web gọi được backend qua Vite:

```powershell
Invoke-RestMethod http://localhost:3000/api/health | ConvertTo-Json
```

**e) Tài khoản admin**:

- Khi tài liệu mới nhất có lệnh tạo admin (`admin:create`), chủ shop tự chạy lệnh đó và tự gõ email + mật khẩu.
- AI trên máy chỉ mở sẵn cửa sổ ở thư mục `backend`, **không tự đặt mật khẩu admin**.

## 7. Cập nhật mỗi khi phiên cloud báo có bản mới

```powershell
cd C:\code\BakuganStore
git pull
npm install
cd backend
npm install
```

Rồi làm lại:

1. So `backend/.env.example` với `backend/.env` (mục 5).
2. Tắt rồi chạy lại `npm run dev` của backend và web.
3. `npm test` trong `backend`.

Backend tự cập nhật bảng MySQL khi khởi động.

## 8. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| `docker` báo "error during connect" | Mở Docker Desktop, chờ chạy xong rồi làm lại |
| `bad option: --env-file-if-exists` | Node quá cũ: `winget upgrade --id OpenJS.NodeJS.LTS -e` |
| Backend báo "Biến môi trường chưa đúng" | Đọc tên biến trong dòng báo lỗi, sửa `backend/.env` (thường thiếu biến mới, xem mục 5) |
| Test báo "MySQL … từ chối tài khoản root" | `backend/.env` bị tạo lại sau khi MySQL đã chạy. Hỏi chủ shop rồi mới chạy `docker compose down -v` + `docker compose up -d --wait` (xoá dữ liệu lập trình) |
| Cổng 3000 / 4000 / 3307 bị chiếm | Báo lại chương trình nào đang dùng: `Get-NetTCPConnection -LocalPort 4000 -State Listen` |
| Prettier báo lỗi định dạng ở rất nhiều file | Kiểm tra `git config core.autocrlf`; repo đã ép xuống dòng LF bằng `.gitattributes`. Báo lại kết quả |

Hướng dẫn chi tiết hơn cho người: `backend/docs/05-cai-dat-may-lap-trinh.md`.

## 9. Mẫu báo cáo gửi lại

Copy mẫu này, điền kết quả thật rồi gửi cho chủ shop:

```
BÁO CÁO CÀI ĐẶT TD BAKUGAN
- Commit đang chạy (git log --oneline -1):
- git / node / docker version:
- Việc 1 cài phần mềm: OK / lỗi (dán nguyên văn)
- Việc 3 npm install (gốc + backend): OK / lỗi
- Việc 4 .env có đủ 2 mật khẩu: có / không
- MySQL (docker compose ps): healthy / lỗi
- npm test (backend): __ qua / __ hỏng — dán tên test hỏng + lỗi
- npm run check (backend): OK / lỗi
- typecheck / lint / build (web): OK / lỗi
- /api/health qua cổng 4000: OK / lỗi
- /api/health qua cổng 3000 (Vite): OK / lỗi
- Web mở được http://localhost:3000: có / không
- Ghi chú khác:
```
