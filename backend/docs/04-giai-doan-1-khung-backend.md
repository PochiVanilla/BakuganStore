# 04 · Giai đoạn 1: khung backend, MySQL, Gemini, bộ cài mini PC

| Mục | Nội dung |
| --- | --- |
| Ngày | 29/09/2026 |
| Giai đoạn | 1 (theo [kế hoạch bản 3](01-ke-hoach-backend.md#13-lộ-trình)) — **xong** |
| Đã làm | Backend Express 5 + TypeScript; CSDL MySQL 8.4 đủ 31 bảng kèm migration và dữ liệu ban đầu; bot Gemini chạy trong backend; bộ cài mini PC (Docker Compose: Caddy + backend + MySQL, sao lưu, khôi phục, hướng dẫn từng bước) |
| Kết quả kiểm tra | 43/43 test backend trên MySQL 8.4 thật (chạy 3 lần liền đều qua). Dựng thử cả bộ Docker: web, `/api/health`, bot, HTTPS header, giới hạn dung lượng, tắt êm, sao lưu, khôi phục thử đều đúng. Web: `typecheck`, `lint`, `prettier`, `build` sạch; các bộ Playwright cũ vẫn qua |
| Web đang chạy | Không đổi gì với khách: vẫn chạy dữ liệu giả lập như trên Vercel |
| Việc tiếp theo | Giai đoạn 2: tài khoản (đăng ký, đăng nhập, phiên, hồ sơ, sổ địa chỉ, tài khoản ngân hàng mã hoá, quên mật khẩu, lệnh tạo admin) |

## 1. Chủ shop có gì sau giai đoạn này

- **Cài được web lên mini PC ngay**: làm theo [`deploy/HUONG-DAN.md`](../../deploy/HUONG-DAN.md).
  Một lệnh `docker compose up -d --build` là có web qua HTTPS, Caddy tự xin chứng chỉ.
- **Bot Gemini chạy trên mini PC**: điền `GEMINI_API_KEY` vào `deploy/.env` là trợ lý AI trả lời bằng Gemini,
  không cần Vercel. Trang Cài đặt → Trợ lý AI → "Kiểm tra kết nối" dùng được như cũ, và câu hướng dẫn sửa
  lỗi giờ chỉ đúng chỗ trên mini PC.
- **CSDL MySQL đã sẵn sàng**: đủ bảng cho mọi giai đoạn sau, có cài đặt shop, cài đặt bot, 3 mã giảm giá
  và 6 bài blog. Chưa có tài khoản hay đơn nào (bản thật bắt đầu trống).
- **Sao lưu mỗi đêm**: CSDL và ảnh, giữ 14 ngày + 8 tuần, chép ra ổ ngoài và Google Drive nếu cài.
  Có lệnh thử khôi phục hằng tháng mà không đụng dữ liệu đang chạy.
- Web khách thấy **chưa đổi gì**. Đăng nhập, feed, đơn hàng… vẫn chạy dữ liệu giả lập tới khi làm xong
  các giai đoạn 2–9.

## 2. Đã làm

### 2.1 Backend (`backend/`)

| Phần | File | Làm gì |
| --- | --- | --- |
| Khởi động | `src/server.ts` | Đọc biến môi trường → chờ MySQL → cập nhật CSDL → mở cổng 4000. Tắt êm khi nhận SIGTERM: chờ request đang chạy xong (tối đa 10 giây), đóng kết nối MySQL |
| Lắp ráp | `src/app.ts` | Log + mã request → header an toàn (helmet) → giới hạn 300 request/phút/IP → chặn origin lạ → router → 404 → xử lý lỗi |
| Biến môi trường | `src/config/env.ts` | Kiểm tra bằng Zod. Sai / thiếu biến thì không khởi động, báo tên biến (không in giá trị). Biến để trống coi như chưa đặt |
| Lỗi chuẩn | `src/lib/errors.ts`, `src/middleware/errorHandler.ts` | Mọi lỗi trả `{ message, fieldErrors? }` đúng hợp đồng web đang chờ. JSON hỏng → 400, quá lớn → 413, dữ liệu sai → 422 kèm lỗi từng ô, lỗi lạ → 500 câu chung chung (chi tiết chỉ nằm trong log) |
| Log | `src/lib/logger.ts`, `src/middleware/requestLogger.ts` | pino, dạng JSON. Mỗi request một dòng: mã request, đường dẫn (bỏ phần sau `?`), IP thật, mã trạng thái, thời gian. Che token, cookie, mật khẩu, số tài khoản. Lỗi truy vấn chỉ ghi câu SQL, **bỏ tham số** (có thể là email, mã băm) |
| Bảo mật | `src/middleware/security.ts` | Chặn request POST/PUT/PATCH/DELETE có Origin lạ (403). Cho phép web của shop, origin thêm khi phát triển, và cùng máy chủ (mở web bằng IP trong mạng nhà) |
| Theo dõi | `src/modules/health/routes.ts` | `GET /api/health`: CSDL trả lời thì 200, không thì 503 |
| Bot | `src/modules/bot/routes.ts` | `GET/POST /api/chat-bot` dùng lại nguyên file `api/chat-bot.ts` của web (mục 2.3) |
| Lệnh quản trị | `src/cli.ts` | `node dist/cli.js migrate` / `seed` / `help` |
| Code dùng chung | `src/shared/*.ts` | Cửa ngõ duy nhất lấy code web: kiểu dữ liệu, tính tiền, dữ liệu mặc định, nhận ra hệ / tình trạng, hàm Gemini |

### 2.2 CSDL MySQL (`src/db/`, `drizzle/`)

- **31 bảng** đúng mục 6 của kế hoạch bản 3: tài khoản, hàng, đơn hàng và thanh toán, khuyến mãi,
  thành viên, đấu giá, chat, cài đặt, blog, liên hệ, nhật ký admin.
- **Giá trị liệt kê lấy thẳng từ kiểu dữ liệu của web** (trạng thái đơn, cách trả tiền, hệ, dòng, lý do huỷ…).
  Web thêm trạng thái mới thì `npm run db:generate` báo ngay CSDL cần đổi.
- **Ràng buộc nằm ngay trong CSDL**. Code có sót thì MySQL vẫn chặn:
  - Mỗi khách **một** địa chỉ mặc định.
  - Mỗi khách **một** yêu cầu lên Lv2 đang chờ.
  - Mỗi lượt thanh toán **một** lệnh hoàn tiền đang chạy / đã xong, và lệnh hoàn **bắt buộc** ghi admin nào bấm.
  - Mỗi lượt thanh toán **một** sự cố tiền.
  - Giá > 0.
  - Con đã bán phải có giờ bán.
  - Tổng đơn = max(0, tạm tính + ship − giảm).
  - Mã % từ 1 đến 100.
  - Không xoá được con Bakugan đã từng nằm trong đơn.
- **Migration** là file SQL đọc được (`drizzle/0000_init.sql`), tự chạy mỗi lần backend khởi động.
  Hai server khởi động cùng lúc thì một cái chờ (khoá tên `GET_LOCK`).
- **Dữ liệu ban đầu** (`src/db/seed.ts`):
  - Cài đặt shop / bot: thiếu thì tạo, có rồi thì giữ nguyên.
  - 3 mã giảm giá + 6 bài blog: chỉ tạo **một lần** lúc cài, nên admin xoá / sửa về sau không bị tạo lại.
  - Bản thật mới cài để **tắt thẻ và giao quốc tế** (chưa có cổng thẻ thật) và **để trống tài khoản nhận tiền**
    (admin tự nhập số thật). `TDNEW10` chỉ dùng cho đơn đầu tiên (luật 1.8b).
  - Lượt xem blog bắt đầu từ 0 (không chép số lượt xem mẫu).
- **Công cụ cho các giai đoạn sau**:
  - `withTransaction`: mức READ COMMITTED; InnoDB báo deadlock (1213) hoặc chờ khoá quá lâu (1205)
    thì tự chạy lại tối đa 3 lần, nghỉ ngắn ngẫu nhiên giữa các lần.
  - `nextCounter` / `lockCounter`: số feed, số mã BK. MySQL không có sequence nên dùng bảng `counters`
    + `SELECT … FOR UPDATE`.
  - `withNamedLock`: khoá tên của MySQL cho việc chạy nền.
  - Mọi kết nối đặt `time_zone = '+00:00'`: giờ luôn lưu UTC.

### 2.3 Bot Gemini chạy trong backend

- Backend nhận `GET/POST /api/chat-bot` và gọi **nguyên hàm** trong `api/chat-bot.ts`: cùng luật hệ thống,
  cùng giới hạn, cùng cách thử nhiều model. Bản Vercel không phải sửa gì.
- **IP để giới hạn 8 lượt/phút** lấy từ Express, đã tính theo đúng một lớp proxy (Caddy). Header
  `X-Real-IP` / `X-Forwarded-For` do trình duyệt tự gửi bị bỏ qua, nên không né giới hạn bằng cách giả IP được.
  Đã thử: gửi `X-Forwarded-For` giả qua Caddy thì backend vẫn ghi đúng IP thật.
- Kiểm tra Origin làm ở middleware chung trước khi vào hàm bot.
- Khoá `GEMINI_API_KEY` chỉ nằm trong biến môi trường của backend. Test xác nhận khoá chỉ đi trong header
  gửi Google, không nằm trên URL, không nằm trong câu trả lời.

### 2.4 Bộ cài mini PC (`deploy/`)

| File | Làm gì |
| --- | --- |
| `docker-compose.yml` | 3 dịch vụ: `mysql` (8.4, múi giờ UTC, utf8mb4), `api` (backend), `web` (Caddy + web đã build). MySQL nằm trong mạng nội bộ riêng: không mở cổng, không ra internet được. Chỉ `web` mở cổng 80 / 443. Có kiểm tra sức khoẻ, tự chạy lại khi lỗi hoặc mất điện |
| `Caddyfile` | HTTPS tự động; `/api`, `/ws` → backend; `/uploads` trả ảnh (cache 1 năm, CSP sandbox); còn lại trả web (tự về `index.html`). Giới hạn body 1 MB cho API, 100 MB cho đường tải file. `index.html` không cache, file JS/CSS cache 1 năm; nén gzip / zstd; HSTS và các header an toàn |
| `../backend/Dockerfile` | Build 2 bước; bản chạy chỉ có thư viện cần thiết (`npm ci --omit=dev`), chạy bằng tài khoản thường |
| `web.Dockerfile` | Build web React (vẫn `VITE_USE_MOCK=true`), đóng gói cùng Caddy |
| `../.dockerignore` | Không đưa `.env`, `node_modules`, `.git` vào image, nên khoá bí mật không bao giờ nằm trong image |
| `.env.example` | Mọi biến cần điền, kèm giải thích; không có giá trị thật |
| `backup.sh` | Sao lưu CSDL (`mysqldump --single-transaction`, kiểm tra bản dump trọn vẹn) + ảnh (bản chụp theo ngày bằng hard link: file không đổi thì không tốn thêm chỗ). Giữ 14 ngày + 8 tuần; chép ra ổ ngoài và rclone. Mật khẩu không hiện trên dòng lệnh |
| `restore.sh` | `--kiem-tra`: khôi phục thử vào CSDL tạm rồi xoá (không đụng dữ liệu thật). Không có cờ: khôi phục thật, bắt gõ `KHOI PHUC` để xác nhận |
| `HUONG-DAN.md` | Cài từng bước: Ubuntu, Docker, tường lửa, IP cố định, mở cổng, tên miền / DDNS, `.env`, chạy và kiểm tra, thử trong mạng nhà, cập nhật, sao lưu, theo dõi, sự cố thường gặp, việc không được làm |

### 2.5 Sửa nhỏ ở web (không đổi hành vi)

- `src/utils/pricing.ts`: tách hàm tính tiền khỏi `orderService.ts` (file đó import dữ liệu giả).
  `orderService.ts` export lại y hệt nên code cũ không phải sửa.
- `src/constants/defaults.ts`: cài đặt bot, số tiền nạp Lv2, 3 mã giảm giá, cài đặt shop của bản thật.
  Dữ liệu giả lập dùng lại file này, nên giỏ hàng và bot giả lập ra kết quả như trước.
- Câu hướng dẫn sửa lỗi Gemini trong trang Cài đặt: chỉ cách sửa trên mini PC (`deploy/.env` rồi
  `docker compose up -d`), vẫn giữ cách làm trên Vercel cho bản tạm.
- ESLint của web bỏ qua `backend/` và `deploy/` (backend có cấu hình riêng cho Node.js). `.gitignore` bỏ qua
  `node_modules` ở mọi thư mục và `backend/dist`.

## 3. Kiểm thử

**Test backend** (`backend/test`, Vitest + Supertest, **MySQL 8.4 thật**). 43 test, chạy 3 lần liền đều qua:

| Nhóm | Thử gì |
| --- | --- |
| Biến môi trường | Mặc định; tin 1 lớp proxy ở bản thật; origin; biến trống; báo lỗi không lộ giá trị; tên CSDL an toàn |
| Lỗi chuẩn, log | Lỗi từng ô theo đường dẫn; 422; lỗi truy vấn không lộ tham số; che token / mật khẩu / cookie / số tài khoản |
| Dùng chung code | Script `check:shared` không thấy vi phạm (đã thử cố tình vi phạm: bắt được cả import sai đường dẫn); tính tiền; nhận ra hệ "Hệ Lửa", "ĐẤT"; cài đặt bản thật tắt thẻ |
| Khung API | Health 200 / 503; 404 JSON; không có `X-Powered-By`; mã request; JSON hỏng 400; quá 100 KB 413; Origin: web shop / cùng máy / không Origin → cho qua, trang lạ → 403, GET không chặn; quá giới hạn → 429 |
| Bot | Chuyển nguyên body và kết quả; IP lấy từ Express chứ không từ header khách; sau Caddy lấy đúng IP; chưa có khoá → `not-configured`; có khoá → gọi Google, khoá chỉ trong header; quá 8 lượt/phút → 429 |
| CSDL | Đủ 31 bảng InnoDB utf8mb4; chạy lại migration an toàn; dữ liệu ban đầu đúng, không tạo lại thứ admin đã xoá / sửa; ràng buộc địa chỉ mặc định và tổng tiền; giờ UTC |
| Tranh chấp | 20 transaction cùng lấy số → đúng 1…20; **deadlock thật** (khoá ngược thứ tự) → bên bị huỷ tự chạy lại và xong; lỗi khác không chạy lại và huỷ sạch; khoá tên loại trừ nhau |

**Dựng thử cả bộ Docker** ngay trong môi trường làm việc (giống hệt mini PC, chạy HTTP `:80`):

- Build được cả 2 image; `mysql` và `api` "healthy".
- Qua Caddy:
  - `/api/health` 200.
  - Trang chủ và đường dẫn con (`/feed/12`) trả web.
  - `index.html` không cache; file JS cache 1 năm, có nén.
  - Body 1,2 MB bị chặn 413.
  - `/uploads` có header cache + CSP sandbox.
- Trình duyệt thật (Playwright) trên bộ Docker:
  - Trang Cài đặt → Kiểm tra kết nối: backend thật trả "chưa có khoá", web hiện hướng dẫn `deploy/.env` (4/4).
  - Bộ test chat khách vãng lai qua.
- **Tắt êm**: `docker compose stop api` thoát mã 0 trong 0,3 giây; bật lại chạy tiếp.
- **Sao lưu** chạy 3 lần:
  - Ảnh giữa các ngày là hard link (cùng inode).
  - Thêm 18 bản giả cũ thì chỉ giữ đúng 14 bản mới nhất.
  - Chép được ra "ổ ngoài".
- `restore.sh --kiem-tra`: đọc lại đủ 32 bảng, xoá CSDL tạm.

**Web** (bản giả lập, sau khi tách code dùng chung):

- `typecheck`, `lint`, `prettier`, `build` sạch.
- Playwright: thanh toán 35/35, admin thanh toán 19/19, ô tự gõ 18/18, trang chi tiết 29/29 + 19/19, feed, admin đăng feed, chat.
- Bot trả lời mã giảm giá và phí ship như cũ.

## 4. Khác so với kế hoạch

| Kế hoạch | Làm thật | Vì sao |
| --- | --- | --- |
| Bảng `settings` có cột `key` | Cột tên `name` | `KEY` là từ khoá của MySQL, dễ gây lỗi khi viết câu SQL tay |
| Cột `condition` của `items`, `auctions` | Tên cột `condition_text` (trong code vẫn gọi `condition`) | `CONDITION` cũng là từ khoá của MySQL |
| `node-cron` cho việc chạy nền | Chưa cài | Việc chạy nền đầu tiên (huỷ đơn quá hạn) thuộc giai đoạn 4. Khoá `GET_LOCK` đã có và đang dùng cho migration |
| Sao lưu ảnh bằng đồng bộ thư mục | Bản chụp theo ngày bằng hard link | Đồng bộ thường sẽ xoá luôn bản sao khi ảnh bị xoá nhầm; hard link giữ được 14 ngày mà gần như không tốn thêm chỗ |
| (không có) | Thêm `restore.sh` | Để việc "thử khôi phục mỗi tháng" (mục 11 kế hoạch) chỉ còn một lệnh |
| Cài đặt bản thật như bản giả lập | Tắt thẻ và giao quốc tế | Chưa có hợp đồng cổng thẻ; không được để khách trả qua cổng giả lập |

**Lưu ý `npm audit`**: báo 4 lỗi mức vừa, đều nằm trong công cụ build dùng lúc phát triển (`esbuild` bản cũ
bên trong `drizzle-kit` và `tsup`), liên quan tới máy chủ dev của esbuild, thứ backend không dùng. Image chạy thật
cài bằng `npm ci --omit=dev` nên không chứa các gói này. Sẽ cập nhật khi `drizzle-kit` ra bản sửa.

## 5. Chạy ở máy (cho người phát triển)

```bash
# MySQL để phát triển / test (một lần)
docker run -d --name tdb-mysql -e MYSQL_ROOT_PASSWORD=<mật khẩu> -e MYSQL_DATABASE=tdbakugan \
  -e MYSQL_USER=tdb -e MYSQL_PASSWORD=<mật khẩu> -p 127.0.0.1:3307:3306 mysql:8.4

cd backend
npm install
# tạo backend/.env (không commit): NODE_ENV, PUBLIC_ORIGIN=http://localhost:3000,
# EXTRA_ORIGINS=http://localhost:4173, DB_HOST=127.0.0.1, DB_PORT=3307, DB_USER, DB_PASSWORD, DB_NAME
npm run dev                                   # tự chạy migration + dữ liệu ban đầu
TEST_MYSQL_URL=mysql://root:<mật khẩu>@127.0.0.1:3307 npm test
npm run typecheck && npm run lint && npm run check:shared
npm run db:generate                           # sau khi sửa src/db/schema → sinh migration mới
```

## 6. Việc tiếp theo

- **Giai đoạn 2: tài khoản**
  - Đăng ký, đăng nhập (argon2id, khoá tạm khi sai nhiều), access token 15 phút + refresh token trong cookie `httpOnly` xoay vòng.
  - Đăng xuất, hồ sơ, sổ địa chỉ, tài khoản ngân hàng mã hoá AES-256-GCM.
  - Đổi và quên mật khẩu (gửi email), lệnh `admin:create`.
  - Web: tự gia hạn phiên, trang đặt lại mật khẩu.
  - `.env` sẽ thêm `JWT_SECRET`, `BANK_DATA_KEY` và cấu hình gửi email; tài liệu giai đoạn 2 sẽ ghi rõ cách tạo.
- **Chủ shop chuẩn bị dần** (không chặn việc code):
  - Mini PC cài Ubuntu Server 24.04.
  - Hỏi nhà mạng về IP công khai / cổng 80, 443.
  - Mua tên miền.
  - Chọn cách gửi email: Gmail hoặc Resend.
