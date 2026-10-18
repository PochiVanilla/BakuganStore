# 09 · Giai đoạn 4–5: đơn hàng, mã giảm giá, thanh toán thẻ thật trên MySQL

| Mục | Nội dung |
| --- | --- |
| Ngày | 18/10/2026 |
| Giai đoạn | 4–5 — **xong** (một phần của việc "bỏ dữ liệu giả lập, lưu thật trên MySQL") |
| Đã làm | Cấu hình trang thanh toán, mã giảm giá, đặt hàng chống bán trùng, đơn của khách (xem, tự huỷ, đổi cách trả), thẻ qua cổng giả lập chạy trên server (ký HMAC như cổng thật), sự cố tiền, admin xử lý đơn / tạo đơn tay / sự cố / hoàn tiền khi admin bấm, tự lên Lv2, việc chạy nền |
| Luật tiền | **Hệ thống không bao giờ tự hoàn tiền.** Tiền về mà đơn không nhận được → ghi nhận + mở sự cố tiền cho admin tự quyết |
| Kết quả kiểm tra | 123/123 test backend trên MySQL 8.4 (30 test mới). Trình duyệt thật, web chạy dữ liệu thật: luồng đặt hàng + thẻ + admin 16/16. Bản giả lập (Vercel) vẫn qua: thanh toán 35/35, admin 19/19 |
| Web đang chạy | Vẫn **giả lập** cho tới giai đoạn 9 |
| Việc tiếp theo | Giai đoạn 6–8: hạng thành viên, đấu giá + WebSocket, chat + bot ở server, admin khách / báo cáo / cài đặt, blog, liên hệ |

## 1. Chủ shop dùng thế nào

- **Khách đặt hàng** như trên web hiện nay. Khác ở chỗ mọi thứ kiểm tra lại trên server:
  - Giá lấy từ CSDL, không lấy từ trình duyệt.
  - Hai khách cùng bấm chốt một con: đúng một người được, người kia nhận câu
    "BK-xxxx vừa có người chốt trước…".
  - Bấm "Đặt hàng" hai lần hay mạng chập chờn gửi lại: vẫn chỉ ra một đơn.
- **Trả thẻ**:
  - Trên mini PC, biến `CARD_GATEWAY` mặc định là `none`: web **không cho chọn trả thẻ**
    (và vì vậy cũng không giao quốc tế) cho tới khi shop ký hợp đồng cổng thanh toán (OnePay, VNPAY…).
  - Khi lập trình, `CARD_GATEWAY` mặc định là `mock`: cổng giả lập chạy trên server, chỉ nhận thẻ thử.
  - Thẻ chỉ bật khi **cả hai** điều kiện đúng: admin bật trong Cài đặt, và backend có cổng.
- **Sự cố tiền**: khi tiền về mà đơn không nhận được, web của khách hiện
  "Shop đã nhận khoản thanh toán của bạn nhưng đơn cần kiểm tra lại. Bạn nhắn shop…" kèm nút nhắn shop.
  Admin thấy sự cố "Hệ thống tự mở" trong đơn, tự quyết hoàn tiền / đổi con khác / giữ tiền.
  Đóng sự cố (phải ghi cách xử lý) thì dòng nhắc bên khách tắt.
  Các trường hợp:
  - Khách trả trễ khi hàng đã bán cho người khác.
  - Trả trùng hai lần.
  - Tiền về cho lượt trả đã đóng (khách đã đổi sang COD).
  - Cổng báo sai số tiền.
- **Ghi chú nội bộ** của admin giờ để riêng, không còn đè lên ghi chú khách viết lúc đặt hàng.
  Trang chi tiết đơn của admin hiện thêm dòng "Khách ghi chú".

## 2. Đã làm

### 2.1 Khách

| API (`/api/…`) | Làm gì |
| --- | --- |
| `GET /checkout/config` | Phí ship, ngưỡng miễn ship, thẻ / quốc tế có bật không, giữ hàng bao nhiêu phút. Đọc cài đặt shop (bảng `settings`, kiểm tra bằng Zod; ô hỏng thì dùng mặc định) |
| `GET /shop/bank` | Tài khoản nhận chuyển khoản của shop; chưa nhập thì `null` |
| `GET /coupons`, `POST /coupons/apply` | Mã đang dùng được; xem trước một mã: không tồn tại (404), hết hạn (410), chưa đủ giá trị (422), hết lượt, chỉ đơn đầu tiên, số lượt mỗi khách |
| `POST /orders` | Đặt đơn (bên dưới). Chỉ tài khoản khách; admin dùng trang Tạo đơn |
| `GET /orders/me`, `GET /orders/me/:id` | Đơn của chính mình; đơn người khác → 404 |
| `POST /orders/me/:id/cancel` | Tự huỷ đơn chờ xác nhận, chưa trả: mở bán lại hàng, trả lượt mã giảm giá |
| `PATCH /orders/me/:id/payment-method` | Đơn trong nước trả thẻ không được thì đổi sang COD / chuyển khoản / MoMo |

**Đặt đơn** (`POST /orders`):

1. Kiểm tra dữ liệu với đúng câu báo lỗi của web (số điện thoại, địa chỉ, đơn quốc tế chỉ trả thẻ…).
2. Web gửi kèm `Idempotency-Key` (mã ngẫu nhiên mỗi lần bấm). Mã đã gặp → trả lại đúng đơn lần trước.
   Hai lần gửi trùng chạy song song: lần sau phải chờ ở bước ghi mã, rồi nhận lại đơn của lần trước.
3. Transaction:
   1. Khoá từng con theo thứ tự id (`SELECT … FOR UPDATE`).
   2. Con đã bán / không còn trên feed → 409. Feed chưa tới giờ mở bán → 409.
   3. Tính tiền bằng đúng hàm `calculateTotals` của web, phí lấy từ cài đặt.
   4. Kiểm tra mã giảm giá (khoá dòng mã).
   5. Sinh mã đơn `TD` + ngày tháng (giờ VN) + chữ + 2 số.
   6. Ghi đơn, dòng hàng (chụp tên, mã, giá, ảnh), lịch sử.
   7. Đơn thẻ thì giữ hàng 15 phút.
   8. Chuyển các con sang SOLD, ghi lượt dùng mã.
4. Xoá bộ đệm feed: khách khác thấy SOLD ngay.

**Bản đơn gửi cho khách**: không có ghi chú nội bộ; lịch sử ghi "TD Bakugan" thay cho tên nhân viên;
có cờ `needsShopContact` khi có sự cố tiền chưa đóng.

### 2.2 Thanh toán thẻ

| API (`/api/payments/…`) | Làm gì |
| --- | --- |
| `POST /card/sessions` | Mở lượt trả: đúng chủ đơn, đơn thẻ còn chờ trả và còn hạn giữ. Số tiền lấy từ đơn trong CSDL. Đường quay về phải thuộc web của shop. Lượt cũ còn mở bị đóng |
| `POST /card/ipn/:gateway` | Cổng báo kết quả (không cần đăng nhập; tin hay không là nhờ chữ ký HMAC). Trả lời theo kiểu VNPAY (`RspCode`) |
| `GET /mock-gateway/:lượt`, `POST …/pay`, `…/otp`, `…/abort` | Chỉ khi `CARD_GATEWAY=mock`: trang cổng giả lập của web gọi các đường này |

**Cổng giả lập trên server** (`src/modules/payments/gateway.ts`):

- Cùng bộ thẻ thử với web (dời sang `src/constants/testCards.ts` để hai bên dùng chung).
- Thẻ khác bị từ chối ngay.
- Kết quả được "gửi về" bằng tham số có chữ ký HMAC, đi đúng đường xử lý IPN của cổng thật.
  Khoá ký suy ra từ `JWT_SECRET`, không cần thêm biến.
- Đổi sang cổng thật chỉ là viết thêm một lớp đúng khuôn `CardGateway`.
- Không lưu số thẻ ở đâu cả: server chỉ giữ hãng thẻ, 4 số cuối, mã giao dịch.
  Test kiểm tra dữ liệu cổng gửi về không chứa số thẻ.

**Xử lý kết quả** (mỗi kết quả chỉ xử lý một lần nhờ `payment_events.event_key` duy nhất; khoá lượt và đơn):

| Trường hợp | Kết quả |
| --- | --- |
| Đơn thẻ còn chờ trả | Đã thanh toán; lưu thẻ, mã giao dịch; lịch sử "Cổng thanh toán: Đã thanh toán …". Đơn vẫn "Chờ xác nhận" để shop gọi khách |
| Trả trễ, đơn đã tự huỷ, hàng vẫn còn | Giữ lại đơn cho khách: bán lại đúng các con đó, đơn về "Chờ xác nhận" + đã trả, trả lại lượt mã giảm giá |
| Trả trễ, hàng đã bán cho người khác | Đơn vẫn huỷ, ghi đã trả, **mở sự cố tiền**, không tự hoàn |
| Trả trùng / lượt đã đóng (khách đổi COD) / đơn huỷ vì lý do khác | Ghi nhận khoản tiền (đơn chưa trả thì ghi đã trả để shipper không thu nữa), **mở sự cố tiền** |
| Cổng báo sai số tiền | Không ghi đã trả, mở sự cố tiền, trả lỗi cho cổng |
| Thất bại | Ghi lý do vào lần thử gần nhất (khách thấy ở trang kết quả) |
| Chữ ký sai | Không đổi gì, ghi lại để kiểm tra, trả lỗi cho cổng |

**Hoàn tiền về thẻ**: chỉ khi admin bấm. Đơn phải đã trả bằng thẻ và đã huỷ / hoàn hàng.
Mỗi lượt thanh toán chỉ một lệnh hoàn đang chạy hoặc đã xong, nên bấm hai lần cũng không hoàn hai lần.
Gọi cổng ngoài transaction (không giữ khoá trong lúc chờ mạng).

### 2.3 Admin

| API (`/api/admin/…`) | Làm gì |
| --- | --- |
| `GET /orders` | Lọc trạng thái (cả "cần xử lý"), nguồn, số ngày, từ khoá (mã đơn, tên, SĐT, email, tên / mã Bakugan, không cần dấu); đếm từng trạng thái bằng một câu SQL; 12 đơn mỗi trang |
| `GET /orders/:id`, `GET /orders/:id/issues` | Chi tiết đơn (đủ tên nhân viên, ghi chú nội bộ), sự cố của đơn |
| `PATCH /orders/:id/status` | Đúng bảng `ORDER_TRANSITIONS` của web. Huỷ phải có lý do, mở bán lại hàng, trả lượt mã. Hoàn hàng có chọn mở bán lại. Hoàn tất: COD tự thành đã trả; khách nhận đủ 3 con thì tự lên Lv2 (đóng yêu cầu lên hạng đang chờ) |
| `PATCH /orders/:id/payment` | Đơn không trả thẻ: xác nhận đã nhận tiền / đã hoàn tiền tay. Đơn thẻ: không đánh dấu tay được, chỉ có "Hoàn tiền về thẻ" |
| `PATCH /orders/:id` | Ghi chú nội bộ (cột riêng) |
| `POST /orders` | Tạo đơn tay: server tự tra và khoá từng con; chọn trùng / đã bán / khách không có thật bị chặn; chỉ COD / chuyển khoản / MoMo |
| `POST /issues`, `PATCH /issues/:id` | Ghi sự cố (mô tả ít nhất 10 ký tự); đóng sự cố phải ghi cách xử lý |

Mọi thao tác admin ghi nhật ký (`audit_logs`).

### 2.4 Việc chạy nền (`src/jobs/index.ts`)

| Việc | Chu kỳ | Làm gì |
| --- | --- | --- |
| Giữ hàng chờ trả thẻ | 30 giây | Đơn thẻ quá 15 phút chưa trả → huỷ, mở bán lại. Khách đang ở trang cổng (lượt mở trong 20 phút) thì chờ thêm, tránh vừa trừ tiền vừa huỷ đơn. Trước khi đặt đơn / mở lượt trả / xem đơn cũng chạy luôn |
| Dọn ảnh / video | 1 giờ | File tải lên mà 24 giờ không chỗ nào dùng thì xoá |
| Dọn mã chống gửi trùng | 1 giờ | Xoá mã cũ hơn 24 giờ |

- Mỗi việc chạy trong khoá tên của MySQL: nếu sau này chạy hai server thì cũng chỉ một cái làm.
- Một lượt chưa xong thì lượt sau bỏ qua.
- Không việc nào tự hoàn tiền.

### 2.5 Web (chỉ có tác dụng khi chạy dữ liệu thật, trừ phần ghi chú nội bộ)

| Chỗ | Đổi gì |
| --- | --- |
| Đặt hàng | Gửi kèm `Idempotency-Key` |
| Trang cổng giả lập | Luôn có route; khi chạy với backend thì gọi API cổng trên server bằng mã lượt `phien` trên đường dẫn |
| Trang kết quả, Đơn hàng của tôi | Dòng "Shop đã nhận khoản thanh toán… Bạn nhắn shop" + nút mở chat khi có sự cố tiền. Đơn huỷ chỉ ghi "Bạn không bị trừ tiền" khi thật sự chưa trả |
| Admin chi tiết đơn | Ô "Ghi chú nội bộ" lưu vào `internalNote` (bản giả lập cũng vậy); thêm dòng "Khách ghi chú" |
| Bản giả lập | Đơn trả cho khách bỏ ghi chú nội bộ (cả dữ liệu cho bot) |
| Kiểu dữ liệu | `Order.internalNote`, `Order.needsShopContact`, `OrderIssue.reportedBy` thêm `system` |

### 2.6 Biến môi trường và bộ cài

| Chỗ | Đổi gì |
| --- | --- |
| `CARD_GATEWAY` | Mới: `none` / `mock`. Bản thật mặc định `none`; lập trình mặc định `mock` (backend in cảnh báo khi đang dùng cổng giả lập) |
| `deploy/docker-compose.yml`, `deploy/.env.example`, `deploy/HUONG-DAN.md`, `backend/.env.example` | Thêm `CARD_GATEWAY` và hướng dẫn |

## 3. Khác với kế hoạch / bản giả lập

| Chỗ | Bản thật làm | Lý do |
| --- | --- | --- |
| Tiền về từ một lượt cũ khi đơn vẫn chờ trả thẻ | Ghi đã trả bình thường (kế hoạch định mở sự cố) | Đúng số tiền của đúng đơn đang chờ trả; mở sự cố chỉ làm admin mất công |
| Trả trễ | Lượt trả bị đóng lúc đơn tự huỷ vẫn được tính là "trả trễ" (giữ đơn nếu còn hàng) | Test phát hiện: huỷ đơn đóng luôn lượt đang mở, nếu không thì mọi lần trả trễ đều thành sự cố |
| Hoàn tiền tay đơn không trả thẻ | Chỉ khi đơn đã huỷ / hoàn hàng | Đúng như nút trên giao diện admin |
| Đơn cho người thắng đấu giá | Chưa có (trả 409 kèm lời giải thích) | Làm cùng phần đấu giá thật ở giai đoạn 6–8 |
| Đối chiếu khi mất IPN (mỗi 2 phút) | Chưa có | Cổng giả lập báo kết quả ngay; làm khi nối cổng thật |
| Email báo shop khi có sự cố tiền | Chưa có (chỉ ghi log cảnh báo + hiện trong admin) | Làm cùng số đếm trên menu admin ở giai đoạn 6–8 |
| Bật thẻ / giao quốc tế / nhập tài khoản ngân hàng | Màn hình Cài đặt của admin chưa nối API (giai đoạn 6–8) | Tới lúc đó cài đặt giữ giá trị ban đầu: thẻ và quốc tế tắt |

## 4. Kiểm thử

**Backend**: 123/123 qua. Mới: `orders.test.ts` 16 test, `payments.test.ts` 14 test.

**Đổi cách chạy test**: mỗi file test giờ dùng **một CSDL riêng** (`tdbakugan_test_<mã>`), tạo khi bắt đầu
file và xoá khi chạy xong cả bộ. Trước đây các file dùng chung một CSDL nên test feed (giả định
feed số 1, mã BK-0001) hỏng khi chạy sau test đơn hàng. Hàm `signInAs` tạo phiên thẳng trong CSDL
(đi qua trang đăng nhập thì vướng giới hạn 10 lần / phút); luồng đăng nhập thật vẫn có test riêng.

| Nhóm | Thử gì |
| --- | --- |
| Cấu hình | Thẻ chỉ bật khi admin bật VÀ có cổng; `CARD_GATEWAY=none` thì không bao giờ nhận thẻ |
| Mã giảm giá | Không tồn tại / hết hạn / chưa đủ tối thiểu; tính đúng; mã khách mới chỉ đơn đầu (đơn đầu bị huỷ thì vẫn dùng được); huỷ đơn trả lượt; FREESHIP |
| Đặt đơn | Giá từ CSDL, con SOLD, khách khác thấy ngay; câu lỗi như web; admin không đặt được; đã bán / chưa mở bán → 409 |
| **20 khách cùng chốt một con** | Đúng 1 đơn thành công, 19 lần 409 |
| Idempotency-Key | Hai lần gửi cùng lúc + gửi lại → một đơn; khác nội dung → 422 |
| Thẻ | Giữ hàng 15 phút; đường quay về lạ → 422; thẻ thật bị chặn; từ chối; OTP sai / đúng; dừng ở cổng; không lưu số thẻ |
| IPN | Chữ ký sai bị từ chối; gửi lặp chỉ xử lý một lần; sai số tiền |
| Giữ hàng | Quá hạn → huỷ, mở bán lại; đang ở trang cổng thì chờ thêm |
| Sự cố tiền | Trả trễ còn hàng → giữ đơn; trả trễ hết hàng → sự cố, không tự hoàn; đổi COD rồi tiền về → đã trả + sự cố; trả trùng → sự cố; admin hoàn về thẻ một lần; đóng sự cố thì cờ bên khách tắt |
| Admin | Danh sách + đếm + tìm không dấu; ghi chú nội bộ khách không thấy; bảng chuyển trạng thái; COD hoàn tất → đã trả; đủ 3 con → Lv2; huỷ phải có lý do; hoàn hàng mở bán lại; tạo đơn tay; sự cố |
| Việc chạy nền | Dọn file không dùng sau 24 giờ (giữ file đang dùng); dọn mã chống gửi trùng |

**Trình duyệt thật** (backend + MySQL + web `VITE_USE_MOCK=false`, cổng giả lập trên server), 16/16 qua:

1. Admin đăng feed. Khách mới đăng ký, cho 2 con vào giỏ, nhập mã TDNEW10, đặt COD:
   giảm 125.000₫ tính ở server, 2 con SOLD ngay.
2. Đặt đơn thẻ → sang cổng giả lập kèm mã lượt.
   - Thẻ thật bị từ chối; thẻ bị từ chối báo ngay.
   - "Huỷ, quay lại cửa hàng" → trang kết quả còn đếm ngược.
   - Thử lại bằng thẻ cần OTP → đúng OTP → "Thanh toán thành công! Visa •••• 3220", 2 lần thử.
3. Khách tự huỷ đơn COD; trang "Đơn hàng của tôi" đọc từ MySQL.
4. Admin xem chi tiết, lưu ghi chú nội bộ (khách không thấy), đưa đơn tới hoàn tất;
   khách thấy "TD Bakugan" trong lịch sử.

**Bản giả lập** (Vercel) sau khi sửa web: luồng thanh toán 35/35, cài đặt thẻ / quốc tế phía admin 19/19.

## 5. Việc tiếp theo

- **Giai đoạn 6–8**:
  - Hạng thành viên (nạp tiền, xin xét duyệt).
  - Đấu giá + WebSocket, đơn cho người thắng.
  - Chat + bot chạy ở server.
  - Admin: khách hàng, báo cáo, cài đặt (bật thẻ, quốc tế, tài khoản ngân hàng), số đếm trên menu.
  - Blog, liên hệ, nhận tin.
