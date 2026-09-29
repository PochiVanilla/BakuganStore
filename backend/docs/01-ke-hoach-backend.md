# 01 · Kế hoạch backend Express + TypeScript

| Mục | Nội dung |
| --- | --- |
| Ngày | 29/09/2026 |
| Phiên bản | **3**: không tự hoàn tiền; tên, hệ, tình trạng do shop tự gõ; bỏ G-Power (xem [03](03-khong-tu-hoan-tien-va-o-tu-dien.md)). Bản 2: MySQL, lưu ảnh trên máy, tự chạy trên mini PC (xem [02](02-dieu-chinh-mysql-mini-pc.md)) |
| Giai đoạn | Đang làm giai đoạn 1 |
| Trạng thái | **Đã duyệt** (chủ shop: "tiến hành làm backend đi") |
| Dựa trên | [00 · Tổng hợp nhu cầu](00-tong-hop-nhu-cau.md) |
| Cách làm | Làm lần lượt từ giai đoạn 1. Xong giai đoạn nào thì báo kết quả kèm một file MD mới (số kế tiếp). Chỗ nào phải đổi thiết kế thì hỏi trước |

## Tóm tắt

- **Backend**: Express 5 + TypeScript, cơ sở dữ liệu **MySQL 8.4**.
- **Chạy trên mini PC của shop** bằng Docker, gồm 3 phần:
  - **Caddy**: nhận HTTPS, trả file web và ảnh.
  - **Backend Express**.
  - **MySQL**.
  Web React build ra file tĩnh và chạy luôn trên mini PC. Vercel chỉ là bản chạy tạm.
- **Ảnh và video lưu trên ổ cứng mini PC**, sao lưu mỗi đêm ra ổ ngoài và một nơi khác.
- **Bot Gemini**: ngay giai đoạn 1, backend nhận đường `/api/chat-bot`, dùng lại đúng code hiện có; khoá Gemini để trong file `.env` trên mini PC. Web chạy trên mini PC là có Gemini, không cần Vercel.
- **Dùng chung code với web**: kiểu dữ liệu, hàm tính tiền, kiểm tra form, luật chuyển trạng thái đơn, luật bot. Nhờ vậy web và server không bao giờ tính lệch nhau.
- **Chống bán trùng**: khi đặt hàng, server khoá đúng những con Bakugan trong đơn ngay trong CSDL. Ai tới sau phải chờ rồi nhận câu "vừa có người chốt trước" (mục 8.6). Đặt giá đấu giá dùng cách tương tự, và báo realtime cho người đang xem qua WebSocket (mục 8.11).
- **Thẻ**: làm trước một cổng giả lập ngay trên server để chạy trọn luồng và test. Cổng thật (OnePay hoặc VNPAY) chỉ là thêm một file, cắm vào khi có hợp đồng (mục 8.9).
- **Web đang chạy không bị ảnh hưởng**: bản trên Vercel và bản trên mini PC vẫn dùng dữ liệu giả lập cho tới giai đoạn cuối. Mọi bộ test Playwright hiện có phải vẫn xanh sau mỗi giai đoạn.
- **9 giai đoạn**, mỗi giai đoạn có kiểm thử và một file MD (mục 13).
- **Tiền không bao giờ tự hoàn**: trả trễ, trả trùng, sai số tiền thì hệ thống chỉ ghi nhận, mở sự cố cho admin và nhắc khách liên hệ shop. Chỉ admin bấm mới hoàn (mục 8.9).
- **Tên, hệ, tình trạng** của từng con là chữ shop tự gõ; không có G-Power. Server nhận ra hệ quen thuộc để có icon và bộ lọc (mục 6, 8.3).
- Thông tin về mini PC (mục 1.2, 1.4, 1.5) cần có trước khi chạy thử giai đoạn 1 trên máy của bạn.

## Mục lục

1. [Cần bạn quyết](#1-cần-bạn-quyết)
2. [Công nghệ](#2-công-nghệ)
3. [Kiến trúc](#3-kiến-trúc)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Dùng chung code với web](#5-dùng-chung-code-với-web)
6. [Cơ sở dữ liệu](#6-cơ-sở-dữ-liệu)
7. [Quy ước API](#7-quy-ước-api)
8. [Thuật toán từng phần](#8-thuật-toán-từng-phần)
9. [Bảo mật](#9-bảo-mật)
10. [Kiểm thử](#10-kiểm-thử)
11. [Chạy ở máy, cài trên mini PC, sao lưu](#11-chạy-ở-máy-cài-trên-mini-pc-sao-lưu)
12. [Thay đổi ở frontend](#12-thay-đổi-ở-frontend)
13. [Lộ trình](#13-lộ-trình)
14. [Rủi ro](#14-rủi-ro)

---

## 1. Cần bạn quyết

| # | Việc | Chốt / đề xuất | Ghi chú | Cần trước giai đoạn |
| --- | --- | --- | --- | --- |
| 1.1 | Cơ sở dữ liệu | **MySQL 8.4 LTS**: đã chốt | Bản hỗ trợ dài hạn của MySQL | — |
| 1.2 | Nơi chạy | **Mini PC của shop**: đã chốt. Đề xuất cài **Ubuntu Server 24.04 LTS** + Docker | Windows vẫn chạy được (Docker Desktop), nhưng kém ổn định khi chạy máy chủ 24/7 | 1 (lúc chạy thử trên máy bạn) |
| 1.3 | Ảnh, video | **Lưu trên ổ mini PC**: đã chốt | Bắt buộc sao lưu mỗi đêm (mục 11) | — |
| 1.4 | Tên miền | **Cần có** (VD `tdbakugan.vn`) | HTTPS, cổng thẻ và email đều cần tên miền. IP nhà mạng đổi thì tên miền tự trỏ theo (DDNS) | 1 |
| 1.5 | Internet cho mini PC | Kiểm tra hai việc: có **IP công khai** không (nhiều gói gia đình dùng CGNAT, mở cổng không có tác dụng), và nhà mạng có chặn cổng 80/443 không | Không được thì gọi nhà mạng xin IP công khai hoặc IP tĩnh | 1 |
| 1.6 | Gửi email (quên mật khẩu, báo đơn mới) | **Gmail SMTP**: không cần gì thêm, tối đa khoảng 500 thư/ngày. Hoặc **Resend** (cần tên miền) | Mạng nhà không gửi thư trực tiếp được (thường bị chặn, dễ vào spam), nên phải gửi qua dịch vụ | 2 (ở máy in email ra màn hình) |
| 1.7 | Cổng thanh toán thẻ | **OnePay hoặc VNPAY**: cả hai nhận Visa/Mastercard/JCB phát hành ở nước ngoài. Bạn làm hồ sơ (doanh nghiệp hoặc hộ kinh doanh); trong lúc chờ, mình dùng cổng giả lập | Khi chạy thẻ thật nên có IP tĩnh (cổng có thể yêu cầu) | 5 (không chặn việc khác) |
| 1.8 | Ba luật | **(a)** Đơn chuyển khoản quá 24 giờ chưa nhận tiền: tự huỷ **chỉ khi đơn còn "Chờ xác nhận"**; admin đã xác nhận thì để admin quyết<br>**(b)** Mã `TDNEW10` ("cho khách mới"): chỉ dùng cho **đơn đầu tiên** của mỗi tài khoản<br>**(c)** **Không bao giờ tự hoàn tiền.** Khách trả thẻ trễ sau khi đơn đã tự huỷ: hàng **còn** thì giữ đơn cho khách; hàng **đã bán cho người khác** thì ghi nhận tiền, mở sự cố "Lỗi thanh toán" cho admin, khách được nhắc liên hệ shop | (a), (b): theo đề xuất, chủ shop chưa ý kiến, đổi lúc nào cũng được. (c): chủ shop chốt | — |

## 2. Công nghệ

| Phần | Chọn | Vì sao |
| --- | --- | --- |
| Ngôn ngữ | TypeScript 5.9, chế độ strict (cùng bản với web) | Dùng chung kiểu dữ liệu với web |
| Môi trường chạy | Node.js 22 LTS (chạy được cả 24 LTS) | Bản hỗ trợ dài hạn |
| Web framework | Express 5.2 | Theo yêu cầu; bản 5 tự chuyển lỗi của hàm `async` về bộ xử lý lỗi |
| Cơ sở dữ liệu | MySQL 8.4 LTS (InnoDB, utf8mb4) | Theo lựa chọn của shop. InnoDB có transaction và khoá dòng (`SELECT … FOR UPDATE`), đủ cho "mỗi con chỉ bán một lần" |
| Truy vấn | Drizzle ORM + `mysql2` | Viết gần với SQL, có kiểu TypeScript, khoá dòng dễ; migration là file SQL đọc được; không phải sinh code |
| Kiểm tra dữ liệu vào | Zod 4 (cùng bản với web) | Dùng lại schema form của web |
| Mật khẩu | argon2id | Chuẩn OWASP khuyên dùng |
| Token đăng nhập | `jose` (JWT) | Thư viện chuẩn, gọn |
| Ghi log | `pino` | Nhanh, dạng JSON, che được trường nhạy cảm |
| Bảo vệ HTTP | `helmet`, `express-rate-limit` | Header an toàn, chặn gọi dồn |
| Xử lý ảnh | `sharp` + `file-type` | Kiểm tra đúng là ảnh, xoá thông tin ẩn (vị trí GPS), nén WebP |
| Kho file | Thư mục trên ổ mini PC; Caddy trả file | Theo lựa chọn của shop; không phụ thuộc dịch vụ ngoài |
| Việc chạy nền | `node-cron` + khoá tên của MySQL (`GET_LOCK`) | Chạy ngay trong server; nếu sau này chạy hai server thì cũng chỉ một cái làm |
| Realtime | `ws` (WebSocket), sự kiện chuyển trong bộ nhớ | Trang đấu giá đã chờ sẵn WebSocket. Một máy chủ nên chưa cần hàng đợi riêng; nhiều máy thì thêm Redis |
| Máy chủ web | Caddy | Tự xin và gia hạn chứng chỉ HTTPS miễn phí (Let's Encrypt); trả file web, ảnh, video; chuyển `/api` và `/ws` vào backend |
| Kiểm thử | Vitest + Supertest, MySQL thật | Thử đúng như lúc chạy thật |
| Chạy dev / đóng gói | `tsx` (dev), `tsup` (ra một file chạy), Docker Compose | Cài trên mini PC bằng một lệnh; cập nhật bằng `git pull` + một lệnh |

## 3. Kiến trúc

```
 Khách / admin
      │  https://tdbakugan.vn
      ▼
 Router nhà (chỉ mở cổng 80 và 443 về mini PC)
      │
      ▼
 ┌─────────────────────── Mini PC · Docker Compose ───────────────────────┐
 │                                                                         │
 │  Caddy: HTTPS · trả file web đã build · trả /uploads (ảnh, video)       │
 │    │                                                                    │
 │    │  /api/…   /ws/…                                                    │
 │    ▼                                                                    │
 │  Backend Express + việc chạy nền ─────▶ MySQL 8.4 (không mở ra ngoài)   │
 │    │                                                                    │
 │    └─ ghi ảnh / video vào ổ cứng: /srv/tdbakugan/uploads                │
 │                                                                         │
 └─────────────────────────────────────────────────────────────────────────┘
      │  gọi ra ngoài: Gemini · gửi email · cổng thẻ (cổng gọi IPN về qua HTTPS)
      ▼
 Sao lưu mỗi đêm: CSDL + ảnh → ổ cứng ngoài + một nơi khác (VD Google Drive)
```

Web và API chạy chung một tên miền, nên không cần CORS và cookie đăng nhập đơn giản hơn.

Mỗi request đi qua các bước:

1. Caddy nhận HTTPS và chuyển vào backend kèm IP thật của khách. Backend chỉ tin đúng một lớp proxy là Caddy.
2. Gắn mã request để tra log; `helmet` thêm header an toàn.
3. Đọc JSON, tối đa 100 KB (riêng tải ảnh 15 MB, video 100 MB).
4. Giới hạn số lần gọi.
5. Đọc token, rồi tra người dùng trong CSDL. Nhờ vậy khoá tài khoản hay đổi quyền có hiệu lực ngay.
6. Kiểm tra dữ liệu vào bằng Zod. Sai thì trả 422 kèm lỗi từng ô.
7. Xử lý nghiệp vụ trong một transaction.
8. Chọn đúng những trường được phép trả về (DTO), bọc trong `{ data }`.
9. Có lỗi thì một chỗ xử lý chung trả `{ message, fieldErrors }`, không lộ chi tiết kỹ thuật.

## 4. Cấu trúc thư mục

```
(gốc repo)
├─ src/ …                  web React (như cũ)
├─ api/chat-bot.ts         hàm gọi Gemini (Vercel đang dùng; backend dùng lại)
├─ backend/
│  ├─ docs/                tài liệu; mỗi lần làm thêm một file
│  ├─ drizzle/             file migration SQL (sinh tự động, lưu trong git)
│  ├─ src/
│  │  ├─ server.ts         mở cổng, tắt êm (xong request đang chạy rồi mới dừng)
│  │  ├─ app.ts            lắp middleware và các router
│  │  ├─ config/env.ts     đọc và kiểm tra biến môi trường; thiếu biến là không khởi động
│  │  ├─ db/               schema bảng, kết nối, dữ liệu ban đầu
│  │  ├─ shared.ts         cửa ngõ duy nhất import code dùng chung với web
│  │  ├─ lib/              lỗi chuẩn, log, mã hoá, id, giờ Việt Nam, phân trang
│  │  ├─ middleware/       request id, xác thực, quyền admin, kiểm tra dữ liệu,
│  │  │                    giới hạn tần suất, xử lý lỗi
│  │  ├─ modules/          mỗi module có routes.ts · service.ts · dto.ts · schemas.ts
│  │  │  ├─ auth/  users/  feeds/  items/  orders/  coupons/  payments/
│  │  │  ├─ membership/  auctions/  chat/  bot/  media/  content/
│  │  │  └─ admin/         đơn, khách, feed, từng con, đấu giá, báo cáo,
│  │  │                    sự cố, cài đặt, chat
│  │  ├─ payments/gateways/  mock.ts · onepay.ts · vnpay.ts (cùng một khuôn)
│  │  ├─ storage/          lưu file trên ổ đĩa (có khuôn chung, sau này đổi được)
│  │  ├─ mail/             console.ts (ở máy) · smtp.ts · resend.ts
│  │  └─ jobs/             bộ hẹn giờ + từng việc chạy nền
│  ├─ test/                unit/ · integration/ (MySQL thật)
│  ├─ scripts/             admin-create.ts, check-shared-imports.ts
│  ├─ Dockerfile
│  └─ package.json · tsconfig.json · eslint.config.mjs
└─ deploy/                 chạy trên mini PC
   ├─ docker-compose.yml   Caddy + backend + MySQL
   ├─ Caddyfile            HTTPS, file web, /uploads, chuyển /api và /ws
   ├─ web.Dockerfile       build web React ra file tĩnh
   ├─ backup.sh            sao lưu CSDL + ảnh
   ├─ .env.example         biến môi trường (không có giá trị thật)
   └─ HUONG-DAN.md         cài mini PC từng bước
```

Backend có `package.json` riêng. Web (thư mục gốc) không đổi cách build; ESLint của web được dặn bỏ qua `backend/` và `deploy/`.

## 5. Dùng chung code với web

Backend import thẳng các file **chỉ có logic** trong `src/` của web, qua alias `@shared/*`:

| Code dùng chung | Để làm gì ở server |
| --- | --- |
| `src/types` | Kiểu dữ liệu và danh sách hằng (hệ, trạng thái đơn, lý do huỷ…) |
| `src/constants` (orders, catalog, shipping, countries) | Bảng chuyển trạng thái đơn, phí ship, vùng giao quốc tế, luật Lv2 |
| `src/utils` (phone, intlAddress, itemCode, slugify, format) | Kiểm tra số điện thoại, địa chỉ quốc tế, mã BK, tìm không dấu |
| `src/features/auth/schemas.ts` | Kiểm tra đăng ký, địa chỉ, tài khoản ngân hàng: đúng y luật của form |
| `src/features/chat/*` | Luật bot: huỷ đơn có xác nhận, tư vấn chọn Bakugan, trả lời theo từ khoá, dữ kiện cho Gemini |
| Hàm `calculateTotals`, `shippingFeeFor`, `couponAppliesTo` | Tính tiền. Sẽ tách khỏi `orderService.ts` ra file riêng vì file đó đang import dữ liệu giả |
| `api/chat-bot.ts` | Gọi Gemini: backend dùng lại nguyên file, bản Vercel không phải sửa gì |

- **Quy tắc**: file dùng chung không được import React, DOM hay dữ liệu giả. Có script tự kiểm tra, chạy trong bộ test.
- **Sửa nhỏ ở web, không đổi hành vi**: tách hàm tính tiền ra file riêng; tách phần chữ của luật đấu giá khỏi phần icon.
- **Đóng gói**: `tsup` gói luôn code dùng chung vào file chạy của backend. Docker build từ gốc repo vì cần cả `src/`, `api/` lẫn `backend/`.

## 6. Cơ sở dữ liệu

**Quy ước chung (MySQL 8.4, InnoDB, bảng mã utf8mb4 cho tiếng Việt)**
- **Tiền** lưu `BIGINT` (đồng).
- **Thời gian** lưu `DATETIME(3)` theo giờ UTC (kết nối đặt múi giờ `+00:00`). Khi gom theo ngày thì đổi sang giờ Việt Nam bằng `CONVERT_TZ(…, '+00:00', '+07:00')`; Việt Nam không đổi giờ theo mùa nên cố định +07:00 là đúng.
- **Id** là UUID v7 (xếp được theo thời gian), tạo ở backend. Web coi id là chuỗi nên không ảnh hưởng.
- **Mảng và dữ liệu có cấu trúc** (ảnh, thẻ phân loại, địa chỉ quốc tế, câu trả lời nhanh…) lưu cột `JSON`.
- **Số thứ tự** (số feed, số mã BK): MySQL không có sequence, nên dùng bảng `counters`. Lấy số trong transaction bằng `SELECT … FOR UPDATE` rồi cộng 1.
- **"Chỉ được một" có điều kiện** (VD mỗi khách một địa chỉ mặc định): MySQL không có chỉ mục duy nhất một phần, nên dùng **cột sinh + UNIQUE**. VD `default_owner = IF(is_default, user_id, NULL)` kèm UNIQUE: nhiều dòng NULL không sao, nhưng mỗi khách chỉ có một dòng mặc định.
- **Tìm kiếm**: bảng mã mặc định `utf8mb4_0900_ai_ci` đã không phân biệt hoa thường. Tìm không dấu vẫn dùng cột `search_text` bỏ dấu bằng hàm của web, vì MySQL coi "đ" khác "d".
- **Transaction**: dùng mức `READ COMMITTED` cho giao dịch có khoá dòng. InnoDB báo deadlock (lỗi 1213) hoặc chờ khoá quá lâu (lỗi 1205) thì **tự thử lại tối đa 3 lần**.
- **Không có `RETURNING`**: id tạo sẵn ở backend; cập nhật có điều kiện thì kiểm tra số dòng bị ảnh hưởng.
- **Migration** là file SQL trong git, tự chạy mỗi lần khởi động bản mới.

### Tài khoản

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `users` | email, password_hash, full_name, phone, role, status, locked_reason, birthday, gender, member_level, level_source, level_up_at, deposit_balance, tags, admin_note, failed_logins, login_locked_until, last_login_at | Email duy nhất (lưu chữ thường) |
| `addresses` | user_id, label, receiver_name, phone, province, district, ward, street, is_default | Mỗi khách **tối đa một** địa chỉ mặc định (cột sinh + UNIQUE); tối đa 10 địa chỉ |
| `bank_accounts` | user_id, bank_name, account_holder, account_number_enc, account_last4, key_version | Số tài khoản **mã hoá AES-256-GCM** |
| `sessions` | user_id, family_id, token_hash, expires_at, revoked_at, replaced_by, remember, user_agent, ip | Chỉ lưu mã băm của refresh token |
| `password_resets` | user_id, token_hash, expires_at, used_at | Mã dùng một lần, sống 30 phút |

### Hàng

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `counters` | name, value | Số feed kế tiếp, số mã BK kế tiếp |
| `feeds` | number, title, caption, images, published_at, opens_at, lot_cost, supplier, created_by, retired_at | `number` duy nhất; `retired_at` có giá trị = đã gỡ khỏi web |
| `items` | code, name (≤80), price, **attribute** (chữ shop gõ, ≤40), **attribute_key** (hệ nhận ra được, có thể trống), series, **condition** (chữ shop gõ, ≤160, có thể trống), photos (≤3), video, status, sold_at, sold_via, order_id, sold_note, buyer_name, feed_id, position, feed_title_snapshot, feed_number_snapshot, search_text | `code` duy nhất; giá > 0; `sold` thì bắt buộc có giờ bán; `feed_id` trống = hàng tồn; chỉ mục trên `attribute_key` để lọc |
| `media` | path, url, kind, mime, bytes, width, height, sha256, uploaded_by, in_use | Để chặn link lạ và dọn file thừa |

### Đơn hàng và thanh toán

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `orders` | code, user_id, customer_email, source, status, payment_method, payment_status, subtotal, shipping_fee, discount, total, coupon_code, receiver_name, phone, address_line, shipping_region, intl_address, **note** (khách), **internal_note** (admin), cancel_reason, cancel_note, auction_id | `code` duy nhất; tổng = max(0, tạm tính + ship − giảm) |
| `order_items` | order_id, item_id, auction_id, code, name, price, image | Bản chụp lúc mua |
| `order_events` | order_id, status, at, actor_type, actor_id, actor_name, note | Lịch sử đơn |
| `card_payments` | order_id, expires_at, attempts, brand, last4, transaction_id, paid_at, last_error, refunded_at | Một đơn một dòng; **không có số thẻ** |
| `payment_attempts` | order_id, gateway, amount, status, gateway_txn_id, brand, last4, response_code, message, finished_at | Id là mã giao dịch gửi cổng |
| `payment_events` | gateway, event_key, attempt_id, payload (đã bỏ trường nhạy cảm), signature_ok, result | `event_key` duy nhất: cổng gửi lặp cũng chỉ xử lý một lần |
| `refunds` | order_id, attempt_id, amount, status, gateway_refund_id, requested_by, error | **Chỉ tạo khi admin bấm hoàn**; `requested_by` bắt buộc là admin. Mỗi lượt thanh toán chỉ một lệnh hoàn đang chạy hoặc đã xong (cột sinh + UNIQUE) |
| `order_issues` | order_id, type, status, description, reported_by (`admin` / `customer` / `carrier` / `system`), payment_attempt_id, resolution | Sự cố đơn hàng. Sự cố tiền do hệ thống mở có `type = payment`, `reported_by = system`; mỗi lượt thanh toán chỉ mở một sự cố (UNIQUE) |
| `idempotency_keys` | key, user_id, route, request_hash, response | Duy nhất theo (key, user); giữ 24 giờ |

### Khuyến mãi, thành viên, đấu giá

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `coupons` | code, label, type, value, min_subtotal, max_discount, starts_at, expires_at, active, first_order_only, per_user_limit, total_limit, used_count | `code` lưu chữ hoa, duy nhất |
| `coupon_redemptions` | coupon_code, order_id, user_id, released_at | Một đơn dùng tối đa một mã; đơn huỷ thì trả lượt |
| `membership_requests` | user_id, kind, amount, transfer_note, message, status, resolved_at, resolved_by, admin_note | Mỗi khách tối đa một yêu cầu đang chờ (cột sinh + UNIQUE) |
| `auctions` | slug, title, description, images, attribute (chữ), attribute_key, series, condition (chữ), accessories, start_price, current_price, bid_step, buy_now_price, start_at, end_at, original_end_at, price_visibility, anti_snipe_minutes, extension_count, bid_count, leader_id, watcher_count | `slug` duy nhất |
| `bids` | auction_id, bidder_id, amount, triggered_extension | Chỉ mục theo phiên và theo người đặt |
| `auction_fulfillments` | auction_id, status, order_id, note | Mỗi phiên một dòng: không tạo đơn hai lần |

### Chat và các bảng khác

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `conversations` | customer_id, guest_token_hash, customer_name, customer_contact, status, bot_enabled, unread_by_admin, unread_by_customer, pending_action, consult | |
| `messages` | conversation_id, sender, text, author_id, author_name, quick_replies, links | Chỉ mục theo cuộc trò chuyện và thời gian |
| `settings` | key (`shop` / `bot`), value, updated_by | Kiểm tra bằng Zod mỗi lần đọc/ghi |
| `blog_posts` | slug, title, excerpt, cover_image, category, tags, author_name, published_at, reading_minutes, view_count, sections | |
| `contact_messages` | full_name, email, phone, subject, message, handled_at | |
| `newsletter_subscribers` | email, unsubscribed_at | Email duy nhất |
| `audit_logs` | actor_id, action, target_type, target_id, detail, ip | Nhật ký thao tác của admin; không sửa/xoá qua API |

**Dữ liệu ban đầu**
- **Bản thật**: cài đặt mặc định, 3 mã giảm giá, 6 bài blog. Không có khách, đơn hay feed giả.
- **Bản ở máy / bản thử**: toàn bộ dữ liệu mẫu đang có trong web, để chạy lại các bộ test Playwright.

## 7. Quy ước API

- Giữ nguyên hợp đồng ở [00 §2](00-tong-hop-nhu-cau.md#2-hợp-đồng-chung-frontend-đang-chờ): `{ data }`, `{ message, fieldErrors }`, mã lỗi, phân trang. Câu báo lỗi chép nguyên từ bản giả lập để giao diện không đổi.
- Mọi đường dẫn nằm dưới `/api` trên cùng tên miền với web (web build với `VITE_API_BASE_URL=/api`).
- Đọc được tham số mảng dạng `attributes[]=…` lẫn `attributes=a,b`.
- Giữ đường `GET/POST /api/chat-bot` như hàm Vercel hiện nay, nên trang "Thử bot" và "Kiểm tra kết nối" trong cài đặt dùng được luôn.
- **API mới** (web chưa gọi, thêm dần theo giai đoạn):

| Nhóm | API |
| --- | --- |
| Tài khoản | `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/reset-password` |
| Chat | `POST /chat/conversations/:id/bot-turn` |
| Thanh toán | `GET\|POST /payments/card/ipn/:gateway` · `GET /payments/card/return/:gateway` |
| Realtime | WebSocket `wss://<tên miền>/ws/auctions/:id` (web đặt `VITE_WS_URL=wss://<tên miền>/ws`) |
| Quản trị (khi làm màn hình) | Tạo/sửa/xoá phiên đấu giá · quản lý mã giảm giá · đọc tin liên hệ và danh sách nhận tin |
| Theo dõi | `GET /health` |

## 8. Thuật toán từng phần

### 8.1 Đăng ký, đăng nhập, phiên

**Đăng ký**
1. Kiểm tra bằng `registerSchema` của web.
2. Email đưa về chữ thường. Đã có thì trả 409 kèm lỗi ở ô email.
3. Băm mật khẩu bằng argon2id; tạo tài khoản khách, Lv1, thẻ "Khách mới".

**Đăng nhập**
1. Giới hạn 10 lần/phút mỗi IP. Một email sai 5 lần liền thì khoá tạm 15 phút.
2. Không có email này: vẫn chạy băm một mật khẩu giả để thời gian trả lời như nhau (người ngoài không dò được email nào có tài khoản). Trả 401 "Email hoặc mật khẩu không đúng."
3. Sai mật khẩu: tăng đếm sai, trả 401 cùng câu đó.
4. Tài khoản bị khoá: 423.
5. Đúng:
   - Xoá đếm sai, ghi lần đăng nhập.
   - **Access token**: JWT ký HS256, sống 15 phút, chứa id người dùng và id phiên.
   - **Refresh token**: 32 byte ngẫu nhiên, sống 30 ngày nếu chọn "Ghi nhớ", không thì 1 ngày. CSDL chỉ lưu mã băm SHA-256.
   - Refresh token gửi qua cookie `httpOnly; Secure; SameSite=Lax; Path=/api/auth`, nên JavaScript trên trang không đọc được.
   - Trả `{ user, accessToken }`.

**Mỗi request có token**: kiểm tra chữ ký và hạn (chỉ nhận HS256), rồi tra người dùng trong CSDL. Không còn tài khoản thì 401; bị khoá thì 403.

**Gia hạn phiên** (`POST /auth/refresh`)
1. Đọc cookie, băm, tìm phiên. Không có hoặc hết hạn thì 401.
2. Phiên này đã bị thay trước đó: token cũ bị dùng lại, dấu hiệu bị đánh cắp. Thu hồi **cả chuỗi phiên** và trả 401 (bắt đăng nhập lại).
3. Hợp lệ: thu hồi phiên cũ, tạo phiên mới cùng chuỗi, đặt cookie mới, trả access token mới.
4. Chống CSRF: cookie `SameSite=Lax` và kiểm tra header `Origin` đúng là web của shop.

**Đăng xuất**: thu hồi phiên, xoá cookie.

**Đổi mật khẩu**: kiểm tra mật khẩu cũ, băm mật khẩu mới, thu hồi mọi phiên khác.

**Quên mật khẩu**
1. Luôn trả cùng một câu, không lộ email nào có tài khoản.
2. Tài khoản có thật và đang hoạt động: tạo mã 32 byte (lưu mã băm, sống 30 phút, huỷ mã cũ), gửi link `https://<tên miền>/dat-lai-mat-khau?token=…`.
3. Giới hạn 3 thư/giờ mỗi email và 10 thư/giờ mỗi IP.

**Đặt lại mật khẩu**: mã đúng, chưa dùng, còn hạn thì đặt mật khẩu mới (kiểm tra như form), đánh dấu mã đã dùng, thu hồi mọi phiên.

**Tạo admin**: lệnh `admin:create` hỏi email và mật khẩu ngay trong terminal của mini PC. Không có tài khoản admin nào nằm trong code hay dữ liệu ban đầu của bản thật.

### 8.2 Hồ sơ, sổ địa chỉ, tài khoản ngân hàng

- **Hồ sơ**: email mới không được trùng người khác (409).
- **Sổ địa chỉ** (trong một transaction):
  - Luôn có **đúng một** địa chỉ mặc định. Thêm hoặc sửa có chọn mặc định thì bỏ mặc định cũ.
  - Xoá địa chỉ mặc định thì địa chỉ đầu tiên còn lại thành mặc định.
  - Cột sinh + UNIQUE bảo đảm không bao giờ có hai địa chỉ mặc định.
- **Tài khoản ngân hàng**:
  - Số tài khoản mã hoá AES-256-GCM. Khoá `BANK_DATA_KEY` nằm trong biến môi trường, có số phiên bản để đổi khoá về sau.
  - Lưu riêng 4 số cuối để hiển thị.
  - API, kể cả với chính chủ, chỉ trả `•••• 1234`. Admin chỉ thấy tên ngân hàng và tên chủ tài khoản.
  - Không bao giờ ghi số tài khoản vào log.

### 8.3 Feed và tìm kiếm (phía khách)

- **Đọc feed**: lấy các feed chưa gỡ cùng các con, số feed giảm dần. Trạng thái feed và "đặt mua được" tính theo đồng hồ của CSDL (`UTC_TIMESTAMP`).
- **Chọn trường công khai**: không lộ người mua, đơn, giá nhập, nhà cung cấp.
- **Bộ nhớ đệm**: danh sách feed đệm vài giây vì trang chủ gọi nhiều; xoá đệm ngay khi có đơn mới hoặc admin sửa feed.
- **Tìm kiếm**:
  - Cột `search_text` lưu sẵn tên + mã + mã viết liền, đã bỏ dấu bằng đúng hàm `normalizeSearch` của web.
  - Truy vấn `search_text LIKE '%từ khoá đã bỏ dấu%'`, lọc thêm hệ (`attribute_key IN (…)`) và khoảng giá; tối đa 60 kết quả. Không lọc theo tình trạng vì tình trạng là chữ tự do.
  - Dữ liệu nhỏ (tối đa 30 feed × 60 con) nên chưa cần công cụ tìm kiếm riêng.
- `by-ids` nhận tối đa 100 id mỗi lần (một feed có tới 60 con).

### 8.4 Admin quản lý feed và từng con

**Đăng feed mới**
1. Kiểm tra dữ liệu theo luật ở [00 §6.1](00-tong-hop-nhu-cau.md#61-feed-và-từng-con-bakugan).
2. Mọi ảnh và video phải là file đã tải lên máy của shop (có trong bảng `media`), nên không ai chèn được link lạ.
3. Chạy trong transaction:
   1. Khoá dòng "số feed" trong bảng `counters`. Việc này cũng xếp hàng các lần đăng feed, nên hai admin bấm cùng lúc cũng không vượt 30 feed.
   2. Đếm feed đang có. Đủ 30 mà không gửi đúng `replaceFeedId` của feed cũ nhất thì trả 409 kèm thông tin feed sẽ bị xoá (như bản giả lập).
   3. Có thay thế: gỡ feed cũ nhất. Con chưa bán thành hàng tồn (ghi lại tên và số feed); con đã bán giữ lịch sử.
   4. Cấp số feed kế tiếp.
   5. Xếp các con theo thứ tự form, rồi tới các con mang sang từ feed bị xoá.
      - Con đã có: phải tồn tại, không thuộc feed khác; con đã bán giữ nguyên giá.
      - Con mới: cấp mã theo cách bên dưới.
   6. Đánh dấu file đang dùng. File không còn dùng được xoá khỏi ổ **sau khi** transaction thành công.

**Tên, hệ, tình trạng là chữ shop tự gõ**
- Cắt khoảng trắng hai đầu. Tên 2–80 ký tự; hệ bắt buộc, tối đa 40 ký tự; tình trạng tối đa 160 ký tự, để trống thì lưu `NULL`. Không có G-Power.
- Mỗi lần lưu, server tính `attribute_key = attributeKeyOf(hệ)` bằng đúng hàm của web: "Hệ Lửa", "fire" → `pyrus`; chữ lạ → `NULL` (vẫn hiện chữ, không có icon, không lọc theo 6 hệ).
- Thêm cách gọi mới cho một hệ trong `attributeKeyOf` thì chạy `npm run items:rekey` để tính lại cho hàng cũ.

**Cấp mã Bakugan**
- Admin tự gõ: chuẩn hoá bằng `normalizeItemCode`; trùng thì 409.
- Bỏ trống: lấy số kế tiếp từ bảng `counters`, bỏ qua những số admin đã gõ tay.
- UNIQUE trên `code` là chốt chặn cuối cùng.

**Sửa feed**: như đăng mới nhưng không có bước giới hạn 30 feed. Đổi tên feed thì các con đã bán trong feed cũng đổi tên feed theo.

**Xoá feed**: gỡ feed như bước 3.3, trả về số con thành hàng tồn.

**Từng con**:
- Sửa: con đã bán không đổi giá; đổi mã thì mã mới không được trùng.
- Đánh dấu bán ngoài web, và bỏ đánh dấu (chỉ với con bán tay).
- Xoá: chỉ con chưa bán và chưa từng nằm trong đơn nào.

Mọi thao tác admin ghi vào nhật ký (8.18).

### 8.5 Tính tiền và mã giảm giá

- Server dùng đúng hàm `calculateTotals` của web, với phí lấy từ cài đặt trong CSDL.
- Kiểm tra mã giảm giá:
  - Có tồn tại (không phân biệt hoa thường), đang bật, còn trong thời hạn.
  - Đủ giá trị đơn tối thiểu; đúng vùng giao (mã miễn ship chỉ dùng trong nước).
  - Các giới hạn nếu có: chỉ đơn đầu tiên, mỗi khách tối đa N lần, tổng số lượt.
- `POST /coupons/apply` chỉ để xem trước. Lúc đặt đơn, server kiểm tra lại từ đầu.
- Lượt dùng mã được ghi cùng transaction với đơn. Đơn huỷ thì trả lại lượt.

### 8.6 Đặt hàng: chống bán trùng

Đây là phần quan trọng nhất. Web gửi kèm `Idempotency-Key` (một mã ngẫu nhiên cho mỗi lần bấm đặt hàng).

```
POST /orders

1. Người gọi phải là khách, tài khoản đang hoạt động (lấy từ token).
2. Kiểm tra dữ liệu (trong nước / quốc tế như 00 §6.3). Đọc cài đặt shop: thẻ, quốc tế, phí.
3. Idempotency-Key này đã gặp (cùng khách, trong 24 giờ) → trả lại đúng đơn đã tạo lần trước.
   → Bấm hai lần hoặc mạng chập chờn gửi lại cũng không ra hai đơn.
4. BEGIN (READ COMMITTED)
   a. SELECT các con + feed của chúng
        WHERE id IN (…) ORDER BY id FOR UPDATE
      → Khoá đúng những con này; ai đặt trùng con phải đứng chờ.
        Khoá theo thứ tự id nên hai đơn tranh nhau rất khó kẹt nhau (deadlock);
        nếu InnoDB vẫn báo deadlock thì tự thử lại, tối đa 3 lần.
   b. Con nào không còn, đã bán, hoặc feed đã gỡ → ROLLBACK, 409 "BK-xxxx vừa có người chốt trước…"
      Feed chưa tới giờ mở bán (so với đồng hồ CSDL) → 409.
   c. Tính tiền bằng calculateTotals (giá lấy từ CSDL). Kiểm tra mã giảm giá;
      mã có giới hạn lượt thì khoá luôn dòng mã.
   d. Sinh mã đơn TDddmm + 1 chữ + 2 số; trùng thì sinh lại (UNIQUE bảo đảm).
   e. Ghi đơn, các dòng hàng (chụp lại tên, mã, giá, ảnh), mốc lịch sử đầu tiên.
      Đơn thẻ: ghi card_payments với hạn giữ = bây giờ + 15 phút.
   f. UPDATE items SET status = 'sold', sold_via = 'order', order_id = …, sold_at = bây giờ
        WHERE id IN (…)
   g. Ghi lượt dùng mã và Idempotency-Key.
   COMMIT
5. Xoá bộ nhớ đệm feed. Trả 201 kèm đơn.
```

**Vì sao chắc chắn**: hai khách cùng đặt BK-0231 thì transaction đến sau phải chờ khoá của transaction đến trước. Khi được đi tiếp, nó đọc lại, thấy con đã `sold` và trả 409. Bộ test sẽ bắn 20 đơn cùng lúc vào một con, và phải ra **đúng 1 đơn** thành công.

### 8.7 Đơn của khách

- **Xem đơn** (`/orders/me`, `/orders/me/:id`): chỉ đơn của chính mình. Hỏi đơn người khác thì trả 404 (không phải 403), để không lộ đơn đó có tồn tại.
- **Bản gửi cho khách**: không có ghi chú nội bộ; lịch sử ghi "TD Bakugan" thay cho tên nhân viên.
- **Tự huỷ**: khoá dòng đơn; chỉ đơn `pending` chưa trả. Huỷ với lý do "khách yêu cầu", mở bán lại hàng, trả lượt mã giảm giá.
- **Đổi cách trả** (thẻ sang COD / chuyển khoản / MoMo):
  - Chỉ đơn trong nước, còn trong hạn giữ, chưa trả.
  - Xoá hạn giữ, đóng các lượt thanh toán đang mở, ghi lịch sử.
  - Lượt đã đóng mà cổng vẫn báo trừ tiền thành công: **không tự hoàn**. Ghi nhận khoản tiền, mở sự cố tiền cho admin (8.9), để shipper không thu tiền lần nữa.

### 8.8 Admin xử lý đơn

- **Danh sách**:
  - Lọc theo trạng thái, nguồn, số ngày gần đây, từ khoá. Từ khoá tìm không dấu trong mã đơn, tên, SĐT, email, tên và mã Bakugan.
  - Đếm số đơn từng trạng thái bằng một câu SQL `GROUP BY`; phân trang.
- **Đổi trạng thái** (transaction, khoá dòng đơn):
  1. Bước chuyển phải có trong bảng `ORDER_TRANSITIONS` dùng chung với web. Sai thì 409.
  2. **Huỷ**: bắt buộc lý do. Mở bán lại những con **vẫn gắn với đơn này**, trả lượt mã giảm giá. Đơn đấu giá thì phiên thành "bỏ cọc".
  3. **Hoàn hàng** có chọn mở bán lại: mở bán lại như khi huỷ.
  4. **Hoàn tất**:
     - Đơn COD tự thành "đã thanh toán".
     - Đếm số con khách đã nhận. Đủ 3 mà đang Lv1 thì lên Lv2 (lý do "mua đủ 3 con") và đóng yêu cầu đang chờ.
  5. Thêm mốc lịch sử với tên admin và ghi chú bước. Ghi chú bước khách xem được (VD mã vận đơn).
- **Thanh toán**: đơn thẻ không đánh dấu tay được. Hoàn tiền chỉ khi admin bấm (8.9); đơn không trả thẻ thì admin tự chuyển trả rồi bấm "Đã hoàn tiền cho khách".
- **Ghi chú nội bộ**: lưu vào trường riêng `internal_note`, không đè ghi chú của khách nữa.
- **Tạo đơn tay**:
  - Server tự tra từng con (còn bán, không chọn trùng) và khoá dòng như 8.6. Giá admin nhập là số nguyên ≥ 0.
  - Đơn cho người thắng đấu giá: phiên đã kết thúc, có người thắng, chưa tạo đơn. Khoá chính của `auction_fulfillments` chặn tạo đơn hai lần.
- **Sự cố**: tạo và sửa; muốn đóng sự cố phải ghi cách giải quyết. Sự cố tiền do hệ thống mở (8.9) nằm chung danh sách này.

### 8.9 Thanh toán thẻ

Mọi cổng dùng chung một khuôn. Đổi cổng chỉ là thêm một file:

```ts
interface CardGateway {
  createPayment(input: {
    attemptId: string; amount: number; orderCode: string;
    returnUrl: string; ipnUrl: string; clientIp: string; expiresAt: Date;
  }): Promise<{ redirectUrl: string }>;
  verifyCallback(params: Record<string, string>): {
    valid: boolean; attemptId: string; success: boolean; amount: number;
    gatewayTxnId?: string; brand?: CardBrand; last4?: string; code: string; message: string;
  };
  queryStatus(attempt: PaymentAttempt): Promise<GatewayStatus>;      // đối chiếu khi mất IPN
  refund(attempt: PaymentAttempt, amount: number): Promise<RefundResult>;
  ipnResponse(outcome: IpnOutcome): { status: number; body: string }; // mỗi cổng một kiểu trả lời
}
```

Có ba bản:
- **`mock`**: thẻ thử y như bây giờ, nhưng chạy trên server và ký HMAC giống cổng thật. Dùng cho máy phát triển và bản thử.
- **`onepay`** và **`vnpay`**: làm khi có hợp đồng và tài khoản sandbox, theo tài liệu tích hợp của cổng.

**Mở phiên trả** (`POST /payments/card/sessions`)
1. Đúng chủ đơn; khoá dòng đơn.
2. Đơn thẻ, `pending`, chưa trả, còn hạn giữ. Không thì 409 (câu như bản giả lập).
3. `returnUrl` phải thuộc tên miền của shop, để không bị lợi dụng chuyển khách sang trang lạ.
4. Tạo lượt thanh toán mới:
   - Số tiền = tổng đơn **trong CSDL**.
   - Tăng số lần thử; đóng các lượt cũ còn đang mở.
5. Gọi cổng lấy link trả tiền. Nếu cổng hỗ trợ, cho link hết hạn cùng lúc với hạn giữ hàng.
6. Trả `{ redirectUrl }`.

**Cổng báo kết quả, IPN** (`/payments/card/ipn/:gateway`, cổng gọi thẳng vào mini PC qua HTTPS)
1. Kiểm tra chữ ký bằng phép so sánh an toàn về thời gian. Sai thì trả lỗi theo chuẩn của cổng, không đổi gì, ghi log cảnh báo.
2. Ghi sự kiện với khoá duy nhất (cổng + mã giao dịch + kết quả). Cổng gửi lại lần hai thì trả "đã xử lý", không làm lại.
3. Trong transaction, khoá lượt thanh toán và đơn:
   - **Số tiền khác tổng đơn**: đánh dấu bất thường, mở sự cố tiền, trả lỗi "sai số tiền".
   - **Lượt đã có kết quả**: trả "đã xác nhận".
   - **Thành công**:
     - Đơn còn chờ trả: chuyển "đã thanh toán". Lưu hãng thẻ, 4 số cuối, mã giao dịch, giờ trả; ghi lịch sử "Cổng thanh toán: Đã thanh toán … mã giao dịch …". Đơn vẫn "Chờ xác nhận" để shop gọi khách.
     - **Đơn đã tự huỷ vì quá hạn** (khách trả trễ):
       - Các con vẫn còn bán: giữ lại cho khách (chuyển SOLD lại, đơn về `pending` và đã trả), ghi lịch sử.
       - Có con đã bán cho người khác: đơn vẫn huỷ nhưng ghi "đã thanh toán" (shop đã nhận tiền), mở sự cố tiền, ghi lịch sử. **Không tự hoàn.**
     - Đơn đã trả bằng lượt khác (trả trùng), hoặc lượt này đã bị đóng (khách đổi sang COD): ghi nhận lượt này, mở sự cố tiền. **Không tự hoàn.**
   - **Thất bại**: ghi lỗi vào lần thử gần nhất, bằng câu tiếng Việt tương ứng mã lỗi của cổng.
4. Trả lời đúng định dạng cổng yêu cầu.

**Sự cố tiền** (thay cho mọi chỗ bản 2 từng "tự hoàn tiền")

```
Mở sự cố (cùng transaction với việc ghi nhận tiền):
  order_issues: type = payment, reported_by = system, payment_attempt_id = lượt đó
    (UNIQUE theo lượt: IPN gửi lặp hay việc đối chiếu chạy lại cũng chỉ một sự cố)
  mô tả: chuyện gì xảy ra + số tiền + mã giao dịch của cổng + 4 số cuối thẻ
  lịch sử đơn: "Hệ thống: nhận tiền … nhưng …; chờ shop xử lý"
Sau COMMIT: số "sự cố mở" trên menu admin tăng; gửi email báo shop (nếu đã cài gửi thư)
Khách xem đơn: có cờ needsShopContact → trang đơn hiện
  "Shop đã nhận khoản thanh toán của bạn nhưng đơn cần kiểm tra lại.
   Bạn nhắn shop để được hỗ trợ" + nút mở chat
Admin tự quyết: hoàn tiền (bấm nút, hỏi lại trước khi gửi), đổi con khác, giữ tiền cho đơn sau…
  → đóng sự cố phải ghi cách giải quyết; cờ needsShopContact tắt
```

**Khách quay về từ cổng** (`/payments/card/return/:gateway`)
- Kiểm tra chữ ký (chỉ để hiển thị), rồi chuyển khách tới `/thanh-toan/ket-qua/:orderId` trên web.
- Trang kết quả hỏi lại `GET /orders/me/:id` như hiện nay, không tin tham số trên URL.
- Lượt thanh toán còn "đang chờ" quá 30 giây mà chưa có IPN thì server hỏi thẳng cổng một lần.

**Giữ hàng 15 phút** (việc chạy nền, mỗi 30 giây)

```
Chọn các đơn: thẻ, pending, chưa trả, hạn giữ đã qua
  VÀ không có lượt thanh toán nào mở trong 20 phút gần đây mà cổng chưa báo kết quả
  (khách có thể đang nhập OTP; chờ thêm để tránh vừa trừ tiền vừa huỷ đơn)
Mỗi đơn một transaction riêng:
  khoá dòng đơn → kiểm tra lại điều kiện (IPN có thể vừa tới)
  → huỷ với lý do payment-timeout, mở bán lại hàng, trả lượt mã, đóng các lượt thanh toán
  → lịch sử "Hệ thống: Quá 15 phút chưa thanh toán thẻ…"
```

Trước khi đặt đơn hoặc mở phiên trả, server dọn luôn những đơn liên quan, không chờ tới lượt chạy.

**Hoàn tiền** (chỉ khi admin bấm "Hoàn tiền về thẻ"; không việc chạy nền hay luồng tự động nào gọi tới)
1. Người gọi là admin. Đơn đã trả bằng thẻ và đã huỷ hoặc hoàn hàng; hoặc admin chọn đúng một lượt thừa trong sự cố tiền.
2. Tạo lệnh hoàn, ghi admin nào bấm. Cột sinh + UNIQUE bảo đảm mỗi lượt thanh toán chỉ một lệnh đang chạy hoặc đã xong, nên bấm hai lần cũng không hoàn hai lần.
3. Gọi cổng hoàn số tiền của lượt đó:
   - Thành công: đơn "đã hoàn tiền", ghi giờ hoàn và lịch sử.
   - Thất bại: báo lỗi cho admin, lệnh hoàn ghi "thất bại", bấm lại được.

**Đối chiếu** (mỗi 2 phút): lượt "đang chờ" quá 5 phút thì hỏi cổng, rồi xử lý như khi nhận IPN (kể cả mở sự cố tiền; không tự hoàn).

**Không lưu số thẻ ở bất cứ đâu**, log cũng không ghi dữ liệu thẻ. Web chỉ chuyển khách sang trang của cổng, nên shop thuộc diện PCI DSS **SAQ A**, mức nhẹ nhất.

### 8.10 Hạng thành viên

- `GET /me/membership` trả về:
  - Hạng hiện tại, số con đã nhận (đếm dòng hàng của đơn hoàn tất), mục tiêu 3 con.
  - Tiền đã nạp, yêu cầu đang chờ.
  - Nội dung chuyển khoản `TDLV2 <SĐT>` và tài khoản nhận tiền của shop.
- **Gửi yêu cầu**: chỉ khách Lv1 chưa có yêu cầu đang chờ (cột sinh + UNIQUE bảo đảm). Xin xét duyệt thì lời nhắn ≥ 10 ký tự.
- **Admin duyệt** (transaction): yêu cầu phải còn chờ. Yêu cầu nạp tiền thì cộng `deposit_balance`. Lên Lv2 với lý do "nạp tiền" hoặc "admin duyệt". Từ chối phải ghi lý do.
- **Tự lên Lv2** khi đơn hoàn tất (8.8, bước 4).

### 8.11 Đấu giá

**Dữ liệu gửi cho khách**
- Không có danh sách lượt đặt, không có tên người đặt.
- `bidderCount` là số người khác nhau đã đặt; `myBids` là lượt của chính người đang xem; kèm cờ `viewerIsLeading`.
- **Phiên kín chưa kết thúc: không gửi giá hiện tại** (thay bằng giá khởi điểm). Kết thúc rồi mới gửi giá chốt, đúng như giao diện: "Giá được giấu" trong lúc diễn ra, "Giá chốt" sau khi kết thúc.
- Trạng thái phiên tính theo đồng hồ của CSDL.

**Đặt giá** (`POST /auctions/:id/bids`)

```
1. Người đặt: khách, tài khoản hoạt động, hạng ≥ 2 (đọc lại từ CSDL). Tối đa 20 lượt/phút.
2. BEGIN; SELECT phiên FOR UPDATE
   → mọi lượt đặt của một phiên xếp hàng lần lượt
3. bây giờ < giờ bắt đầu → 409 "chưa bắt đầu"; bây giờ > giờ kết thúc → 409 "đã kết thúc"
4. min = phiên mở ? giá hiện tại + bước giá
                : max(giá khởi điểm, lượt cao nhất của chính mình + bước giá)
   amount < min → 422
   phiên kín và amount ≤ giá hiện tại → 422 "chưa vượt người dẫn đầu" (không nói giá)
   amount phải là số nguyên
5. Chống bắn tỉa: N > 0 và (giờ kết thúc − bây giờ) ≤ N phút
   → giờ kết thúc = bây giờ + N phút; số lần gia hạn + 1
6. Ghi lượt đặt; cập nhật phiên: giá hiện tại, số lượt, người dẫn đầu, giờ kết thúc
7. COMMIT → trả phiên (bản của người vừa đặt)
```

**Vì sao chắc chắn**: khoá dòng phiên nên hai người đặt cùng một giây thì người sau được so với giá mới nhất, và giờ gia hạn không bị ghi đè.

**Realtime** (WebSocket `/ws/auctions/:id`)

```
Kết nối:
1. Web mở wss://<tên miền>/ws/auctions/:id (Caddy chuyển vào backend).
2. Tin nhắn đầu tiên (không bắt buộc): { type: 'auth', token: <access token> }
   → server biết người đang xem là ai. Token không nằm trên URL nên không lọt vào log.
3. Server cho kết nối vào "phòng" của phiên; số người đang xem gửi gộp 10 giây một lần (watcher-count).
4. Ping 30 giây một lần, không trả lời thì đóng. Mỗi IP tối đa 20 kết nối.

Có lượt đặt mới (ngay sau COMMIT ở bước 7):
1. Phát sự kiện trong bộ nhớ của server (một máy chủ nên không cần hàng đợi riêng).
2. Server đọc lại phiên một lần, rồi gửi cho từng kết nối trong phòng:
   bid-placed { auctionId, bidCount, bidderCount, endAt, extensionCount, at,
                amount:          chỉ có ở phiên mở,
                viewerIsLeading: chỉ có với kết nối đã xác thực }

Hết giờ: server hẹn giờ theo endAt của các phòng đang mở (gia hạn thì hẹn lại) → auction-ended.
```

Nhờ có `endAt` trong sự kiện, người đang xem thấy ngay phiên được gia hạn chống bắn tỉa. Phiên kín không bao giờ gửi số tiền qua kênh này.

**Kết thúc phiên**: không cần việc chạy nền; trạng thái tính theo giờ. Người thắng là người dẫn đầu lúc hết giờ. Admin thấy phiên "chờ tạo đơn" như bây giờ.

**Admin (API mới)**: tạo, sửa, xoá phiên. Giá và giờ chỉ sửa được khi phiên chưa bắt đầu; chỉ xoá được phiên chưa có lượt đặt. Màn hình admin cho phần này làm sau.

**Để giai đoạn sau**: nút "Mua ngay" và "Theo dõi phiên" (web hiện mới chỉ hiện con số).

### 8.12 Chat và trợ lý AI

**Gemini trên mini PC (làm ngay giai đoạn 1)**
- Backend nhận đường `GET/POST /api/chat-bot` bằng cách dùng lại nguyên file `api/chat-bot.ts`:
  - Cùng luật hệ thống, cùng giới hạn độ dài.
  - Thử lần lượt nhiều model; tối đa 8 lượt/phút mỗi IP; lỗi cấu hình thì tạm nghỉ gọi một lúc.
- Khoá `GEMINI_API_KEY` để trong file `.env` trên mini PC; không bao giờ đưa xuống trình duyệt.
- Web hiện tại gọi đúng đường này, nên chạy trên mini PC là bot có Gemini ngay, không phải sửa giao diện.
- Khi web chuyển sang dữ liệu thật (giai đoạn 9), lượt trả lời của khách chạy trên server (bên dưới). Lúc đó `POST /api/chat-bot` chỉ còn cho admin dùng (nút "Thử bot" và "Kiểm tra kết nối"), để người ngoài không dùng ké hạn mức Gemini của shop.

**Ai được vào cuộc trò chuyện**
- **Khách đăng nhập**: `customer_id` lấy từ token lúc tạo cuộc. Server bỏ qua `customerId` trình duyệt gửi lên.
- **Khách vãng lai**: tạo cuộc thì server trả thêm `guestToken` (32 byte ngẫu nhiên, CSDL chỉ lưu mã băm). Mọi thao tác sau đó phải gửi kèm header `X-Chat-Token`; sai mã thì 404.
- **Admin**: xem được mọi cuộc.

**Gửi tin** (`POST …/messages`)
- Tin ≤ 1.000 ký tự; tối đa 20 tin/5 phút mỗi cuộc.
- Trong transaction, khoá dòng cuộc trò chuyện:
  - Cuộc đã xong thì mở lại.
  - Bot toàn shop đang tắt thì chuyển sang "chờ nhân viên".
  - Tăng số tin chưa đọc.
- Trả `{ conversation, awaitingBot }`.

**Lượt trả lời của bot** (`POST …/bot-turn`, web gọi ngay sau khi gửi tin; thay cho việc trình duyệt tự làm như bây giờ)

```
1. Khoá theo từng cuộc trò chuyện (GET_LOCK): hai lượt không chạy chồng nhau.
2. Tin cuối của khách đã được trả lời rồi → trả trạng thái hiện tại (gọi lại nhiều lần không sao).
3. Dựng "những gì bot được biết" từ CSDL: feed, con còn bán, mã giảm giá, hạng,
   cài đặt thẻ / quốc tế, và CHỈ các đơn của customer_id của cuộc này.
4. Chạy đúng luật bot dùng chung với web, theo thứ tự:
   decideBotAction (huỷ đơn có xác nhận) → runConsult (tư vấn) → Gemini → answerWithRules (dự phòng)
5. Huỷ đơn qua bot: transaction khoá đơn, kiểm tra lại lời xác nhận còn hạn,
   đúng chủ đơn, đơn pending và chưa trả.
6. Trước khi ghi câu trả lời: nhân viên đã vào cuộc (status = admin) → bot im lặng.
7. Ghi tin của bot; chuyển nhân viên nếu cần (chỉ báo một lần); tăng số chưa đọc.
```

**Tin bị bỏ dở**: khách tắt web trước khi web gọi `bot-turn`. Việc chạy nền mỗi phút sẽ cho bot trả lời những tin khách đã chờ quá 60 giây.

**Admin**:
- Danh sách lọc theo "cần trả lời"; gửi tin (bot nhường lời); bật/tắt bot từng cuộc; đóng cuộc; đánh dấu đã đọc.
- Nút "Thử bot" và "Kiểm tra kết nối Gemini" dùng `/api/chat-bot` như hiện nay.

### 8.13 Tải ảnh và video (lưu trên ổ mini PC)

**Ảnh** (`POST /admin/uploads`, gửi dạng form, tối đa 15 MB)
1. Đọc vài byte đầu để biết **đúng là ảnh** (JPEG, PNG, WebP, AVIF, HEIC), không tin đuôi file hay Content-Type. Không nhận SVG vì có thể chứa mã độc.
2. `sharp` xoay đúng chiều, thu cạnh dài về tối đa 1600 px, xuất WebP, và **xoá toàn bộ thông tin ẩn** (EXIF, vị trí GPS nơi chụp).
3. Lưu vào `/srv/tdbakugan/uploads/img/2026/09/<uuid>.webp` (tên ngẫu nhiên, không bao giờ trùng hay ghi đè).
4. Ghi bảng `media` (chưa dùng), trả `{ url: "/uploads/img/2026/09/<uuid>.webp" }`.

**Video** (`POST /admin/uploads` với `kind=video`, tối đa 100 MB; web gửi y như hiện nay)
1. Backend ghi thẳng xuống ổ theo luồng (không giữ cả file trong RAM), vào thư mục tạm.
2. Kiểm tra dung lượng và vài byte đầu: phải là MP4, WebM hoặc MOV thật.
3. Chuyển vào `/srv/tdbakugan/uploads/video/…`, ghi `media`, trả `{ url }`.

Web và backend cùng một máy, cùng tên miền, nên không vướng giới hạn dung lượng của Vercel. Không cần link tải lên có chữ ký.

**Trả file cho khách**: Caddy trả thẳng thư mục `/uploads`, cho trình duyệt cache 1 năm (tên file không bao giờ đổi nội dung), hỗ trợ tua video.

**Dọn và giữ file**
- File không còn feed hay con nào dùng thì xoá ngay sau khi lưu.
- File tải lên mà 24 giờ không dùng tới thì việc chạy nền xoá.
- Ổ đầy quá 90% thì báo admin (trang tổng quan + email).
- Thư mục ảnh được **sao lưu mỗi đêm** cùng CSDL (mục 11). Mất máy mà không có bản sao lưu là mất hết ảnh.

### 8.14 Báo cáo và số đếm trên menu admin

- Mọi số liệu tính bằng SQL gom nhóm, không kéo cả bảng về server. Ngày tính theo giờ Việt Nam (`CONVERT_TZ(…, '+00:00', '+07:00')`).
- Doanh thu chỉ tính đơn không huỷ và không hoàn (như web), so với kỳ trước cùng độ dài.
- Số trên menu (đơn cần xử lý, phiên chờ tạo đơn, feed bán hết, hàng tồn, yêu cầu Lv2, sự cố mở, chat chờ trả lời): gộp một câu SQL, đệm 5 giây.

### 8.15 Blog, liên hệ, nhận tin

- **Blog**: đọc từ bảng, phân trang; bài liên quan theo chuyên mục và thẻ; tăng lượt xem (mỗi IP một lần mỗi giờ).
- **Liên hệ**:
  - Lưu lại và gửi email báo shop; trả mã phiếu.
  - Tối đa 5 lần/giờ mỗi IP; có ô ẩn để chặn bot spam.
- **Nhận tin**: lưu email (không trùng), giới hạn tần suất như liên hệ.

### 8.16 Cài đặt

- **Shop**: sửa từng phần, kiểm tra giới hạn như web. Tắt thẻ thì giao quốc tế tự tắt. Ghi nhật ký admin.
- **Bot**: thay cả bộ cài đặt; kiểm tra độ dài từng ô và đủ 11 chủ đề.
- **Phần công khai** của cài đặt phục vụ web qua `GET /checkout/config`, `GET /shop/bank`, `GET /chat/config`.

### 8.17 Việc chạy nền

| Việc | Chu kỳ | Làm gì |
| --- | --- | --- |
| Dọn giữ hàng thẻ | 30 giây | Như 8.9 |
| Hết hạn chuyển khoản | 10 phút | Đơn chuyển khoản `pending` chưa trả quá 24 giờ: huỷ (payment-timeout), mở bán lại hàng, lịch sử "Hệ thống: Quá 24 giờ chưa nhận được chuyển khoản" (theo luật 1.8a) |
| Đối chiếu cổng thẻ | 2 phút | Như 8.9 |
| Tin chat bị bỏ dở | 1 phút | Như 8.12 |
| Dọn dẹp | 1 giờ | Phiên và mã đặt lại mật khẩu hết hạn; Idempotency-Key quá 24 giờ; file mồ côi quá 24 giờ; kiểm tra ổ đầy |
| Sao lưu | 2 giờ sáng, cron của mini PC | Như mục 11 |

- Việc chạy bằng `node-cron` ngay trong backend. Mỗi việc bọc trong khoá tên `GET_LOCK` của MySQL, nên nếu sau này chạy hai server thì cũng chỉ một cái làm.
- Việc nào lỗi thì ghi log và lần sau chạy lại. Mọi việc đều **làm lại nhiều lần vẫn ra đúng**.

### 8.18 Nhật ký admin

Mọi thao tác admin làm thay đổi dữ liệu đều được ghi lại:
- **Phạm vi**: đơn, thanh toán, hoàn tiền (ai bấm), đóng sự cố tiền; khoá tài khoản, đổi quyền, đổi hạng; feed; cài đặt.
- **Nội dung mỗi dòng**: ai, lúc nào, làm gì, với cái gì, từ IP nào.

Không có API nào sửa hay xoá nhật ký.

## 9. Bảo mật

| Mối nguy | Cách chặn |
| --- | --- |
| Nghe lén đường truyền | Bắt buộc HTTPS (Caddy tự lo chứng chỉ), bật HSTS; `helmet` thêm header an toàn |
| Mini PC bị tấn công từ internet | Router chỉ mở cổng 80 và 443. MySQL và backend chỉ nằm trong mạng nội bộ của Docker, không mở ra ngoài. SSH chỉ dùng trong mạng nhà, đăng nhập bằng khoá. Bật tường lửa (ufw), tự cài bản vá bảo mật, fail2ban |
| Lấy sai IP khách (giới hạn tần suất vô tác dụng) | Backend chỉ tin IP do Caddy chuyển vào (đúng một lớp proxy) |
| Request quá lớn | Caddy giới hạn 1 MB cho API, riêng đường tải file 100 MB |
| Trang lạ gọi API bằng quyền của khách | Web và API cùng tên miền; cookie `SameSite=Lax`; kiểm tra `Origin` |
| Dữ liệu độc hại gửi lên | Mọi body, query, params đều kiểm tra bằng Zod |
| SQL injection | Truy vấn qua Drizzle, luôn truyền tham số |
| Xem dữ liệu của người khác | Kiểm tra quyền mỗi request; đơn, cuộc chat, địa chỉ của người khác trả 404 |
| Lộ trường mật khi thêm cột mới | Dữ liệu trả về luôn đi qua hàm chọn trường (DTO) |
| Dò mật khẩu, dò email | argon2id; giới hạn số lần thử; khoá tạm; câu báo lỗi không lộ email có tài khoản |
| Mất token | Access token sống 15 phút; refresh token nằm trong cookie `httpOnly`, xoay vòng, phát hiện dùng lại |
| Lộ số tài khoản ngân hàng | Mã hoá AES-256-GCM; không có API nào cho admin đọc; không ghi log |
| Dữ liệu thẻ | Không bao giờ chạm số thẻ (SAQ A); kiểm tra chữ ký IPN; đối chiếu số tiền; xử lý idempotent |
| Gọi dồn, spam | Giới hạn tần suất: đăng nhập, đăng ký, quên mật khẩu, đặt hàng, đặt giá, chat, liên hệ, tải file, `/api/chat-bot` |
| File độc hại | Kiểm tra nội dung thật; không nhận SVG; xoá EXIF; đặt tên file ngẫu nhiên; Caddy trả file với đúng loại, không cho chạy |
| Lạm dụng kênh realtime | Tối đa 20 kết nối mỗi IP; ping 30 giây, đóng kết nối im lặng; xác thực bằng tin nhắn đầu (token không nằm trên URL); sự kiện không có tên người đặt, phiên kín không có giá |
| Log chứa dữ liệu nhạy cảm | Log JSON có mã request; che `authorization`, `cookie`, mật khẩu, token, số tài khoản |
| Lộ chi tiết lỗi | Lỗi 500 chỉ trả câu chung chung; chi tiết chỉ nằm trong log |
| Lộ khoá bí mật | Khoá chỉ nằm trong `deploy/.env` trên mini PC (chỉ tài khoản quản trị máy đọc được, không commit lên git), không bao giờ đặt tên `VITE_`; thiếu biến thì server không khởi động |
| Mất máy, hỏng ổ | Sao lưu mỗi đêm ra ổ ngoài và một nơi khác. Cất thêm một bản `.env` (có khoá mã hoá) ở nơi an toàn ngoài máy, vì thiếu khoá thì không đọc lại được số tài khoản đã mã hoá |
| Cúp điện | Bộ lưu điện (UPS); BIOS đặt tự bật máy khi có điện lại; Docker tự chạy lại; InnoDB tự phục hồi sau khi tắt đột ngột |
| Thư viện có lỗ hổng | Chạy `npm audit` khi build; cập nhật thư viện định kỳ |

## 10. Kiểm thử

| Loại | Thử cái gì |
| --- | --- |
| Unit | Tính tiền, mã giảm giá, chuyển trạng thái, luật đấu giá (giá tối thiểu, chống bắn tỉa, phiên kín), lên hạng, cấp mã BK và mã đơn, chữ ký từng cổng (theo ví dụ trong tài liệu của cổng), hàm chọn trường không lộ trường mật |
| Tích hợp (API + MySQL thật) | Từng API: dữ liệu đúng; dữ liệu sai (422 kèm lỗi từng ô); chưa đăng nhập (401); sai quyền (403/404) |
| Tranh chấp | 20 đơn cùng lúc vào một con: đúng 1 thành công. 20 lượt đặt giá cùng lúc: giá cuối đúng. IPN tới đúng lúc việc dọn giữ hàng đang chạy |
| Thanh toán | IPN sai chữ ký, gửi lặp, sai số tiền; khách trả trễ khi hàng còn (giữ đơn) và khi hàng đã bán (mở đúng một sự cố tiền, **không có lệnh hoàn nào**); trả trùng; chỉ admin gọi được API hoàn tiền |
| Realtime | Người xem khác nhận đúng giá mới (phiên mở), không nhận giá (phiên kín), nhận giờ kết thúc mới khi gia hạn, nhận "bạn bị vượt giá" |
| Bảo mật | Sửa token; dùng lại refresh token; `Origin` lạ; file giả làm ảnh; gọi dồn |
| Toàn trình (Playwright) | Chạy cả bộ Caddy + backend + MySQL, build web với `VITE_USE_MOCK=false`, chạy lại các bộ test đang có: thanh toán (35 + 19 + 18 bước), feed, trang chi tiết, admin feed, chat |
| Cài đặt | Chạy thử `docker compose up` từ repo sạch, đúng như trên mini PC; thử sao lưu rồi khôi phục |

Môi trường làm việc của mình cài được MySQL 8, nên test chạy trên CSDL thật, không dùng CSDL giả.

## 11. Chạy ở máy, cài trên mini PC, sao lưu

**Biến môi trường** (`deploy/.env.example`, không có giá trị thật):

```
PUBLIC_ORIGIN=https://tdbakugan.vn     # tên miền của shop
NODE_ENV, LOG_LEVEL
MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
JWT_SECRET                             # tối thiểu 32 byte ngẫu nhiên
BANK_DATA_KEY                          # 32 byte, mã hoá số tài khoản ngân hàng
GEMINI_API_KEY, GEMINI_MODEL
UPLOAD_DIR=/srv/tdbakugan/uploads
MAIL_DRIVER=console|smtp|resend        # + SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM, SHOP_NOTIFY_EMAIL
PAYMENT_GATEWAY=mock|onepay|vnpay      # + khoá của cổng đã chọn
```

Các khoá ngẫu nhiên sinh bằng một lệnh có sẵn trong hướng dẫn, không tự nghĩ ra.

**Chạy ở máy (phát triển)**: bật MySQL, rồi `npm run db:migrate`, `npm run db:seed:dev`, `npm run dev`.

**Cài trên mini PC** (giai đoạn 1 có file `deploy/HUONG-DAN.md` từng bước):
1. Cài Ubuntu Server 24.04 LTS, Docker, git. Bật tường lửa và tự cập nhật bản vá.
2. Đặt IP nội bộ cố định cho mini PC trong router.
3. Router: chuyển cổng (port forwarding) 80 và 443 về mini PC. Không mở cổng nào khác.
4. Tên miền: trỏ bản ghi A về IP công khai. IP hay đổi thì bật DDNS (router có sẵn, hoặc chương trình nhỏ chạy trên mini PC) để tên miền tự trỏ theo.
5. `git clone` repo về `/srv/tdbakugan/app`, tạo `deploy/.env` từ `.env.example`.
6. `docker compose up -d`: Caddy tự xin chứng chỉ HTTPS, backend tự chạy migration.
7. Mở `https://<tên miền>/api/health` để kiểm tra; tạo tài khoản admin bằng `admin:create`.

**Cập nhật bản mới**: `git pull`, rồi `docker compose up -d --build`. Migration tự chạy; dữ liệu và ảnh giữ nguyên.

**Sao lưu** (cron của mini PC, 2 giờ sáng mỗi ngày):
1. `mysqldump --single-transaction` (không khoá web) rồi nén lại.
2. Đồng bộ thư mục ảnh/video.
3. Chép cả hai ra **ổ cứng ngoài / USB gắn vào mini PC** và **một nơi ngoài nhà** (VD Google Drive qua `rclone`), để cháy nổ hay mất máy vẫn còn bản sao.
4. Giữ 14 bản gần nhất theo ngày và 8 bản theo tuần.
5. Mỗi tháng thử khôi phục vào một CSDL tạm để chắc bản sao lưu dùng được.

**Theo dõi**:
- Một dịch vụ miễn phí (VD UptimeRobot) gọi `/api/health` 5 phút một lần, báo qua email hoặc Telegram khi web sập.
- Ổ đầy quá 90% thì báo admin.

**Chuyển từ Vercel sang mini PC**: Vercel giữ bản demo tới khi mini PC chạy ổn. Sau đó trỏ tên miền về mini PC. Bản Vercel có thể xoá, hoặc để làm bản xem thử.

> **Lưu ý**: dữ liệu demo hiện nằm trong trình duyệt (localStorage) nên **không chuyển sang được**. Bản thật bắt đầu trống, bạn đăng feed thật. Bản thử thì có dữ liệu mẫu để test.

## 12. Thay đổi ở frontend

Chi tiết ở [00 §10](00-tong-hop-nhu-cau.md#10-frontend-còn-thiếu-hoặc-cần-sửa-nhỏ-khi-nối-backend). Tất cả chỉ có tác dụng khi `VITE_USE_MOCK=false`, nên bản đang chạy không đổi:

1. Tự gia hạn phiên khi gặp 401 (gọi `/auth/refresh` một lần rồi gửi lại request). Refresh token không còn nằm trong localStorage.
2. Gọi `GET /auth/me` khi mở web; đăng xuất thì gọi server.
3. Trang đặt lại mật khẩu `/dat-lai-mat-khau`.
4. Gửi `Idempotency-Key` khi đặt hàng.
5. Chat: lưu và gửi `X-Chat-Token` cho khách vãng lai; lượt bot gọi `bot-turn`.
6. Gọi `/api/chat-bot` kèm token đăng nhập (khi chạy dữ liệu thật, chỉ admin được dùng để "Thử bot").
7. Ghi chú nội bộ dùng trường `internalNote` riêng.
8. Tách hàm tính tiền và phần chữ của luật đấu giá ra file dùng chung.
9. Trang đấu giá: nhận giờ kết thúc mới và cờ "bạn đang dẫn đầu" từ sự kiện realtime; phiên kín nhận biết lượt đặt mới qua số lượt, không qua số tiền.
10. Build cho mini PC: `VITE_API_BASE_URL=/api`, `VITE_WS_URL=wss://<tên miền>/ws`. Tới giai đoạn 9 mới đặt `VITE_USE_MOCK=false`.
11. Trang cài đặt bot: câu hướng dẫn sửa lỗi Gemini đang bảo "thêm biến trong Vercel rồi Redeploy". Đổi thành hướng dẫn cho mini PC (sửa `deploy/.env` rồi chạy lại). Làm ở giai đoạn 1.
12. Sự cố tiền (giai đoạn 5): trang đơn của khách hiện câu "liên hệ shop" kèm nút chat khi đơn có cờ `needsShopContact`; trang Sự cố thêm nhãn người báo "Hệ thống".
13. Đã làm trong lần sửa [03](03-khong-tu-hoan-tien-va-o-tu-dien.md): tên, hệ, tình trạng là ô chữ tự gõ; bỏ G-Power; điều khoản và câu nhắc admin ghi rõ "hệ thống không tự hoàn tiền".

## 13. Lộ trình

| GĐ | Làm gì | Xong khi |
| --- | --- | --- |
| 1 | **Khung backend + chạy trên mini PC + Gemini**: Express + TS, biến môi trường, log, lỗi chuẩn, `/api/health`; MySQL (schema, migration, dữ liệu mẫu); code dùng chung; `/api/chat-bot` chạy trong backend (kèm sửa câu hướng dẫn lỗi Gemini cho mini PC); Docker Compose (Caddy + backend + MySQL); hướng dẫn cài mini PC từng bước | Chạy `docker compose up` từ repo sạch là có web (vẫn dữ liệu giả lập) qua HTTPS, bot trả lời bằng Gemini; test xanh |
| 2 | **Tài khoản**: đăng ký, đăng nhập, phiên, đăng xuất, hồ sơ, sổ địa chỉ, tài khoản ngân hàng (mã hoá), đổi và quên mật khẩu, tạo admin. Web: tự gia hạn phiên, trang đặt lại mật khẩu | Đăng nhập thật trên web chạy với backend |
| 3 | **Feed và kho**: feed, từng con, tìm kiếm; admin feed và từng con; tải ảnh/video lưu trên ổ máy | Trang chủ, feed, trang chi tiết, admin đăng feed chạy bằng backend |
| 4 | **Đơn hàng**: cấu hình thanh toán, mã giảm giá, đặt hàng chống bán trùng, đơn của khách, admin đơn / tạo đơn / sự cố, tự lên Lv2 khi đủ 3 con, tự huỷ chuyển khoản 24 giờ | 20 đơn tranh một con: đúng 1 thành công; test đặt hàng (không thẻ) xanh |
| 5 | **Thẻ**: khuôn cổng, cổng giả lập ở server, IPN, quay về, đối chiếu, giữ hàng 15 phút; trả trễ / trả trùng thành sự cố tiền cho admin; hoàn tiền chỉ khi admin bấm. Cổng thật khi có hợp đồng | Bộ test thanh toán thẻ (35 + 19 + 18) xanh với backend |
| 6 | **Hạng thành viên và đấu giá**: đặt giá có khoá dòng, chống bắn tỉa, phiên kín không lộ giá, kênh realtime WebSocket, API tạo/sửa phiên | Test tranh đặt giá và test realtime xanh |
| 7 | **Chat và trợ lý AI** trên server: mã bí mật cho khách vãng lai, lượt bot, trả lời tin bị bỏ dở | Bộ test chat khách vãng lai và bot xanh |
| 8 | **Báo cáo và phần còn lại**: số trên menu, blog, liên hệ, nhận tin, cài đặt, nhật ký admin | Trang tổng quan admin chạy bằng backend |
| 9 | **Chuyển sang dữ liệu thật trên mini PC**: build web với `VITE_USE_MOCK=false`; chạy lại toàn bộ Playwright; bật sao lưu tự động và thử khôi phục; bật theo dõi; rồi mới mở cho khách | Toàn bộ test xanh; khôi phục thử thành công |

Mỗi giai đoạn gồm:
- Code, kiểm thử, và một file MD mới trong `backend/docs/` (số kế tiếp).
- Commit và push lên nhánh làm việc.
- Chạy lại các bộ test Playwright ở chế độ giả lập để chắc bản đang chạy không hỏng.
- Trên mini PC, lấy bản mới bằng `git pull` và `docker compose up -d --build`.

## 14. Rủi ro

| Rủi ro | Cách xử lý |
| --- | --- |
| Nhà mạng dùng CGNAT hoặc chặn cổng 80/443, nên mở cổng không có tác dụng | Kiểm tra trước (mục 1.5); gọi nhà mạng xin IP công khai hoặc IP tĩnh |
| IP nhà mạng thay đổi | DDNS tự cập nhật tên miền theo IP mới |
| Cúp điện, rớt mạng | UPS; máy tự bật và tự chạy lại dịch vụ; theo dõi báo ngay khi sập. Mạng nhà rớt thì web tạm ngưng, chấp nhận được ở quy mô hiện tại |
| Hỏng ổ, mất máy | Sao lưu mỗi đêm ra ổ ngoài và một nơi khác; thử khôi phục hằng tháng |
| Mạng nhà có tốc độ tải lên thấp, ảnh/video chậm khi đông khách | Ảnh đã nén WebP (vài trăm KB); video nên ngắn. Nếu cần, sau này đặt thêm CDN phía trước mini PC |
| Hợp đồng cổng thẻ mất nhiều tuần; cổng có thể đòi IP tĩnh | Cổng giả lập chạy trọn luồng; xin IP tĩnh khi bật thẻ thật |
| Khách trả tiền đúng lúc đơn bị huỷ vì quá hạn | Chờ thêm khi khách còn ở trang cổng; trả trễ mà hàng còn thì giữ đơn, hàng đã bán thì mở sự cố tiền để admin liên hệ khách; đối chiếu với cổng định kỳ |
| Dữ liệu demo không chuyển sang bản thật | Bản thật bắt đầu trống, bạn đăng feed thật; bản thử dùng dữ liệu mẫu |
| Hoàn tiền đơn chuyển khoản mà admin không xem được số tài khoản khách | Tạm thời shop liên hệ khách. Sau này có thể nối dịch vụ chi hộ, hoặc dịch vụ tự xác nhận chuyển khoản (SePay, Casso) |
