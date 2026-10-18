# 07 · Giai đoạn 2: tài khoản thật trên MySQL

| Mục | Nội dung |
| --- | --- |
| Ngày | 18/10/2026 |
| Giai đoạn | 2 — **xong** (một phần của việc "bỏ dữ liệu giả lập, lưu thật trên MySQL") |
| Đã làm | Đăng ký, đăng nhập, phiên (access token 15 phút + refresh token trong cookie xoay vòng), đăng xuất, hồ sơ, đổi / quên / đặt lại mật khẩu, sổ địa chỉ, tài khoản nhận hoàn tiền mã hoá, lệnh tạo admin. Web: tự gia hạn phiên, trang đặt lại mật khẩu |
| Kết quả kiểm tra | 67/67 test backend trên MySQL 8.4. Trình duyệt thật, web chạy dữ liệu thật: luồng tài khoản 13/13, đặt lại mật khẩu qua link email 3/3 |
| Web đang chạy | Vẫn **giả lập** cho tới khi xong các phần còn lại (feed, đơn, đấu giá, chat…), rồi chuyển hẳn một lần (giai đoạn 9) |
| Việc tiếp theo | Giai đoạn 3: feed, từng con Bakugan, tải ảnh / video lên ổ máy |

## 1. Chủ shop dùng thế nào

- **Tài khoản quản trị** không còn nằm sẵn trong code. Chủ shop tự tạo trên máy chạy backend:
  - Khi lập trình: `cd backend` rồi `npm run admin:create`.
  - Trên mini PC: `docker compose exec api node dist/cli.js admin:create`.
  - Lệnh hỏi email, họ tên, mật khẩu; mật khẩu không hiện khi gõ và không lưu vào lịch sử lệnh.
- **Khách** tự đăng ký trên web như trước. Khi web chuyển sang dữ liệu thật, các tài khoản demo
  (`demo@tdbakugan.vn`, `admin@tdbakugan.vn`…) không còn, nút "Điền tài khoản demo" cũng ẩn.
- **Quên mật khẩu**: khách nhận email có link `/dat-lai-mat-khau?token=…`, sống 30 phút, dùng một lần.
  - Chưa cài gửi thư (`MAIL_DRIVER=console`) thì thư in ra cửa sổ / log backend.
  - Trên mini PC nên dùng Gmail SMTP (xem `deploy/HUONG-DAN.md`).

## 2. Đã làm

### 2.1 Backend

| API (`/api/…`) | Làm gì |
| --- | --- |
| `POST /auth/register` | Kiểm tra bằng đúng luật form của web, email lưu chữ thường, mật khẩu băm argon2id, tài khoản khách Lv1 thẻ "Khách mới". Email trùng → 409 ở ô email |
| `POST /auth/login` | Sai email hay sai mật khẩu đều trả cùng một câu 401 (và vẫn băm một lần để thời gian như nhau). Sai 5 lần liền khoá đăng nhập 15 phút (429). Tài khoản bị khoá → 423. Đúng → trả `{ user, accessToken }`, refresh token đặt vào cookie `td_rt` |
| `POST /auth/refresh` | Đổi refresh token mới mỗi lần (xoay vòng). Hai tab gia hạn cùng lúc (trong 30 giây) vẫn được. Token cũ bị dùng lại sau đó = dấu hiệu bị lấy cắp → thu hồi cả chuỗi phiên |
| `POST /auth/logout` | Thu hồi phiên, xoá cookie |
| `GET /auth/me` (mới), `PATCH /auth/me` | Hồ sơ của chính mình; đổi email trùng người khác → 409 |
| `POST /auth/change-password` | Sai mật khẩu cũ → **422** (không phải 401 để web không tưởng hết phiên). Đúng → thu hồi mọi phiên khác |
| `POST /auth/forgot-password` | Luôn cùng một câu trả lời, không lộ email nào có tài khoản; tối đa 3 thư mỗi giờ mỗi email |
| `POST /auth/reset-password` (mới) | Đặt mật khẩu mới, thu hồi mọi phiên cũ, mở khoá đăng nhập |
| `PUT` / `DELETE /auth/me/bank-account` | Số tài khoản mã hoá AES-256-GCM; API chỉ trả `•••• 1234`, kể cả cho chính chủ |
| `POST /addresses`, `PUT` / `DELETE /addresses/:id`, `PATCH /addresses/:id/default` | Tối đa 10 địa chỉ, luôn đúng một địa chỉ mặc định; địa chỉ của người khác → 404 |

**Cookie phiên `td_rt`**:

- `httpOnly`: JavaScript trên trang không đọc được.
- `SameSite=Lax`, chỉ gửi kèm các đường `/api/auth`.
- Có cờ `Secure` khi web chạy HTTPS.
- "Ghi nhớ đăng nhập": sống 30 ngày. Không chọn thì là cookie phiên (đóng trình duyệt là mất; trên server sống 1 ngày).

**Mỗi request có token**:

- Server tra lại tài khoản **và phiên** trong CSDL. Vì vậy đăng xuất, đổi mật khẩu, khoá tài khoản
  có hiệu lực ngay, không chờ token hết hạn.
- Token hỏng gửi kèm `/auth/refresh`, `/auth/login`… thì bỏ qua, để web luôn gia hạn được phiên.

**Phân quyền** (`src/middleware/auth.ts`), dùng cho các giai đoạn sau:

| Hàm | Ai được qua |
| --- | --- |
| `requireUser` | Mọi tài khoản đang hoạt động |
| `requireCustomer` | Chỉ khách; admin không đặt hàng, không đặt giá bằng tài khoản quản trị |
| `requireAdmin` | Chỉ admin |

**Lệnh `admin:create`** (`src/cli/adminCreate.ts`):

- Kiểm tra email, họ tên, mật khẩu bằng đúng luật của web; mật khẩu yếu thì hỏi lại.
- Nhập lại không khớp thì không tạo.
- Email đã có tài khoản thì từ chối (admin dùng email riêng).

**Biến môi trường mới**:

- `JWT_SECRET`, `BANK_DATA_KEY`: bắt buộc khi chạy thật. Khi lập trình mà để trống thì backend tạo khoá tạm và cảnh báo.
- `MAIL_DRIVER` (`console` / `smtp`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

### 2.2 Web (chỉ có tác dụng khi chạy dữ liệu thật, bản giả lập không đổi)

- **`httpClient`**:
  - Gặp 401 thì gọi `/auth/refresh` đúng một lần cho mọi request đang chờ, được thì gửi lại request.
  - Không được thì đăng xuất ở phía web.
  - Không gửi access token cũ khi gia hạn.
- **Store đăng nhập**:
  - Đăng xuất thì báo server thu hồi phiên.
  - Thêm `refreshSession`, `expireSession`.
  - Refresh token không còn nằm trong localStorage (backend giữ trong cookie).
- Mở web là lấy lại hồ sơ mới nhất (`GET /auth/me`).
- Trang mới **`/dat-lai-mat-khau`** (mở từ link email).
- Khung "Tài khoản nhận hoàn tiền" ghi rõ: số được mã hoá, chỉ hiện 4 số cuối, shop liên hệ trước khi hoàn tiền.

## 3. Kiểm thử

**Backend** (`test/integration/auth.test.ts`, `admin-cli.test.ts`, `test/unit/env.test.ts`), 67 test, đều qua:

| Nhóm | Thử gì |
| --- | --- |
| Đăng ký | Email trùng (khác hoa thường), dữ liệu sai |
| Đăng nhập | Body không có refresh token; cookie `HttpOnly` + `Secure` + `Path=/api/auth`; dữ liệu trả về không có mã băm / ghi chú nội bộ; sai email = sai mật khẩu; khoá sau 5 lần sai; tài khoản bị khoá |
| Phiên | Gia hạn xoay vòng; dùng lại token cũ → thu hồi cả chuỗi (cả access token mới cũng chết); hai tab cùng lúc; cookie lạ; token hỏng gửi kèm khi gia hạn; đăng xuất làm access token chết ngay |
| Hồ sơ, mật khẩu | Email trùng; đổi mật khẩu thu hồi phiên khác; quên mật khẩu không lộ email, link dùng một lần, thu hồi phiên cũ |
| Ngân hàng | CSDL không chứa số gốc; giải mã đúng; API chỉ có 4 số cuối |
| Sổ địa chỉ | Luôn một mặc định khi thêm / đổi / xoá; người khác sửa → 404; tối đa 10 |
| `admin:create` | Chạy thật bằng tiến trình con: tạo được, mật khẩu không hiện ra, đăng nhập được với quyền admin; mật khẩu yếu hỏi lại; nhập lại sai thì không tạo |
| Biến môi trường | Bản thật thiếu khoá không khởi động; khoá ngắn bị từ chối; `smtp` thiếu cấu hình bị từ chối |

**Trình duyệt thật** (backend + MySQL + web với `VITE_USE_MOCK=false`), 13/13 qua:

1. Đăng ký → đăng nhập; cookie phiên `httpOnly`, không có trong localStorage.
2. Sửa hồ sơ, thêm tài khoản ngân hàng (chỉ thấy `•••• 6789`), thêm địa chỉ: tất cả lưu vào MySQL.
3. Làm hỏng access token → web tự gia hạn rồi đổi mật khẩu thành công.
4. Đăng xuất xoá cookie; mật khẩu cũ hết dùng được, mật khẩu mới đăng nhập được.
5. Bản thật không có nút tài khoản demo; admin tạo bằng lệnh vào được `/admin`.
6. Quên mật khẩu → mở link trong thư (log backend) → đặt mật khẩu mới → đăng nhập; dùng lại link bị từ chối.

**Lỗi tìm ra và đã sửa trong lúc thử**: web gửi kèm access token đã hỏng khi gọi `/auth/refresh`, backend
chặn 401 trước khi đọc cookie, nên không bao giờ gia hạn được. Đã sửa cả hai phía và thêm test.

## 4. Việc tiếp theo

- **Giai đoạn 3**: `/feeds…`, `/admin/feeds…`, `/admin/items…`, tải ảnh / video (`/admin/uploads`) lưu trên ổ.
- Các trang quản trị (tổng quan, đơn hàng…) hiện báo 404 ở bản dữ liệu thật vì API chưa làm tới;
  bản giả lập trên Vercel vẫn chạy bình thường.
