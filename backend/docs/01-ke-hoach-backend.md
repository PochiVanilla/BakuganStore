# 01 · Kế hoạch backend Express + TypeScript

| Mục | Nội dung |
| --- | --- |
| Ngày | 29/09/2026 |
| Giai đoạn | 0 — Lập kế hoạch. **Chưa viết code.** |
| Trạng thái | **Chờ chủ shop duyệt** |
| Dựa trên | [00 · Tổng hợp nhu cầu](00-tong-hop-nhu-cau.md) |
| Sau khi duyệt | Làm lần lượt từ giai đoạn 1. Xong giai đoạn nào thì báo kết quả kèm một file MD mới (`02-…`, `03-…`). Chỗ nào phải đổi thiết kế thì hỏi trước |

## Tóm tắt

- **Backend**: Express 5 + TypeScript, cơ sở dữ liệu PostgreSQL, chạy một server ở Singapore (gần Việt Nam). Web trên Vercel giữ nguyên, chỉ đổi chỗ lấy dữ liệu.
- **Dùng chung code với web**: kiểu dữ liệu, hàm tính tiền, kiểm tra form, luật chuyển trạng thái đơn, luật bot. Nhờ vậy web và server không bao giờ tính lệch nhau.
- **Chống bán trùng**: khi đặt hàng, server khoá đúng những con Bakugan trong đơn ngay trong CSDL. Ai tới sau phải chờ rồi nhận câu "vừa có người chốt trước" (mục 8.6). Đặt giá đấu giá dùng cách tương tự, và báo realtime cho người đang xem qua WebSocket (mục 8.11).
- **Thẻ**: làm trước một cổng giả lập ngay trên server để chạy trọn luồng và test. Cổng thật (OnePay hoặc VNPAY) chỉ là thêm một file, cắm vào khi có hợp đồng (mục 8.9).
- **Web đang chạy không bị ảnh hưởng**: `master` vẫn chạy bản giả lập cho tới giai đoạn cuối. Mọi bộ test Playwright hiện có phải vẫn xanh sau mỗi giai đoạn.
- **9 giai đoạn**, mỗi giai đoạn có kiểm thử và một file MD (mục 13).
- **Để bắt đầu** chỉ cần bạn duyệt kế hoạch và trả lời 3 câu ở mục 1.7. Các lựa chọn dịch vụ (1.2–1.6) quyết dần cũng được, vì giai đoạn đầu mình chạy mọi thứ ngay trên máy.

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
11. [Chạy ở máy và triển khai](#11-chạy-ở-máy-và-triển-khai)
12. [Thay đổi ở frontend](#12-thay-đổi-ở-frontend)
13. [Lộ trình](#13-lộ-trình)
14. [Rủi ro](#14-rủi-ro)

---

## 1. Cần bạn quyết

| # | Việc | Mình đề xuất | Lựa chọn khác | Cần trước giai đoạn |
| --- | --- | --- | --- | --- |
| 1.1 | Cơ sở dữ liệu | **PostgreSQL**: giao dịch và khoá dòng chắc chắn, đúng thứ cần cho hàng độc nhất | MySQL | Bắt đầu |
| 1.2 | Nơi chạy backend + CSDL | **Railway, vùng Singapore**: server và Postgres ở chung một chỗ, một hoá đơn, khoảng 5–10 USD/tháng lúc đầu (giá có thể đổi, sẽ kiểm tra lại lúc deploy) | Render (Singapore); VPS (rẻ hơn nhưng tự lo cập nhật, sao lưu) | 9 |
| 1.3 | Kho ảnh và video | **Cloudflare R2**: 10 GB miễn phí, không tính phí khi khách tải ảnh | Cloudinary (có sẵn công cụ sửa ảnh, gói miễn phí nhỏ hơn); để file trên server (không khuyên) | 3 (ở máy dùng thư mục thay thế) |
| 1.4 | Gửi email (quên mật khẩu, báo đơn mới cho shop) | **Resend**: cần tên miền | Gmail SMTP: không cần tên miền, tối đa khoảng 500 thư/ngày | 2 (ở máy in email ra màn hình) |
| 1.5 | Tên miền | **Mua một tên miền** (VD `tdbakugan.vn`): web ở tên chính, backend ở `api.` | Chuyển `/api` qua Vercel (giới hạn dung lượng request, khó hơn với cookie) | 9 |
| 1.6 | Cổng thanh toán thẻ | **OnePay hoặc VNPAY**: cả hai nhận Visa/Mastercard/JCB phát hành ở nước ngoài. Bạn làm hồ sơ (doanh nghiệp hoặc hộ kinh doanh); trong lúc chờ, mình dùng cổng giả lập | 2C2P | 5 (không chặn việc khác) |
| 1.7 | Ba luật cần bạn xác nhận | **(a)** Đơn chuyển khoản quá 24 giờ chưa nhận tiền: tự huỷ **chỉ khi đơn còn "Chờ xác nhận"**; admin đã xác nhận thì để admin quyết<br>**(b)** Mã `TDNEW10` ("cho khách mới"): chỉ dùng cho **đơn đầu tiên** của mỗi tài khoản<br>**(c)** Khách trả thẻ trễ, sau khi đơn đã tự huỷ: hàng **còn** thì giữ đơn cho khách; hàng **đã bán cho người khác** thì tự hoàn tiền về thẻ | Bạn sửa luật nào cũng được | Bắt đầu |

## 2. Công nghệ

| Phần | Chọn | Vì sao |
| --- | --- | --- |
| Ngôn ngữ | TypeScript 5.9, chế độ strict (cùng bản với web) | Dùng chung kiểu dữ liệu với web |
| Môi trường chạy | Node.js 22 LTS (chạy được cả 24 LTS) | Bản hỗ trợ dài hạn |
| Web framework | Express 5.2 | Theo yêu cầu; bản 5 tự chuyển lỗi của hàm `async` về bộ xử lý lỗi |
| Cơ sở dữ liệu | PostgreSQL 16 trở lên | Giao dịch và khoá dòng (`FOR UPDATE`) để mỗi con chỉ bán một lần |
| Truy vấn | Drizzle ORM + `pg` | Viết gần với SQL, có kiểu TypeScript, khoá dòng dễ; migration là file SQL đọc được; không phải sinh code |
| Kiểm tra dữ liệu vào | Zod 4 (cùng bản với web) | Dùng lại schema form của web |
| Mật khẩu | argon2id | Chuẩn OWASP khuyên dùng |
| Token đăng nhập | `jose` (JWT) | Thư viện chuẩn, gọn |
| Ghi log | `pino` | Nhanh, dạng JSON, che được trường nhạy cảm |
| Bảo vệ HTTP | `helmet`, `cors`, `express-rate-limit` | Header an toàn, chỉ nhận web của shop, chặn gọi dồn |
| Xử lý ảnh | `sharp` + `file-type` | Kiểm tra đúng là ảnh, xoá thông tin ẩn (vị trí GPS), nén WebP |
| Kho file | S3 API (`@aws-sdk/client-s3`) → Cloudflare R2; ở máy dùng thư mục | Đổi nhà cung cấp không phải sửa code |
| Việc chạy nền | `node-cron` + khoá của PostgreSQL (advisory lock) | Chạy ngay trong server; nhiều server thì cũng chỉ một cái làm |
| Realtime | `ws` (WebSocket) + `LISTEN/NOTIFY` của PostgreSQL | Trang đấu giá đã chờ sẵn WebSocket; NOTIFY để mọi server cùng nhận sự kiện |
| Kiểm thử | Vitest + Supertest, PostgreSQL thật | Thử đúng như lúc chạy thật |
| Chạy dev / đóng gói | `tsx` (dev), `tsup` (ra một file chạy), Docker | Nhanh; đọc được code dùng chung với web |

## 3. Kiến trúc

```
 Khách / admin
      │
      ▼
 ┌─────────────────────┐
 │ Web React (Vercel)  │  như hiện nay
 │ tdbakugan.vn        │
 └─────────┬───────────┘
           │  HTTPS  /api/…   (JSON · token Bearer · cookie gia hạn phiên)
           │  WSS    /ws/auctions/:id   (realtime đấu giá)
           ▼
 ┌─────────────────────┐        ┌─────────────────┐
 │ Backend Express     │───────▶│ PostgreSQL      │
 │ api.tdbakugan.vn    │        └─────────────────┘
 │ Singapore           │───────▶ Kho file R2 ──▶ khách xem ảnh/video qua CDN
 │ + việc chạy nền     │───────▶ Gemini (trợ lý AI)
 │                     │───────▶ Email (Resend)
 │                     │◀──────▶ Cổng thẻ (chuyển trang + IPN)
 └─────────────────────┘
```

Mỗi request đi qua các bước:

1. Gắn mã request để tra log.
2. `helmet` (header an toàn) và CORS (chỉ nhận web của shop).
3. Đọc JSON, tối đa 100 KB (riêng tải ảnh 15 MB).
4. Giới hạn số lần gọi.
5. Đọc token, rồi tra người dùng trong CSDL. Nhờ vậy khoá tài khoản hay đổi quyền có hiệu lực ngay.
6. Kiểm tra dữ liệu vào bằng Zod. Sai thì trả 422 kèm lỗi từng ô.
7. Xử lý nghiệp vụ trong một transaction.
8. Chọn đúng những trường được phép trả về (DTO), bọc trong `{ data }`.
9. Có lỗi thì một chỗ xử lý chung trả `{ message, fieldErrors }`, không lộ chi tiết kỹ thuật.

## 4. Cấu trúc thư mục

```
backend/
├─ docs/                   tài liệu; mỗi lần làm thêm một file
├─ drizzle/                file migration SQL (sinh tự động, lưu trong git)
├─ src/
│  ├─ server.ts            mở cổng, tắt êm (xong request đang chạy rồi mới dừng)
│  ├─ app.ts               lắp middleware và các router
│  ├─ config/env.ts        đọc và kiểm tra biến môi trường; thiếu biến là không khởi động
│  ├─ db/                  schema bảng, kết nối, dữ liệu ban đầu
│  ├─ shared.ts            cửa ngõ duy nhất import code dùng chung với web
│  ├─ lib/                 lỗi chuẩn, log, mã hoá, id, giờ Việt Nam, phân trang
│  ├─ middleware/          request id, xác thực, quyền admin, kiểm tra dữ liệu,
│  │                       giới hạn tần suất, xử lý lỗi
│  ├─ modules/             mỗi module có routes.ts · service.ts · dto.ts · schemas.ts
│  │  ├─ auth/  users/  feeds/  items/  orders/  coupons/  payments/
│  │  ├─ membership/  auctions/  chat/  bot/  media/  content/
│  │  └─ admin/            đơn, khách, feed, từng con, đấu giá, báo cáo,
│  │                       sự cố, cài đặt, chat
│  ├─ payments/gateways/   mock.ts · onepay.ts · vnpay.ts (cùng một khuôn)
│  ├─ storage/             local.ts (ở máy) · s3.ts (R2)
│  ├─ mail/                console.ts (ở máy) · resend.ts · smtp.ts
│  └─ jobs/                bộ hẹn giờ + từng việc chạy nền
├─ test/                   unit/ · integration/ (PostgreSQL thật)
├─ scripts/                admin-create.ts, check-shared-imports.ts
├─ docker-compose.yml      PostgreSQL (+ MinIO thay R2) để chạy ở máy
├─ Dockerfile
├─ .env.example
└─ package.json · tsconfig.json · eslint.config.mjs
```

Backend có `package.json` riêng. Web (thư mục gốc) không đổi cách build; ESLint của web được dặn bỏ qua `backend/`.

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

- **Quy tắc**: file dùng chung không được import React, DOM hay dữ liệu giả. Có script tự kiểm tra, chạy trong bộ test.
- **Sửa nhỏ ở web, không đổi hành vi**: tách hàm tính tiền ra file riêng; tách phần chữ của luật đấu giá khỏi phần icon.
- **Đóng gói**: `tsup` gói luôn code dùng chung vào file chạy của backend. Docker build từ gốc repo vì cần cả `src/` lẫn `backend/`.

## 6. Cơ sở dữ liệu

**Quy ước chung**
- Tiền lưu `bigint` (đồng).
- Thời gian lưu `timestamptz` (UTC); khi gom theo ngày thì đổi sang giờ Việt Nam.
- Id dùng UUID v7 (xếp được theo thời gian). Web coi id là chuỗi nên không ảnh hưởng.
- Migration là file SQL trong git, tự chạy mỗi lần deploy.

### Tài khoản

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `users` | email, password_hash, full_name, phone, role, status, locked_reason, birthday, gender, member_level, level_source, level_up_at, deposit_balance, tags, admin_note, failed_logins, login_locked_until, last_login_at | Email duy nhất, không phân biệt hoa thường |
| `addresses` | user_id, label, receiver_name, phone, province, district, ward, street, is_default | Mỗi khách **tối đa một** địa chỉ mặc định (chỉ mục duy nhất một phần); tối đa 10 địa chỉ |
| `bank_accounts` | user_id, bank_name, account_holder, account_number_enc, account_last4, key_version | Số tài khoản **mã hoá AES-256-GCM** |
| `sessions` | user_id, family_id, token_hash, expires_at, revoked_at, replaced_by, remember, user_agent, ip | Chỉ lưu mã băm của refresh token |
| `password_resets` | user_id, token_hash, expires_at, used_at | Mã dùng một lần, sống 30 phút |

### Hàng

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `feeds` | number, title, caption, images, published_at, opens_at, lot_cost, supplier, created_by, retired_at | `number` duy nhất (lấy từ sequence); `retired_at` có giá trị = đã gỡ khỏi web |
| `items` | code, name, price, attribute, series, condition, condition_note, g_power, photos (≤3), video, status, sold_at, sold_via, order_id, sold_note, buyer_name, feed_id, position, feed_title_snapshot, feed_number_snapshot, search_text | `code` duy nhất; giá > 0; `sold` thì bắt buộc có giờ bán; `feed_id` trống = hàng tồn |
| `media` | storage_key, url, kind, mime, bytes, width, height, sha256, uploaded_by, in_use | Để chặn link lạ và dọn file thừa |

### Đơn hàng và thanh toán

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `orders` | code, user_id, customer_email, source, status, payment_method, payment_status, subtotal, shipping_fee, discount, total, coupon_code, receiver_name, phone, address_line, shipping_region, intl_address, **note** (khách), **internal_note** (admin), cancel_reason, cancel_note, auction_id | `code` duy nhất; tổng = max(0, tạm tính + ship − giảm) |
| `order_items` | order_id, item_id, auction_id, code, name, price, image | Bản chụp lúc mua |
| `order_events` | order_id, status, at, actor_type, actor_id, actor_name, note | Lịch sử đơn |
| `card_payments` | order_id, expires_at, attempts, brand, last4, transaction_id, paid_at, last_error, refunded_at | Một đơn một dòng; **không có số thẻ** |
| `payment_attempts` | order_id, gateway, amount, status, gateway_txn_id, brand, last4, response_code, message, finished_at | Id là mã giao dịch gửi cổng |
| `payment_events` | gateway, event_key, attempt_id, payload (đã bỏ trường nhạy cảm), signature_ok, result | `event_key` duy nhất: cổng gửi lặp cũng chỉ xử lý một lần |
| `refunds` | order_id, attempt_id, amount, status, gateway_refund_id, requested_by, error | Mỗi đơn chỉ một lệnh hoàn đang chạy hoặc đã xong |
| `order_issues` | order_id, type, status, description, reported_by, resolution | Sự cố đơn hàng |
| `idempotency_keys` | key, user_id, route, request_hash, response | Duy nhất theo (key, user); giữ 24 giờ |

### Khuyến mãi, thành viên, đấu giá

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `coupons` | code, label, type, value, min_subtotal, max_discount, starts_at, expires_at, active, first_order_only, per_user_limit, total_limit, used_count | `code` lưu chữ hoa, duy nhất |
| `coupon_redemptions` | coupon_code, order_id, user_id, released_at | Một đơn dùng tối đa một mã; đơn huỷ thì trả lượt |
| `membership_requests` | user_id, kind, amount, transfer_note, message, status, resolved_at, resolved_by, admin_note | Mỗi khách tối đa một yêu cầu đang chờ |
| `auctions` | slug, title, description, images, attribute, series, g_power, condition, accessories, start_price, current_price, bid_step, buy_now_price, start_at, end_at, original_end_at, price_visibility, anti_snipe_minutes, extension_count, bid_count, leader_id, watcher_count | `slug` duy nhất |
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
- Đọc được tham số mảng dạng `attributes[]=…` lẫn `attributes=a,b`.
- **API mới** (web chưa gọi, thêm dần theo giai đoạn):

| Nhóm | API |
| --- | --- |
| Tài khoản | `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/reset-password` |
| Chat | `POST /chat/conversations/:id/bot-turn` · `POST /admin/chat/bot/preview` · `POST /admin/chat/bot/test` · `GET /admin/chat/bot/status` |
| Tải file | `POST /admin/uploads/video-url` · `POST /admin/uploads/complete` |
| Thanh toán | `GET\|POST /payments/card/ipn/:gateway` · `GET /payments/card/return/:gateway` |
| Realtime | WebSocket `/ws/auctions/:id` (web đặt `VITE_WS_URL=wss://api.…/ws`) |
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
2. Tài khoản có thật và đang hoạt động: tạo mã 32 byte (lưu mã băm, sống 30 phút, huỷ mã cũ), gửi link `https://<web>/dat-lai-mat-khau?token=…`.
3. Giới hạn 3 thư/giờ mỗi email và 10 thư/giờ mỗi IP.

**Đặt lại mật khẩu**: mã đúng, chưa dùng, còn hạn thì đặt mật khẩu mới (kiểm tra như form), đánh dấu mã đã dùng, thu hồi mọi phiên.

**Tạo admin**: lệnh `npm run admin:create` hỏi email và mật khẩu ngay trong terminal. Không có tài khoản admin nào nằm trong code hay dữ liệu ban đầu của bản thật.

### 8.2 Hồ sơ, sổ địa chỉ, tài khoản ngân hàng

- **Hồ sơ**: email mới không được trùng người khác (409).
- **Sổ địa chỉ** (trong một transaction):
  - Luôn có **đúng một** địa chỉ mặc định. Thêm hoặc sửa có chọn mặc định thì bỏ mặc định cũ.
  - Xoá địa chỉ mặc định thì địa chỉ đầu tiên còn lại thành mặc định.
  - Chỉ mục duy nhất một phần bảo đảm không bao giờ có hai địa chỉ mặc định.
- **Tài khoản ngân hàng**:
  - Số tài khoản mã hoá AES-256-GCM. Khoá `BANK_DATA_KEY` nằm trong biến môi trường, có số phiên bản để đổi khoá về sau.
  - Lưu riêng 4 số cuối để hiển thị.
  - API, kể cả với chính chủ, chỉ trả `•••• 1234`. Admin chỉ thấy tên ngân hàng và tên chủ tài khoản.
  - Không bao giờ ghi số tài khoản vào log.

### 8.3 Feed và tìm kiếm (phía khách)

- **Đọc feed**: lấy các feed chưa gỡ cùng các con, số feed giảm dần. Trạng thái feed và "đặt mua được" tính theo `now()` của CSDL, một đồng hồ chung cho mọi server.
- **Chọn trường công khai**: không lộ người mua, đơn, giá nhập, nhà cung cấp.
- **Bộ nhớ đệm**: danh sách feed đệm vài giây vì trang chủ gọi nhiều; xoá đệm ngay khi có đơn mới hoặc admin sửa feed.
- **Tìm kiếm**:
  - Cột `search_text` lưu sẵn tên + mã + mã viết liền, đã bỏ dấu bằng đúng hàm `normalizeSearch` của web.
  - Truy vấn `search_text LIKE '%từ khoá đã bỏ dấu%'`, lọc thêm hệ, tình trạng, khoảng giá; tối đa 60 kết quả.
  - Dữ liệu nhỏ (tối đa 30 feed × 60 con) nên chưa cần công cụ tìm kiếm riêng.
- `by-ids` nhận tối đa 100 id mỗi lần (một feed có tới 60 con).

### 8.4 Admin quản lý feed và từng con

**Đăng feed mới**
1. Kiểm tra dữ liệu theo luật ở [00 §6.1](00-tong-hop-nhu-cau.md#61-feed-và-từng-con-bakugan).
2. Mọi ảnh và video phải là file đã tải lên kho của shop (có trong bảng `media`), nên không ai chèn được link lạ.
3. Chạy trong transaction, giữ khoá chung "đăng feed" để hai admin bấm cùng lúc cũng không vượt 30 feed:
   1. Đếm feed đang có. Đủ 30 mà không gửi đúng `replaceFeedId` của feed cũ nhất thì trả 409 kèm thông tin feed sẽ bị xoá (như bản giả lập).
   2. Có thay thế: gỡ feed cũ nhất. Con chưa bán thành hàng tồn (ghi lại tên và số feed); con đã bán giữ lịch sử.
   3. Cấp số feed từ sequence.
   4. Xếp các con theo thứ tự form, rồi tới các con mang sang từ feed bị xoá.
      - Con đã có: phải tồn tại, không thuộc feed khác; con đã bán giữ nguyên giá.
      - Con mới: cấp mã theo cách bên dưới.
   5. Đánh dấu file đang dùng. File không còn dùng được xoá khỏi kho **sau khi** transaction thành công.

**Cấp mã Bakugan**
- Admin tự gõ: chuẩn hoá bằng `normalizeItemCode`; trùng thì 409.
- Bỏ trống: lấy số kế tiếp từ sequence, bỏ qua những số admin đã gõ tay.
- Chỉ mục duy nhất trên `code` là chốt chặn cuối cùng.

**Sửa feed**: như đăng mới nhưng không có bước giới hạn 30 feed. Đổi tên feed thì các con đã bán trong feed cũng đổi tên feed theo.

**Xoá feed**: gỡ feed như bước 3.2, trả về số con thành hàng tồn.

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
4. BEGIN
   a. SELECT các con + feed của chúng
        WHERE id IN (…) ORDER BY id FOR UPDATE
      → Khoá đúng những con này; ai đặt trùng con phải đứng chờ.
        Khoá theo thứ tự id nên hai đơn tranh nhau không bao giờ kẹt nhau (deadlock).
   b. Con nào không còn, đã bán, hoặc feed đã gỡ → ROLLBACK, 409 "BK-xxxx vừa có người chốt trước…"
      Feed chưa tới giờ mở bán (so với now() của CSDL) → 409.
   c. Tính tiền bằng calculateTotals (giá lấy từ CSDL). Kiểm tra mã giảm giá;
      mã có giới hạn lượt thì khoá luôn dòng mã.
   d. Sinh mã đơn TDddmm + 1 chữ + 2 số; trùng thì sinh lại (chỉ mục duy nhất bảo đảm).
   e. Ghi đơn, các dòng hàng (chụp lại tên, mã, giá, ảnh), mốc lịch sử đầu tiên.
      Đơn thẻ: ghi card_payments với hạn giữ = now() + 15 phút.
   f. UPDATE items SET status = 'sold', sold_via = 'order', order_id = …, sold_at = now()
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
  - Lượt đã đóng mà cổng vẫn báo trừ tiền thành công thì tự hoàn tiền (8.9).

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
- **Thanh toán**: đơn thẻ không đánh dấu tay được. Hoàn tiền thẻ đi theo 8.9.
- **Ghi chú nội bộ**: lưu vào trường riêng `internal_note`, không đè ghi chú của khách nữa.
- **Tạo đơn tay**:
  - Server tự tra từng con (còn bán, không chọn trùng) và khoá dòng như 8.6. Giá admin nhập là số nguyên ≥ 0.
  - Đơn cho người thắng đấu giá: phiên đã kết thúc, có người thắng, chưa tạo đơn. Chỉ mục duy nhất trên `auction_fulfillments` chặn tạo đơn hai lần.
- **Sự cố**: tạo và sửa; muốn đóng sự cố phải ghi cách giải quyết.

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
3. `returnUrl` phải thuộc tên miền web của shop, để không bị lợi dụng chuyển khách sang trang lạ.
4. Tạo lượt thanh toán mới:
   - Số tiền = tổng đơn **trong CSDL**.
   - Tăng số lần thử; đóng các lượt cũ còn đang mở.
5. Gọi cổng lấy link trả tiền. Nếu cổng hỗ trợ, cho link hết hạn cùng lúc với hạn giữ hàng.
6. Trả `{ redirectUrl }`.

**Cổng báo kết quả, IPN** (`/payments/card/ipn/:gateway`, cổng gọi thẳng vào server)
1. Kiểm tra chữ ký bằng phép so sánh an toàn về thời gian. Sai thì trả lỗi theo chuẩn của cổng, không đổi gì, ghi log cảnh báo.
2. Ghi sự kiện với khoá duy nhất (cổng + mã giao dịch + kết quả). Cổng gửi lại lần hai thì trả "đã xử lý", không làm lại.
3. Trong transaction, khoá lượt thanh toán và đơn:
   - **Số tiền khác tổng đơn**: đánh dấu bất thường, báo admin, trả lỗi "sai số tiền".
   - **Lượt đã có kết quả**: trả "đã xác nhận".
   - **Thành công**:
     - Đơn còn chờ trả: chuyển "đã thanh toán". Lưu hãng thẻ, 4 số cuối, mã giao dịch, giờ trả; ghi lịch sử "Cổng thanh toán: Đã thanh toán … mã giao dịch …". Đơn vẫn "Chờ xác nhận" để shop gọi khách.
     - **Đơn đã tự huỷ vì quá hạn** (khách trả trễ):
       - Các con vẫn còn bán: giữ lại cho khách (chuyển SOLD lại, đơn về `pending` và đã trả), ghi lịch sử.
       - Có con đã bán cho người khác: **tự gửi lệnh hoàn tiền**, báo admin, ghi lịch sử.
     - Đơn đã trả bằng lượt khác (trả trùng), hoặc lượt này đã bị đóng (khách đổi sang COD): tự hoàn tiền lượt này.
   - **Thất bại**: ghi lỗi vào lần thử gần nhất, bằng câu tiếng Việt tương ứng mã lỗi của cổng.
4. Trả lời đúng định dạng cổng yêu cầu.

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

**Hoàn tiền** (admin bấm "Hoàn tiền về thẻ")
1. Đơn đã trả bằng thẻ và đã huỷ hoặc hoàn hàng.
2. Tạo lệnh hoàn. Chỉ mục duy nhất bảo đảm mỗi đơn chỉ một lệnh đang chạy hoặc đã xong, nên bấm hai lần cũng không hoàn hai lần.
3. Gọi cổng hoàn toàn bộ số tiền:
   - Thành công: đơn "đã hoàn tiền", ghi giờ hoàn và lịch sử.
   - Thất bại: báo lỗi cho admin, lệnh hoàn ghi "thất bại", bấm lại được.

**Đối chiếu** (mỗi 2 phút): lượt "đang chờ" quá 5 phút thì hỏi cổng, rồi xử lý như khi nhận IPN.

**Không lưu số thẻ ở bất cứ đâu**, log cũng không ghi dữ liệu thẻ. Web chỉ chuyển khách sang trang của cổng, nên shop thuộc diện PCI DSS **SAQ A**, mức nhẹ nhất.

### 8.10 Hạng thành viên

- `GET /me/membership` trả về:
  - Hạng hiện tại, số con đã nhận (đếm dòng hàng của đơn hoàn tất), mục tiêu 3 con.
  - Tiền đã nạp, yêu cầu đang chờ.
  - Nội dung chuyển khoản `TDLV2 <SĐT>` và tài khoản nhận tiền của shop.
- **Gửi yêu cầu**: chỉ khách Lv1 chưa có yêu cầu đang chờ (chỉ mục duy nhất một phần bảo đảm). Xin xét duyệt thì lời nhắn ≥ 10 ký tự.
- **Admin duyệt** (transaction): yêu cầu phải còn chờ. Yêu cầu nạp tiền thì cộng `deposit_balance`. Lên Lv2 với lý do "nạp tiền" hoặc "admin duyệt". Từ chối phải ghi lý do.
- **Tự lên Lv2** khi đơn hoàn tất (8.8, bước 4).

### 8.11 Đấu giá

**Dữ liệu gửi cho khách**
- Không có danh sách lượt đặt, không có tên người đặt.
- `bidderCount` là số người khác nhau đã đặt; `myBids` là lượt của chính người đang xem; kèm cờ `viewerIsLeading`.
- **Phiên kín chưa kết thúc: không gửi giá hiện tại** (thay bằng giá khởi điểm). Kết thúc rồi mới gửi giá chốt, đúng như giao diện: "Giá được giấu" trong lúc diễn ra, "Giá chốt" sau khi kết thúc.
- Trạng thái phiên tính theo `now()` của CSDL.

**Đặt giá** (`POST /auctions/:id/bids`)

```
1. Người đặt: khách, tài khoản hoạt động, hạng ≥ 2 (đọc lại từ CSDL). Tối đa 20 lượt/phút.
2. BEGIN; SELECT phiên FOR UPDATE
   → mọi lượt đặt của một phiên xếp hàng lần lượt
3. now() < giờ bắt đầu → 409 "chưa bắt đầu"; now() > giờ kết thúc → 409 "đã kết thúc"
4. min = phiên mở ? giá hiện tại + bước giá
                : max(giá khởi điểm, lượt cao nhất của chính mình + bước giá)
   amount < min → 422
   phiên kín và amount ≤ giá hiện tại → 422 "chưa vượt người dẫn đầu" (không nói giá)
   amount phải là số nguyên
5. Chống bắn tỉa: N > 0 và (giờ kết thúc − now) ≤ N phút
   → giờ kết thúc = now + N phút; số lần gia hạn + 1
6. Ghi lượt đặt; cập nhật phiên: giá hiện tại, số lượt, người dẫn đầu, giờ kết thúc
7. COMMIT → trả phiên (bản của người vừa đặt)
```

**Vì sao chắc chắn**: khoá dòng phiên nên hai người đặt cùng một giây thì người sau được so với giá mới nhất, và giờ gia hạn không bị ghi đè.

**Realtime** (WebSocket `/ws/auctions/:id`)

```
Kết nối:
1. Web mở wss://api.…/ws/auctions/:id.
2. Tin nhắn đầu tiên (không bắt buộc): { type: 'auth', token: <access token> }
   → server biết người đang xem là ai. Token không nằm trên URL nên không lọt vào log.
3. Server cho kết nối vào "phòng" của phiên; số người đang xem gửi gộp 10 giây một lần (watcher-count).
4. Ping 30 giây một lần, không trả lời thì đóng. Mỗi IP tối đa 20 kết nối.

Có lượt đặt mới (ngay sau COMMIT ở bước 7):
1. NOTIFY auction_events { auctionId } → mọi server đang chạy đều nhận (LISTEN).
2. Mỗi server đọc lại phiên một lần, rồi gửi cho từng kết nối trong phòng:
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
1. Khoá theo từng cuộc trò chuyện (advisory lock): hai lượt không chạy chồng nhau.
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

**Gemini**: chuyển nguyên logic của `api/chat-bot.ts` vào backend:
- Luật hệ thống viết cứng ở server; giới hạn độ dài mọi phần gửi lên.
- Thử lần lượt nhiều model; tối đa 8 lượt/phút mỗi IP; lỗi cấu hình thì tạm nghỉ gọi một lúc.
- Khoá `GEMINI_API_KEY` chỉ nằm trong biến môi trường của backend.

**Tin bị bỏ dở**: khách tắt web trước khi web gọi `bot-turn`. Việc chạy nền mỗi phút sẽ cho bot trả lời những tin khách đã chờ quá 60 giây.

**Admin**:
- Danh sách lọc theo "cần trả lời"; gửi tin (bot nhường lời); bật/tắt bot từng cuộc; đóng cuộc; đánh dấu đã đọc.
- Nút "Thử bot" và "Kiểm tra kết nối Gemini" gọi backend.

### 8.13 Tải ảnh và video

**Ảnh** (`POST /admin/uploads`, gửi dạng form, tối đa 15 MB)
1. Đọc vài byte đầu để biết **đúng là ảnh** (JPEG, PNG, WebP, AVIF, HEIC), không tin đuôi file hay Content-Type. Không nhận SVG vì có thể chứa mã độc.
2. `sharp` xoay đúng chiều, thu cạnh dài về tối đa 1600 px, xuất WebP, và **xoá toàn bộ thông tin ẩn** (EXIF, vị trí GPS nơi chụp).
3. Lưu vào kho ở `img/2026/09/<uuid>.webp`, cho trình duyệt cache 1 năm.
4. Ghi bảng `media` (chưa dùng), trả `{ url }`.

**Video** (tối đa 100 MB; tải thẳng lên kho, không đi qua server)
1. `POST /admin/uploads/video-url` gửi tên, dung lượng, loại file. Server kiểm tra (MP4, WebM hoặc MOV; ≤ 100 MB) rồi cấp link tải lên có chữ ký, sống 10 phút, khoá đúng loại và dung lượng.
2. Web tải thẳng file lên kho qua link đó.
3. `POST /admin/uploads/complete`: server kiểm tra file trong kho (dung lượng, vài byte đầu), ghi `media`, trả `{ url }`.

**Dọn file**
- File không còn feed hay con nào dùng thì xoá ngay sau khi lưu.
- File tải lên mà 24 giờ không dùng tới thì việc chạy nền xoá.

### 8.14 Báo cáo và số đếm trên menu admin

- Mọi số liệu tính bằng SQL gom nhóm, không kéo cả bảng về server. Ngày tính theo giờ Việt Nam (`AT TIME ZONE 'Asia/Ho_Chi_Minh'`).
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
| Hết hạn chuyển khoản | 10 phút | Đơn chuyển khoản `pending` chưa trả quá 24 giờ: huỷ (payment-timeout), mở bán lại hàng, lịch sử "Hệ thống: Quá 24 giờ chưa nhận được chuyển khoản" (theo luật 1.7a) |
| Đối chiếu cổng thẻ | 2 phút | Như 8.9 |
| Tin chat bị bỏ dở | 1 phút | Như 8.12 |
| Dọn dẹp | 1 giờ | Phiên và mã đặt lại mật khẩu hết hạn; Idempotency-Key quá 24 giờ; file mồ côi quá 24 giờ |

- Việc chạy bằng `node-cron` ngay trong server. Mỗi việc bọc trong khoá `pg_try_advisory_lock`, nên chạy nhiều server cũng chỉ một cái làm.
- Việc nào lỗi thì ghi log và lần sau chạy lại. Mọi việc đều **làm lại nhiều lần vẫn ra đúng**.

### 8.18 Nhật ký admin

Mọi thao tác admin làm thay đổi dữ liệu đều được ghi lại:
- **Phạm vi**: đơn, thanh toán, hoàn tiền; khoá tài khoản, đổi quyền, đổi hạng; feed; cài đặt.
- **Nội dung mỗi dòng**: ai, lúc nào, làm gì, với cái gì, từ IP nào.

Không có API nào sửa hay xoá nhật ký.

## 9. Bảo mật

| Mối nguy | Cách chặn |
| --- | --- |
| Nghe lén đường truyền | Bắt buộc HTTPS, bật HSTS; `helmet` thêm header an toàn |
| Trang lạ gọi API bằng quyền của khách | CORS chỉ nhận tên miền web của shop; cookie `SameSite=Lax`, kiểm tra `Origin` |
| Dữ liệu độc hại gửi lên | Mọi body, query, params đều kiểm tra bằng Zod; JSON tối đa 100 KB |
| SQL injection | Truy vấn qua Drizzle, luôn truyền tham số |
| Xem dữ liệu của người khác | Kiểm tra quyền mỗi request; đơn, cuộc chat, địa chỉ của người khác trả 404 |
| Lộ trường mật khi thêm cột mới | Dữ liệu trả về luôn đi qua hàm chọn trường (DTO) |
| Dò mật khẩu, dò email | argon2id; giới hạn số lần thử; khoá tạm; câu báo lỗi không lộ email có tài khoản |
| Mất token | Access token sống 15 phút; refresh token nằm trong cookie `httpOnly`, xoay vòng, phát hiện dùng lại |
| Lộ số tài khoản ngân hàng | Mã hoá AES-256-GCM; không có API nào cho admin đọc; không ghi log |
| Dữ liệu thẻ | Không bao giờ chạm số thẻ (SAQ A); kiểm tra chữ ký IPN; đối chiếu số tiền; xử lý idempotent |
| Gọi dồn, spam | Giới hạn tần suất: đăng nhập, đăng ký, quên mật khẩu, đặt hàng, đặt giá, chat, liên hệ, tải file |
| File độc hại | Kiểm tra nội dung thật; không nhận SVG; xoá EXIF; đặt tên file ngẫu nhiên |
| Lạm dụng kênh realtime | Tối đa 20 kết nối mỗi IP; ping 30 giây, đóng kết nối im lặng; xác thực bằng tin nhắn đầu (token không nằm trên URL); sự kiện không có tên người đặt, phiên kín không có giá |
| Log chứa dữ liệu nhạy cảm | Log JSON có mã request; che `authorization`, `cookie`, mật khẩu, token, số tài khoản |
| Lộ chi tiết lỗi | Lỗi 500 chỉ trả câu chung chung; chi tiết chỉ nằm trong log |
| Lộ khoá bí mật | Khoá chỉ ở biến môi trường server, không bao giờ đặt tên `VITE_`; thiếu biến thì server không khởi động |
| Thư viện có lỗ hổng | Chạy `npm audit` khi build; cập nhật thư viện định kỳ |
| Mất dữ liệu | Sao lưu CSDL hằng ngày, thử khôi phục định kỳ |

## 10. Kiểm thử

| Loại | Thử cái gì |
| --- | --- |
| Unit | Tính tiền, mã giảm giá, chuyển trạng thái, luật đấu giá (giá tối thiểu, chống bắn tỉa, phiên kín), lên hạng, cấp mã BK và mã đơn, chữ ký từng cổng (theo ví dụ trong tài liệu của cổng), hàm chọn trường không lộ trường mật |
| Tích hợp (API + PostgreSQL thật) | Từng API: dữ liệu đúng; dữ liệu sai (422 kèm lỗi từng ô); chưa đăng nhập (401); sai quyền (403/404) |
| Tranh chấp | 20 đơn cùng lúc vào một con: đúng 1 thành công. 20 lượt đặt giá cùng lúc: giá cuối đúng. IPN tới đúng lúc việc dọn giữ hàng đang chạy |
| Thanh toán | IPN sai chữ ký, gửi lặp, sai số tiền; khách trả trễ khi hàng còn và khi hàng đã bán (phải tự hoàn tiền) |
| Realtime | Người xem khác nhận đúng giá mới (phiên mở), không nhận giá (phiên kín), nhận giờ kết thúc mới khi gia hạn, nhận "bạn bị vượt giá" |
| Bảo mật | Sửa token; dùng lại refresh token; CORS lạ; file giả làm ảnh; gọi dồn |
| Toàn trình (Playwright) | Build web với `VITE_USE_MOCK=false` trỏ vào backend ở máy, chạy lại các bộ test đang có: thanh toán (35 + 19 + 18 bước), feed, trang chi tiết, admin feed, chat |

Môi trường này có sẵn PostgreSQL 16 nên test chạy trên CSDL thật, không dùng CSDL giả.

## 11. Chạy ở máy và triển khai

**Biến môi trường** (`backend/.env.example`, không có giá trị thật):

```
NODE_ENV, PORT, WEB_ORIGIN, API_ORIGIN, LOG_LEVEL
DATABASE_URL
JWT_SECRET                     # tối thiểu 32 byte ngẫu nhiên
BANK_DATA_KEY                  # 32 byte, mã hoá số tài khoản ngân hàng
GEMINI_API_KEY, GEMINI_MODEL
STORAGE_DRIVER=local|s3        # + S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID,
                               #   S3_SECRET_ACCESS_KEY, MEDIA_PUBLIC_URL
MAIL_DRIVER=console|resend|smtp  # + RESEND_API_KEY hoặc SMTP_*, MAIL_FROM, SHOP_NOTIFY_EMAIL
PAYMENT_GATEWAY=mock|onepay|vnpay  # + khoá của cổng đã chọn
```

**Chạy ở máy**: bật PostgreSQL (`docker compose up` hoặc bản cài sẵn), rồi chạy `npm run db:migrate`, `npm run db:seed:dev`, `npm run dev`.

**Triển khai** (giai đoạn 9):
1. Tạo CSDL và dịch vụ backend ở Singapore; đặt biến môi trường.
2. Docker build từ gốc repo, chạy migration, khởi động server.
3. Kiểm tra `/api/health`.
4. Web: đặt `VITE_USE_MOCK=false` và `VITE_API_BASE_URL`, deploy **bản thử** (preview) trên Vercel, chạy Playwright. Test xanh mới đưa lên `master`.
5. Tạo tài khoản admin bằng `admin:create`.
6. Bật sao lưu hằng ngày và theo dõi (máy chủ còn sống không, log lỗi).

> **Lưu ý**: dữ liệu demo hiện nằm trong trình duyệt (localStorage) nên **không chuyển sang được**. Bản thật bắt đầu trống, bạn đăng feed thật. Bản thử thì có dữ liệu mẫu để test.

## 12. Thay đổi ở frontend

Chi tiết ở [00 §10](00-tong-hop-nhu-cau.md#10-frontend-còn-thiếu-hoặc-cần-sửa-nhỏ-khi-nối-backend). Tất cả chỉ có tác dụng khi `VITE_USE_MOCK=false`, nên bản đang chạy không đổi:

1. Tự gia hạn phiên khi gặp 401 (gọi `/auth/refresh` một lần rồi gửi lại request). Refresh token không còn nằm trong localStorage.
2. Gọi `GET /auth/me` khi mở web; đăng xuất thì gọi server.
3. Trang đặt lại mật khẩu `/dat-lai-mat-khau`.
4. Gửi `Idempotency-Key` khi đặt hàng.
5. Chat: lưu và gửi `X-Chat-Token` cho khách vãng lai; lượt bot gọi `bot-turn`.
6. Trang cài đặt bot: "Thử bot" và "Kiểm tra kết nối" gọi backend.
7. Ghi chú nội bộ dùng trường `internalNote` riêng.
8. Tải video qua link có chữ ký.
9. Tách hàm tính tiền và phần chữ của luật đấu giá ra file dùng chung.
10. Trang đấu giá: nhận giờ kết thúc mới và cờ "bạn đang dẫn đầu" từ sự kiện realtime; phiên kín nhận biết lượt đặt mới qua số lượt, không qua số tiền.

## 13. Lộ trình

| GĐ | Làm gì | Xong khi | File MD |
| --- | --- | --- | --- |
| 1 | **Khung dự án**: Express + TS, biến môi trường, log, lỗi chuẩn, `/api/health`, CSDL (schema, migration, dữ liệu mẫu), code dùng chung, bộ test | Server chạy; migration chạy trên PostgreSQL thật; test xanh | 02 |
| 2 | **Tài khoản**: đăng ký, đăng nhập, phiên, đăng xuất, hồ sơ, sổ địa chỉ, tài khoản ngân hàng (mã hoá), đổi và quên mật khẩu, tạo admin. Web: tự gia hạn phiên, trang đặt lại mật khẩu | Đăng nhập thật trên web chạy với backend ở máy | 03 |
| 3 | **Feed và kho**: feed, từng con, tìm kiếm; admin feed và từng con; tải ảnh/video (thư mục ở máy, R2 khi deploy) | Trang chủ, feed, trang chi tiết, admin đăng feed chạy bằng backend | 04 |
| 4 | **Đơn hàng**: cấu hình thanh toán, mã giảm giá, đặt hàng chống bán trùng, đơn của khách, admin đơn / tạo đơn / sự cố, tự lên Lv2 khi đủ 3 con, tự huỷ chuyển khoản 24 giờ | 20 đơn tranh một con: đúng 1 thành công; test đặt hàng (không thẻ) xanh | 05 |
| 5 | **Thẻ**: khuôn cổng, cổng giả lập ở server, IPN, quay về, đối chiếu, hoàn tiền, giữ hàng 15 phút. Cổng thật khi có hợp đồng | Bộ test thanh toán thẻ (35 + 19 + 18) xanh với backend | 06 |
| 6 | **Hạng thành viên và đấu giá**: đặt giá có khoá dòng, chống bắn tỉa, phiên kín không lộ giá, kênh realtime WebSocket, API tạo/sửa phiên | Test tranh đặt giá và test realtime xanh | 07 |
| 7 | **Chat và trợ lý AI** trên server: mã bí mật cho khách vãng lai, lượt bot, Gemini, trả lời tin bị bỏ dở | Bộ test chat khách vãng lai và bot xanh | 08 |
| 8 | **Báo cáo và phần còn lại**: số trên menu, blog, liên hệ, nhận tin, cài đặt, nhật ký admin | Trang tổng quan admin chạy bằng backend | 09 |
| 9 | **Nối web thật**: backend lên server, web bản thử trên Vercel; chạy lại toàn bộ Playwright; sao lưu, theo dõi; đưa lên `master` | Toàn bộ test xanh trên bản thử | 10 |

Mỗi giai đoạn gồm:
- Code, kiểm thử, file MD của giai đoạn.
- Commit và push lên nhánh làm việc.
- Chạy lại các bộ test Playwright ở chế độ giả lập để chắc bản đang chạy không hỏng.

## 14. Rủi ro

| Rủi ro | Cách xử lý |
| --- | --- |
| Hợp đồng cổng thẻ mất nhiều tuần | Cổng giả lập ở server chạy trọn luồng; cổng thật chỉ là thêm một file theo khuôn chung |
| Khách trả tiền đúng lúc đơn bị huỷ vì quá hạn | Chờ thêm khi khách còn ở trang cổng; xử lý trả trễ (giữ đơn hoặc tự hoàn tiền); đối chiếu với cổng định kỳ |
| Chỉ một server, server sập | Nền tảng tự khởi động lại; theo dõi uptime. Nâng lên hai server được ngay vì việc chạy nền đã có khoá |
| Dữ liệu demo không chuyển sang bản thật | Bản thật bắt đầu trống, bạn đăng feed thật; bản thử dùng dữ liệu mẫu |
| Hoàn tiền đơn chuyển khoản mà admin không xem được số tài khoản khách | Tạm thời shop liên hệ khách. Sau này có thể nối dịch vụ chi hộ, hoặc dịch vụ tự xác nhận chuyển khoản (SePay, Casso) |
| Đông khách thì tốn chi phí hơn | Bắt đầu gói nhỏ. Ảnh và video đi qua CDN của R2 nên server nhẹ |
| Chuyển `/api` qua Vercel bị giới hạn dung lượng request | Dùng tên miền `api.` riêng; video tải thẳng lên kho |
