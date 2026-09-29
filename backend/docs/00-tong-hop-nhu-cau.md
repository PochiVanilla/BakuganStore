# 00 · Tổng hợp nhu cầu backend (đọc lại từ frontend)

| Mục | Nội dung |
| --- | --- |
| Ngày | 29/09/2026 |
| Giai đoạn | 0 — Khảo sát. **Chưa viết code backend.** |
| Đã làm | Đọc lại toàn bộ frontend: kiểu dữ liệu (`src/types`), các service trong `src/services/api` cả phía khách lẫn admin (lớp giả lập, chính là "hợp đồng API"), CSDL giả `src/mocks/db.ts`, kênh realtime đấu giá, hàm bot `api/chat-bot.ts`, các trang |
| Kết quả | Danh sách dữ liệu cần lưu, **96 API + 1 kênh WebSocket** frontend đang gọi, luật nghiệp vụ, việc chạy nền, 10 lỗi/rò rỉ cần sửa, những màn hình frontend còn thiếu |
| Tiếp theo | [01 · Kế hoạch backend](01-ke-hoach-backend.md) — chờ chủ shop duyệt |

## Tóm tắt

- Frontend đã viết sẵn để nối backend: mỗi service có nhánh `if (!USE_MOCK)` gọi HTTP. Backend chỉ cần làm **đúng 96 API và kênh realtime của đấu giá** theo cùng hình dạng dữ liệu là web chạy thật, không phải sửa giao diện (trừ vài chỗ nhỏ ở mục 10).
- Mọi luật nghiệp vụ hiện đang chạy **trong trình duyệt**, nên ai rành kỹ thuật cũng sửa được. Backend phải là nơi quyết định: giá tiền, còn hàng hay đã bán, quyền admin, hạng thành viên, thanh toán.
- Chỗ khó nhất: **mỗi con Bakugan chỉ có một**. Hai người bấm mua cùng lúc thì chỉ một người được, kể cả khi đơn trả thẻ đang giữ hàng 15 phút.
- Việc phải tự chạy trên server: huỷ đơn thẻ quá 15 phút, huỷ đơn chuyển khoản quá 24 giờ (web đã hứa với khách nhưng chưa có gì làm), dọn file và phiên hết hạn.
- Có 10 lỗi/rò rỉ nhỏ phát hiện khi đọc lại (mục 9), sẽ sửa luôn khi làm backend.

---

## 1. Frontend đang chạy thế nào

- **Dữ liệu nằm trong từng trình duyệt**: localStorage (CSDL giả, bản 5), ảnh và video trong IndexedDB. Mỗi máy một bản riêng, nên khách A không thấy con đã bán cho khách B, và ảnh admin tải lên chỉ máy admin xem được.
- Phần "server" được giả lập ngay trong code web: kiểm tra quyền (`requireUser`, `requireAdmin`), tính tiền, giữ hàng, cổng thẻ giả.
- Chỗ duy nhất đang chạy trên server thật: `api/chat-bot.ts` (Vercel Function giữ khoá Gemini).
- Công tắc có sẵn: `VITE_USE_MOCK=false` + `VITE_API_BASE_URL=<địa chỉ backend>` thì mọi service chuyển sang gọi HTTP thật.
- Trang đấu giá có sẵn kênh realtime: đặt thêm `VITE_WS_URL` là web mở WebSocket tới `…/auctions/:id`. Hiện kênh này đang giả lập "người khác đặt giá" theo chu kỳ ngẫu nhiên.

## 2. Hợp đồng chung frontend đang chờ

| Mục | Quy ước |
| --- | --- |
| Địa chỉ gốc | `/api` (hoặc `VITE_API_BASE_URL`) |
| Đăng nhập | Header `Authorization: Bearer <accessToken>`. Nhận 401 thì web xoá token |
| Thành công | `{ "data": …, "message"?: "…" }` |
| Lỗi | Mã HTTP + `{ "message": "câu tiếng Việt cho người dùng", "fieldErrors"?: { "tên ô": "lỗi" } }` |
| Mã lỗi đang dùng | 401 chưa đăng nhập · 403 không có quyền · 404 không thấy · 409 trùng / đã bán / sai trạng thái · 410 mã giảm giá hết hạn · 422 dữ liệu sai · 423 tài khoản khoá · 429 gọi quá nhiều |
| Phân trang | `{ items, page, pageSize, total, totalPages }` |
| Thời gian | Chuỗi ISO 8601; ngày thống kê tính theo giờ Việt Nam |
| Tiền | Số nguyên đồng (VND), không có số lẻ |
| Tham số mảng | Axios gửi `attributes[]=pyrus&attributes[]=aquos`, server phải đọc được dạng này |
| Realtime đấu giá | WebSocket `${VITE_WS_URL}/auctions/:id`, server đẩy sự kiện dạng JSON |
| Id | Chuỗi bất kỳ. Mã đơn `TD2709K74` và mã Bakugan `BK-0231` là mã hiển thị riêng |

## 3. Người dùng và quyền

| Vai trò | Được làm |
| --- | --- |
| Khách vãng lai | Xem feed, từng con, đấu giá, blog; chat với shop (không cần tài khoản); gửi liên hệ; đăng ký nhận tin |
| Khách Lv1 | Thêm: đặt hàng, trả thẻ, xem và tự huỷ đơn của mình, sổ địa chỉ, tài khoản nhận hoàn tiền, xin lên Lv2 |
| Khách Lv2 | Thêm: đặt giá đấu giá |
| Admin | Toàn bộ trang quản trị. **Không** đặt hàng, không đặt giá bằng tài khoản admin; **không** xem số tài khoản ngân hàng của khách; không tự khoá hay tự đổi quyền của mình |

Quyền phải kiểm tra ở server cho từng request. Tài khoản bị khoá thì mọi thao tác đều bị chặn.

## 4. Dữ liệu cần lưu

| Nhóm | Dữ liệu | Ghi chú |
| --- | --- | --- |
| Tài khoản | Người dùng, sổ địa chỉ (đúng một địa chỉ mặc định), tài khoản nhận hoàn tiền | Số tài khoản ngân hàng là dữ liệu mật: chỉ chính chủ thấy |
| | Thông tin admin quản lý: trạng thái khoá + lý do, thẻ phân loại, ghi chú nội bộ, lần đăng nhập cuối | Khách không thấy |
| | Hạng thành viên: hạng, lên nhờ cách nào, lúc nào, tổng tiền đã nạp | |
| Hàng | Feed: số thứ tự, tiêu đề, mô tả, ảnh lô (≤6), giờ đăng, giờ mở bán, giá nhập lô, nhà cung cấp | Tối đa 30 feed trên web |
| | Từng con: mã `BK-xxxx` (duy nhất mãi mãi), tên, giá, hệ (chữ shop gõ), dòng, tình trạng (chữ shop gõ, có thể trống), ≤3 ảnh + 1 video, còn/đã bán, bán qua đơn hay bán tay, người mua, thứ tự trong feed | Con đã bán giữ lại tên/số feed |
| | File ảnh, video đã tải lên | Để dọn file không còn dùng |
| Đơn hàng | Đơn: mã, tiền (tạm tính, ship, giảm, tổng), trạng thái, cách trả, trạng thái trả, nguồn (web / đấu giá / admin tạo), người nhận, địa chỉ (trong nước hoặc quốc tế), ghi chú, lý do huỷ | |
| | Dòng hàng: bản chụp tên, mã, giá lúc mua | Không đổi theo sản phẩm về sau |
| | Lịch sử đơn: trạng thái, lúc nào, ai, ghi chú | |
| | Thanh toán thẻ: hạn giữ hàng, số lần thử, hãng thẻ, 4 số cuối, mã giao dịch, giờ trả, lỗi gần nhất, giờ hoàn tiền | **Không bao giờ có số thẻ đầy đủ** |
| | Sự cố đơn hàng: loại, trạng thái, mô tả, người báo, cách giải quyết | |
| Khuyến mãi | Mã giảm giá: loại (%, số tiền, miễn phí ship), giá trị, đơn tối thiểu, mức giảm tối đa, hạn | Đang cứng trong code (3 mã) |
| Thành viên | Yêu cầu lên Lv2: nạp tiền / xét duyệt, số tiền, nội dung chuyển khoản, lời nhắn, trạng thái, ai duyệt, ghi chú | |
| Đấu giá | Phiên: tiêu đề, mô tả, ảnh, giá khởi điểm, giá hiện tại, bước giá, giá mua ngay, giờ bắt đầu/kết thúc (+ giờ kết thúc ban đầu), kín hay mở, số phút chống bắn tỉa, số lần gia hạn, thông tin Bakugan | Đang cứng trong code |
| | Lượt đặt giá: phiên, người đặt, số tiền, lúc nào, có gây gia hạn không | Tên người đặt chỉ admin thấy |
| | Khâu sau phiên: đã tạo đơn / bỏ cọc + ghi chú | |
| Chat | Cuộc trò chuyện: khách (hoặc khách vãng lai), trạng thái, bot bật/tắt, số tin chưa đọc hai phía, việc bot đang chờ khách xác nhận, trạng thái tư vấn | |
| | Tin nhắn: người gửi (khách / bot / nhân viên / hệ thống), nội dung, tên nhân viên, câu trả lời nhanh, nút dẫn link | |
| Cài đặt | Shop: tiền nạp lên Lv2, tài khoản nhận tiền của shop, nhận thẻ, giao quốc tế (phí theo vùng, tỉ giá) | |
| | Bot: bật/tắt, lời chào, lời chuyển nhân viên, 11 chủ đề, ghi chú thêm | |
| Nội dung | Bài blog, tin nhắn liên hệ, email đăng ký nhận tin | Blog đang cứng trong code (6 bài); liên hệ và nhận tin chưa lưu |

## 5. 96 API frontend đang gọi

Đường dẫn tính từ `/api`. `:id` là id, `:number` là số feed, `:code` là mã Bakugan, `:slug` là đường dẫn bài blog.

**Tài khoản (11)**
`POST /auth/register` · `POST /auth/login` · `POST /auth/forgot-password` · `POST /auth/change-password` · `PATCH /auth/me` · `PUT /auth/me/bank-account` · `DELETE /auth/me/bank-account` · `POST /addresses` · `PUT /addresses/:id` · `DELETE /addresses/:id` · `PATCH /addresses/:id/default`

**Feed và tìm kiếm (6)**
`GET /feeds` · `GET /feeds/:number` · `GET /feeds/items` (tìm) · `GET /feeds/items/:code` · `GET /feeds/items/by-ids` (giỏ, yêu thích) · `GET /feeds/suggestions` (ô tìm kiếm)

**Mua hàng và thanh toán (10)**
`GET /checkout/config` · `GET /shop/bank` · `GET /coupons` · `POST /coupons/apply` · `POST /orders` · `GET /orders/me` · `GET /orders/me/:id` · `POST /orders/me/:id/cancel` · `PATCH /orders/me/:id/payment-method` · `POST /payments/card/sessions`

**Hạng thành viên (4)**
`GET /me/membership` · `POST /me/membership/deposit` · `POST /me/membership/review` · `DELETE /me/membership/request`

**Đấu giá (4)**
`GET /auctions` · `GET /auctions/:id` · `POST /auctions/:id/bids` · `GET /auctions/my-bids`

**Chat phía khách (7)**
`GET /chat/config` · `POST /chat/conversations` · `GET /chat/conversations/:id` · `GET /chat/conversations/mine` · `POST /chat/conversations/:id/messages` · `POST /chat/conversations/:id/handoff` · `POST /chat/conversations/:id/read`

**Nội dung (6)**
`GET /blog` · `GET /blog/latest` · `GET /blog/:slug` · `GET /blog/:slug/related` · `POST /contact` · `POST /newsletter`

**Admin — đơn hàng (7)**
`GET /admin/orders` (lọc, đếm theo trạng thái, phân trang) · `POST /admin/orders` (tạo tay) · `GET /admin/orders/:id` · `PATCH /admin/orders/:id` (ghi chú) · `PATCH /admin/orders/:id/status` · `PATCH /admin/orders/:id/payment` · `GET /admin/orders/:id/issues`

**Admin — sự cố và báo cáo (5)**
`POST /admin/issues` · `PATCH /admin/issues/:id` · `GET /admin/reports/problems` · `GET /admin/dashboard` · `GET /admin/badges`

**Admin — feed (6)**
`GET /admin/feeds` · `POST /admin/feeds` · `GET /admin/feeds/limit` · `GET /admin/feeds/:id` · `PUT /admin/feeds/:id` · `DELETE /admin/feeds/:id`

**Admin — từng con (8)**
`GET /admin/items` · `GET /admin/items/leftovers` · `GET /admin/items/next-codes` · `GET /admin/items/sellable` · `PUT /admin/items/:id` · `DELETE /admin/items/:id` · `POST /admin/items/:id/mark-sold` · `POST /admin/items/:id/mark-available`

**Admin — khách hàng và hạng (9)**
`GET /admin/customers` · `GET /admin/customers/:id` · `PATCH /admin/customers/:id` · `PATCH /admin/customers/:id/status` · `PATCH /admin/customers/:id/role` · `PATCH /admin/customers/:id/level` · `POST /admin/customers/:id/password-reset` · `POST /admin/membership-requests/:id/approve` · `POST /admin/membership-requests/:id/reject`

**Admin — đấu giá (2)**
`GET /admin/auctions` · `POST /admin/auctions/:id/forfeit`

**Admin — chat (6)**
`GET /admin/chat/conversations` · `POST /admin/chat/conversations/:id/messages` · `PATCH /admin/chat/conversations/:id` (bật/tắt bot) · `POST /admin/chat/conversations/:id/resolve` · `POST /admin/chat/conversations/:id/read` · `GET /admin/chat/bot-knowledge`

**Admin — cài đặt và tải file (5)**
`GET /admin/settings/shop` · `PATCH /admin/settings/shop` · `GET /admin/settings/bot` · `PUT /admin/settings/bot` · `POST /admin/uploads`

**Kênh WebSocket (1)**
`${VITE_WS_URL}/auctions/:id`, server đẩy 3 loại sự kiện, không mang tên người đặt:
- `bid-placed`: `{ auctionId, amount, bidCount, bidderCount, at }`
- `auction-ended`: `{ auctionId, at }`
- `watcher-count`: `{ auctionId, count, at }`

Ngoài ra web còn gọi thẳng `GET/POST /api/chat-bot` (hàm Vercel giữ khoá Gemini). Khi có backend, việc gọi Gemini chuyển vào backend.

## 6. Luật nghiệp vụ backend phải giữ đúng

### 6.1 Feed và từng con Bakugan
- Mỗi con là duy nhất, không có số lượng: `available` hoặc `sold`.
- Mã có dạng `BK-` + ít nhất 4 chữ số và không bao giờ trùng, kể cả với con đã bán hay feed đã xoá. Admin gõ `bk 231` thì chuẩn hoá thành `BK-0231`; bỏ trống thì hệ thống tự cấp số kế tiếp.
- Feed có số thứ tự tăng dần (`/feed/28`). Trạng thái tính theo giờ:
  - `upcoming`: chưa tới giờ mở bán
  - `selling`: đang bán
  - `sold-out`: mọi con đã bán; kèm lúc con cuối được bán
- Một con **đặt mua được** khi: còn bán, nằm trong một feed, và feed đó đã tới giờ mở bán.
- Web giữ **tối đa 30 feed**. Đăng feed thứ 31 phải xác nhận xoá feed cũ nhất; có thể mang những con chưa bán của feed đó sang feed mới.
- Xoá feed: con chưa bán thành **hàng tồn** (không thuộc feed nào); con đã bán giữ lại tên và số feed để tra lịch sử.
- Sửa feed:
  - Thứ tự con theo đúng form.
  - Con đã bán không đổi giá được.
  - Con bị bỏ khỏi form: chưa bán thì thành hàng tồn; đã bán thì vẫn ở lại feed.
- Giới hạn: mỗi feed ≤ 60 con và ≤ 6 ảnh; mỗi con ≤ 3 ảnh + 1 video; tiêu đề ≥ 3 ký tự; giá là số nguyên dương.
- Tên, hệ, tình trạng là chữ shop tự gõ (cập nhật theo [03](03-khong-tu-hoan-tien-va-o-tu-dien.md)): tên 2–80 ký tự; hệ bắt buộc, ≤ 40 ký tự; tình trạng ≤ 160 ký tự, được để trống. Không có G-Power.
- Bán ngoài web (Messenger, tại shop): admin tự đánh dấu SOLD, ghi người mua; bỏ đánh dấu được. Con bán qua đơn chỉ quay lại bán khi đơn bị huỷ.
- Xoá hẳn một con: chỉ khi chưa bán và chưa từng nằm trong đơn nào.
- Khách không bao giờ thấy: người mua, đơn, ghi chú nội bộ, giá nhập lô, nhà cung cấp, hàng tồn.
- Tìm kiếm không dấu theo tên, mã (gõ `BK0231` cũng ra), tiêu đề feed; lọc theo hệ (nhận ra từ chữ shop gõ) và khoảng giá; mặc định chỉ con còn bán. Gợi ý nhanh: con còn bán lên trước, kèm tối đa 3 feed.

### 6.2 Tính tiền và mã giảm giá
- Tạm tính là tổng giá các con, **lấy từ CSDL, không lấy giá trình duyệt gửi lên**.
- Phí ship:
  - Trong nước: 30.000₫, miễn phí cho đơn từ 800.000₫.
  - Quốc tế: `feeAsia` cho Đông Á & Đông Nam Á (BN CN HK ID JP KH KR LA MM MN MO MY PH SG TH TL TW), `feeWorld` cho các nước còn lại (admin đặt).
- Mã giảm giá:
  - `percent`: giảm theo %, có mức tối đa.
  - `amount`: giảm số tiền cố định, không quá tạm tính.
  - `shipping`: miễn phí ship, **chỉ dùng cho đơn trong nước** (đơn quốc tế dùng thì báo 422).
  - Có điều kiện đơn tối thiểu. Mã hết hạn báo 410, không có mã báo 404.
- Tổng = max(0, tạm tính + ship − giảm). Web và server phải dùng **cùng một hàm tính**.

### 6.3 Đặt hàng
- Chỉ tài khoản khách được đặt (admin đặt thì báo 403). Giỏ rỗng thì báo 422.
- **Trong nước**: số di động Việt Nam, địa chỉ ≥ 10 ký tự.
- **Quốc tế**:
  - Shop đang bật giao quốc tế, và đơn **bắt buộc trả thẻ**.
  - Số điện thoại có mã nước (`+…`).
  - Địa chỉ hợp lệ: nước giao được, số nhà, thành phố, mã bưu chính (trừ nước không dùng).
  - Địa chỉ một dòng được ghép bằng tiếng Anh.
- Chọn thẻ thì shop phải đang nhận thẻ.
- Kiểm tra lại từng con: còn trên feed, chưa bán, feed đã tới giờ. Con nào vừa bị người khác chốt thì báo 409 kèm mã con đó.
- Tạo đơn:
  - Mã đơn `TD` + ngày + tháng (giờ Việt Nam) + 1 chữ + 2 số, không trùng.
  - Trạng thái `pending`, chưa trả, nguồn `web`.
  - Mốc lịch sử đầu tiên: "Khách đặt trên web…".
  - **Các con chuyển SOLD ngay**, gắn với đơn.
- Đơn trả thẻ: **giữ hàng 15 phút**. Ghi chú của khách tối đa 500 ký tự.

### 6.4 Trạng thái đơn
- Các bước được phép:
  - `pending` → `confirmed` hoặc `cancelled`
  - `confirmed` → `packing` hoặc `cancelled`
  - `packing` → `shipping` hoặc `cancelled`
  - `shipping` → `completed` hoặc `returned`
  - `completed` → `returned`
  - `cancelled` và `returned` là trạng thái cuối.
- **Huỷ**:
  - Bắt buộc chọn lý do (7 loại).
  - Các con trong đơn mở bán lại, chỉ những con vẫn còn gắn với đơn này.
  - Đơn đấu giá bị huỷ thì phiên chuyển thành "bỏ cọc".
- **Hoàn hàng**: tuỳ chọn mở bán lại những con đó.
- **Hoàn tất**: đơn COD tự thành "đã thanh toán"; kiểm tra khách đã đủ điều kiện lên Lv2 chưa.
- Mỗi lần đổi trạng thái thêm một mốc lịch sử: ai, lúc nào, ghi chú.
- **Admin sửa trạng thái thanh toán**:
  - Đơn thẻ không đánh dấu đã trả / chưa trả bằng tay được.
  - Chỉ hoàn tiền đơn đã trả, và **chỉ khi admin bấm**: hệ thống không bao giờ tự hoàn (cập nhật theo [03](03-khong-tu-hoan-tien-va-o-tu-dien.md)). Hoàn tiền đơn thẻ = gửi lệnh hoàn qua cổng về đúng thẻ khách đã dùng.
- **Khách tự huỷ**: chỉ đơn `pending` chưa trả.
- **Khách đổi cách trả** (thẻ sang COD / chuyển khoản / MoMo): chỉ đơn trong nước đang chờ trả thẻ.
- **Admin tạo đơn tay**:
  - Chỉ COD, chuyển khoản hoặc MoMo.
  - Con phải còn bán và không chọn trùng; giá do admin chốt (≥ 0).
  - Đơn cho người thắng đấu giá: phiên đã kết thúc, có người thắng, chưa tạo đơn; giá lấy theo giá chốt của phiên.
  - Trạng thái đầu là `pending` hoặc `confirmed`.

### 6.5 Thanh toán thẻ
- Khách nhập thẻ trên trang của cổng thanh toán (xác thực 3-D Secure). Web shop không thấy, không lưu số thẻ; chỉ lưu hãng thẻ, 4 số cuối, mã giao dịch, giờ trả.
- Mở phiên trả: đúng chủ đơn, đơn thẻ, chưa trả, còn trong giờ giữ hàng; **số tiền lấy từ đơn trên server**.
- Cổng báo kết quả về server kèm chữ ký (IPN). Trả xong thì đơn "đã thanh toán" nhưng vẫn "Chờ xác nhận" để shop gọi khách.
- Thất bại: ghi số lần thử + lý do (bị từ chối, không đủ số dư, sai OTP). Khách tự dừng ở trang cổng thì ghi lý do nhưng không tính là một lần thử.
- Quá 15 phút chưa trả thì **tự huỷ**, lý do `payment-timeout`, hàng mở bán lại.
- Trang kết quả hỏi lại server, **không tin tham số trên URL**. Thẻ trừ tiền đồng; web hiện thêm số ≈ USD theo tỉ giá admin đặt.

### 6.6 Hạng thành viên
- Mặc định Lv1. Chỉ Lv2 mới được đặt giá đấu giá.
- Lên Lv2 bằng **một trong ba cách**:
  - Nhận đủ 3 con (tính đơn hoàn tất): tự động.
  - Nạp tiền: khách báo đã chuyển với nội dung `TDLV2 <SĐT>`; admin đối soát rồi cộng tiền nạp và nâng hạng.
  - Admin xét duyệt.
- Mỗi khách chỉ có một yêu cầu đang chờ; rút lại được; từ chối phải ghi lý do.
- Admin đặt hạng thẳng (nâng hoặc hạ). Việc này chỉ đóng yêu cầu xét duyệt; yêu cầu nạp tiền vẫn chờ đối soát riêng.

### 6.7 Đấu giá
- Trạng thái tính theo giờ: `upcoming`, `live`, `ended`.
- Không công khai người đặt: khách chỉ thấy giá cao nhất, số lượt, số người đã đặt, và các lượt của chính mình. Admin thấy tên.
- Chỉ khách Lv2 có tài khoản đang hoạt động được đặt giá; admin không đặt.
- Giá tối thiểu:
  - Phiên mở: giá hiện tại + bước giá.
  - Phiên kín: max(giá khởi điểm, lượt cao nhất của chính mình + bước giá). Lượt chưa vượt người dẫn đầu bị từ chối với câu chung chung, không lộ giá.
- **Chống bắn tỉa**: lượt đặt trong N phút cuối đẩy giờ kết thúc thành "lúc đặt + N phút"; đếm số lần gia hạn.
- Sau phiên:
  - Có người thắng: chờ tạo đơn, rồi thành "đã tạo đơn" hoặc "bỏ cọc" (admin đánh dấu, có ghi chú).
  - Không ai đặt: "không có người thắng".
- Người thắng được liên hệ trong 24 giờ, trả trong 48 giờ (hiện admin theo dõi tay).
- Người đang xem phiên nhận sự kiện realtime: có lượt đặt mới, phiên kết thúc, số người đang xem thay đổi.

### 6.8 Chat và trợ lý AI
- Khách vãng lai chat được (tên + SĐT/email tuỳ chọn). Khách đăng nhập mở lại được cuộc gần nhất.
- Trạng thái cuộc trò chuyện:
  - `bot`: bot đang tự trả lời.
  - `waiting`: chờ nhân viên; trong lúc chờ bot vẫn trả lời câu đơn giản.
  - `admin`: nhân viên đã vào, bot nhường lời.
  - `resolved`: đã xong; khách nhắn tiếp thì mở lại.
- Tin nhắn ≤ 1.000 ký tự; đếm tin chưa đọc ở cả hai phía. Admin tắt bot được cho từng cuộc; bot toàn shop tắt thì tin mới chuyển thẳng nhân viên.
- Mỗi lượt bot trả lời theo thứ tự:
  1. Việc bot được tự làm: huỷ đơn "chờ xác nhận" chưa trả. Có bước hỏi xác nhận, hết hạn sau vài phút để một chữ "ok" vu vơ không huỷ nhầm.
  2. Tư vấn chọn Bakugan qua 4 câu hỏi.
  3. Hỏi Gemini.
  4. Không gọi được Gemini thì trả lời bằng bộ từ khoá.
- Bot chỉ biết đơn **của chính khách đang chat**. Admin bật/tắt 11 chủ đề bot được tự trả lời.
- Gemini: khoá chỉ nằm ở server; thử nhiều model lần lượt; giới hạn số lượt theo IP; báo đúng lý do lỗi cho admin; lỗi cấu hình thì tạm nghỉ gọi một lúc.

### 6.9 Khách hàng (phía admin)
- Hồ sơ admin xem được dựng theo **danh sách trường cho phép**, không bao giờ có số tài khoản ngân hàng (chỉ tên ngân hàng + tên chủ tài khoản).
- Thống kê từng khách: số đơn, hoàn tất, huỷ, tổng chi (trừ đơn huỷ/hoàn), đơn gần nhất, số lượt đặt giá, số phiên thắng, số con đã nhận.
- Khoá tài khoản phải ghi lý do. Admin không tự khoá, không tự đổi quyền của mình, không đặt mật khẩu hộ khách (chỉ gửi email đặt lại). Mỗi khách tối đa 8 thẻ phân loại; email không trùng.

### 6.10 Cài đặt
- **Shop**, sửa từng phần, không ghi đè phần khác:
  - Tiền nạp lên Lv2: 0–50 triệu.
  - Tài khoản nhận chuyển khoản của shop: số tài khoản 6–20 chữ số, tên chủ viết hoa; để trống nghĩa là chưa có.
  - Nhận thẻ: bật/tắt.
  - Giao quốc tế: phí 0–20 triệu, tỉ giá 1.000–100.000.
  - **Tắt thẻ thì giao quốc tế tự tắt theo.**
- **Bot**: bật/tắt, lời chào, lời chuyển nhân viên, 11 chủ đề, ghi chú thêm.

### 6.11 Báo cáo
- **Trang tổng quan** theo khoảng ngày chọn:
  - Doanh thu và số đơn, so với kỳ trước; tỉ lệ huỷ; số đơn theo trạng thái.
  - Doanh thu 14 ngày gần nhất, gom theo **ngày giờ Việt Nam**.
  - Feed: đang bán, sắp mở, đã bán hết. Số con còn bán, đã bán, hàng tồn.
  - Yêu cầu Lv2, sự cố đang mở, chat đang chờ, phiên chờ tạo đơn, khách mới.
- **Sự cố đơn hàng**: 7 loại, 3 trạng thái; đóng sự cố phải ghi cách giải quyết.
- **Số đếm trên menu admin** (badges).

## 7. Việc server phải tự chạy (không cần ai bấm)

| Việc | Khi nào | Hiện tại |
| --- | --- | --- |
| Huỷ đơn thẻ quá 15 phút chưa trả, mở bán lại hàng | Liên tục, khoảng 30 giây một lần | Trình duyệt tự dọn khi có người mở web |
| Huỷ đơn chuyển khoản quá 24 giờ chưa nhận tiền | Vài phút một lần | **Chưa có**, dù web và bot đã hứa với khách |
| Đối chiếu với cổng thẻ khi mất thông báo kết quả | Vài phút một lần | Chưa có (chưa có cổng thật) |
| Bot trả lời tin nhắn khi khách đóng web giữa chừng | Mỗi phút | Chưa có |
| Dọn phiên đăng nhập, mã đặt lại mật khẩu hết hạn, file tải lên không dùng tới | Mỗi giờ | Chưa có |

## 8. Chỗ mock đang làm tạm, backend phải làm thật

| # | Hiện tại (bản giả lập) | Backend làm |
| --- | --- | --- |
| 1 | Khách nhập mật khẩu nào dài từ 8 ký tự cũng vào; email lạ tự tạo tài khoản; đổi mật khẩu không kiểm tra; quên mật khẩu không gửi gì | Mật khẩu băm (argon2), đăng nhập thật, email đặt lại mật khẩu |
| 2 | Token là id người dùng mã hoá base64, ai cũng tự tạo được | Token ký bằng khoá bí mật, phiên đăng nhập lưu trên server, thu hồi được |
| 3 | Dữ liệu riêng từng trình duyệt | Một CSDL chung |
| 4 | Ảnh, video nằm trong trình duyệt của máy admin | Lưu trên ổ cứng của máy chủ, mọi khách xem được |
| 5 | Đấu giá cứng trong code, lượt đặt giá mất khi tải lại trang | Bảng phiên và lượt đặt trong CSDL |
| 6 | 3 mã giảm giá và 6 bài blog cứng trong code | Bảng trong CSDL (có dữ liệu ban đầu) |
| 7 | Liên hệ, đăng ký nhận tin không lưu gì | Lưu lại, báo cho shop |
| 8 | Cổng thẻ giả lập ngay trong web | Nối cổng thật; bản giả lập chuyển vào server để thử |
| 9 | Trình duyệt tự điều phối bot (gọi Gemini, ghi kết quả) | Server làm toàn bộ lượt trả lời |
| 10 | Tab này ghi, tab kia cập nhật nhờ sự kiện của localStorage | Web hỏi lại server định kỳ (8 giây, đã có sẵn) |

## 9. Lỗi và rò rỉ phát hiện khi đọc lại (sửa luôn khi làm backend)

1. **Ghi chú nội bộ ghi đè ghi chú của khách.** Ô "Ghi chú nội bộ" của admin lưu vào cùng trường `note` với ghi chú khách viết lúc đặt. Hậu quả: mất ghi chú của khách, và API đơn của khách trả luôn ghi chú nội bộ. Cách sửa: tách thành hai trường; khách không bao giờ nhận ghi chú nội bộ.
2. **Phiên đấu giá kín vẫn gửi giá hiện tại xuống trình duyệt.** Giao diện chỉ che đi, xem dữ liệu là thấy. Backend bỏ hẳn giá khỏi dữ liệu phiên kín khi phiên chưa kết thúc.
3. **Chat của khách vãng lai chỉ cần id là đọc được.** Backend cấp thêm mã bí mật cho từng cuộc; không có mã thì không đọc hay gửi được.
4. **Lịch sử đơn gửi cho khách có tên nhân viên.** Bản của khách chỉ ghi "TD Bakugan".
5. **Web hứa "chuyển khoản quá 24 giờ chưa nhận tiền thì đơn tự huỷ"** (trang kết quả, bot) nhưng chưa có gì làm việc này. Backend thêm việc chạy nền.
6. **Có refresh token nhưng không dùng**, hết hạn là bị đăng xuất. Backend làm cơ chế tự gia hạn phiên.
7. **Tài khoản admin demo và mật khẩu nằm trong code web** (chỉ hiện ở bản giả lập). Bản thật tạo admin bằng lệnh riêng; mật khẩu không nằm trong code hay tài liệu.
8. **Số tài khoản ngân hàng đầy đủ được lưu trong localStorage** cùng thông tin người dùng. API chỉ trả 4 số cuối; muốn đổi thì nhập lại.
9. **Admin đổi hạng, tên hoặc khoá tài khoản thì khách không thấy tới khi đăng nhập lại** (web không hỏi lại thông tin người dùng). Thêm `GET /auth/me` và gọi khi mở web.
10. **Kênh realtime đấu giá thiếu và lộ dữ liệu.** Sự kiện `bid-placed` gửi số tiền, nên nếu làm y như vậy thì phiên kín bị lộ giá. Sự kiện cũng không có giờ kết thúc mới, nên khi phiên được gia hạn chống bắn tỉa, người khác vẫn thấy giờ cũ. Backend: phiên kín không gửi số tiền; sự kiện kèm giờ kết thúc, số lần gia hạn, và cờ "bạn đang dẫn đầu không" riêng cho từng người xem. Web sửa nhỏ phần nhận sự kiện.

## 10. Frontend còn thiếu hoặc cần sửa nhỏ khi nối backend

**Sửa nhỏ (làm cùng từng giai đoạn backend):**
- Tự gia hạn phiên đăng nhập khi token hết hạn; đăng xuất gọi server; gọi `GET /auth/me` khi mở web.
- Trang **đặt lại mật khẩu** (link trong email).
- Gửi mã chống đặt trùng (`Idempotency-Key`) khi đặt hàng.
- Chat khách vãng lai: lưu và gửi kèm mã bí mật; lượt bot gọi endpoint mới của backend.
- Nút "Thử bot" trong cài đặt gọi `/api/chat-bot` kèm token đăng nhập (backend giữ nguyên đường này).
- Ghi chú nội bộ của admin dùng trường riêng.
- Tách phần chữ của luật đấu giá khỏi phần icon để backend dùng chung.
- Trang đấu giá: nhận giờ kết thúc mới và cờ "bạn đang dẫn đầu" từ sự kiện realtime; phiên kín không dựa vào số tiền để biết có lượt đặt mới.

**Màn hình chưa có (làm sau, khi cần):**
- Admin tạo và sửa phiên đấu giá (hiện phiên nằm cứng trong code).
- Admin quản lý mã giảm giá, đọc tin nhắn liên hệ và danh sách nhận tin, viết blog.
- Nút "Mua ngay" và "Theo dõi phiên" ở đấu giá mới chỉ hiện con số, chưa bấm được.
