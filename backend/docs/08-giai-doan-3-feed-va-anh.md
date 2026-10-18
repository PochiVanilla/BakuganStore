# 08 · Giai đoạn 3: feed và từng con Bakugan thật trên MySQL, ảnh / video lưu trên ổ

| Mục | Nội dung |
| --- | --- |
| Ngày | 18/10/2026 |
| Giai đoạn | 3 — **xong** (một phần của việc "bỏ dữ liệu giả lập, lưu thật trên MySQL") |
| Đã làm | Feed và từng con phía khách (xem, tìm, gợi ý). Admin: đăng / sửa / xoá feed, giới hạn 30 feed, hàng tồn, cấp mã BK, trang Kho, bán ngoài web. Tải ảnh / video lên ổ của máy, tự dọn file không còn dùng. Nhật ký thao tác admin |
| Kết quả kiểm tra | 93/93 test backend trên MySQL 8.4 (26 test mới). Trình duyệt thật, web chạy dữ liệu thật: luồng feed 19/19 |
| Web đang chạy | Vẫn **giả lập** cho tới khi xong các phần còn lại (đơn hàng, đấu giá, chat…), rồi chuyển hẳn một lần (giai đoạn 9) |
| Việc tiếp theo | Giai đoạn 4–5: đơn hàng, mã giảm giá, thanh toán thẻ (cổng giả lập ở server), việc chạy nền |

## 1. Chủ shop dùng thế nào

Màn hình không đổi. Khác ở chỗ dữ liệu nằm trong MySQL và ảnh nằm trên ổ của máy chạy backend:

- **Ảnh** (ảnh lô và ảnh từng con): máy shop tự xoay đúng chiều, thu về cạnh dài 1600 px, đổi sang WebP và
  **xoá thông tin ẩn trong ảnh** (hãng máy, giờ chụp, vị trí GPS nơi chụp). Tối đa 15 MB mỗi ảnh.
- **Video** giới thiệu: giữ nguyên file. Nhận MP4, MOV, WebM, tối đa 100 MB (web kiểm tra thêm: dài tối đa 3 phút).
- Bỏ một ảnh khỏi feed / thay ảnh / xoá feed / xoá con: file không còn chỗ nào dùng thì bị xoá khỏi ổ ngay.
  Ảnh của con **đã bán** vẫn giữ (lịch sử).
- Ảnh từ iPhone: khi chọn ảnh trên web, iPhone thường tự đổi sang JPEG. Nếu vẫn gửi dạng HEIC mà máy không đọc
  được thì web báo "Không đọc được ảnh này…", chỉ cần lưu sang JPEG rồi tải lại.
- Mọi thao tác đăng / sửa / xoá feed, sửa / xoá / đánh dấu bán từng con đều được ghi vào **nhật ký admin**
  (ai làm, lúc nào, feed / mã nào). Màn hình xem nhật ký làm ở giai đoạn sau.

## 2. Đã làm

### 2.1 Phía khách (`/api/feeds…`, ai cũng xem được)

| API | Làm gì |
| --- | --- |
| `GET /feeds` | Feed đang có trên web, mới nhất trước. Lọc trạng thái (đang bán / sắp mở bán / đã bán hết), hệ, từ khoá (tên, mã, tiêu đề feed, không cần dấu), giới hạn số feed |
| `GET /feeds/:number` | Một feed. Feed đã gỡ hoặc không có → 404 với câu như bản giả lập |
| `GET /feeds/items` | Tìm từng con trên mọi feed: từ khoá, nhiều hệ (`attributes[]`), khoảng giá, có / không gồm con đã bán |
| `GET /feeds/items/:code` | Trang riêng của một con. Mã gõ kiểu nào cũng được: `bk231`, `BK 231`, `BK-0231` |
| `GET /feeds/items/by-ids` | Trạng thái mới nhất của các con trong giỏ / yêu thích (tối đa 100 id) |
| `GET /feeds/suggestions` | Gợi ý ở ô tìm kiếm: con còn bán lên trước, tối đa 3 feed |

- **Chỉ trả trường công khai**: không có giá nhập lô, nhà cung cấp, doanh thu, người mua, đơn hay ghi chú.
- **Bộ nhớ đệm 5 giây**: trang chủ, trang Feed, giỏ hàng gọi rất nhiều nên backend giữ danh sách feed trong
  bộ nhớ. Admin sửa bất cứ gì là xoá đệm ngay (khách thấy SOLD tức thì). Đệm cũng hết hạn đúng giờ mở bán
  của feed hẹn giờ, để "sắp mở bán" chuyển thành "đang bán" đúng giờ.

### 2.2 Admin: feed (`/api/admin/feeds…`, chỉ admin)

| API | Làm gì |
| --- | --- |
| `GET /admin/feeds` | Danh sách feed kèm từng con (có người mua, đơn, doanh thu, giá nhập), số feed theo trạng thái, số con hàng tồn |
| `GET /admin/feeds/limit` | Web đủ 30 feed chưa; đủ thì feed cũ nhất sẽ bị xoá và những con chưa bán trong đó |
| `GET /admin/feeds/:id` | Một feed (để sửa) |
| `POST /admin/feeds` | Đăng feed mới (xem các bước bên dưới) |
| `PUT /admin/feeds/:id` | Sửa feed: tiêu đề, mô tả, ảnh, giờ mở bán, giá nhập, danh sách con và thứ tự |
| `DELETE /admin/feeds/:id` | Gỡ feed khỏi web, trả về số con thành hàng tồn |

**Đăng feed** chạy trong một transaction:

1. Kiểm tra dữ liệu với đúng câu báo lỗi của bản giả lập ("Con thứ 2: giá không hợp lệ."…).
2. Khoá dòng "số feed" trong bảng `counters`: hai admin bấm đăng cùng lúc thì xếp hàng, không vượt 30 feed,
   không trùng số feed.
3. Đủ 30 feed mà chưa xác nhận đúng feed cũ nhất → 409. Có xác nhận: gỡ feed cũ nhất (con chưa bán thành
   hàng tồn, con đã bán giữ lịch sử), nếu chọn thì mang luôn hàng tồn đó sang feed mới (đứng sau các con mới).
4. Mọi ảnh / video phải là file đã tải lên máy shop, đúng loại (ảnh ở chỗ ảnh, video ở chỗ video). Link lạ → 422.
5. Cấp mã cho con mới: admin tự gõ thì chuẩn hoá (`bk 77` → `BK-0077`), trùng con khác (kể cả đã bán) → 409;
   bỏ trống thì lấy số kế tiếp, bỏ qua mã admin đã gõ tay. Ô `UNIQUE` trên mã là chốt chặn cuối.
6. Ghi từng con theo đúng thứ tự trong form; con đã bán giữ nguyên giá; con bị bỏ khỏi form mà chưa bán
   thành hàng tồn (ghi lại tên / số feed cũ).
7. Ghi nhật ký admin. Sau khi lưu xong mới dọn file ảnh / video không còn dùng.

**Tên, hệ, tình trạng** là chữ shop tự gõ (như web). Mỗi lần lưu, server tính lại:

- `attribute_key` bằng đúng hàm `attributeKeyOf` của web ("Hệ Lửa" → Pyrus, chữ lạ → không có hệ).
- `search_text`: tên + mã + mã viết liền, đã bỏ dấu, để tìm kiếm.

### 2.3 Admin: từng con (`/api/admin/items…`, chỉ admin)

| API | Làm gì |
| --- | --- |
| `GET /admin/items` | Trang Kho: lọc nhóm (đang bán / đã bán / hàng tồn), hệ, bán trong n ngày, từ khoá (tên, mã, tên feed, người mua, mã đơn), 20 con mỗi trang; kèm số con từng nhóm và tổng tiền đã bán |
| `GET /admin/items/leftovers` | Hàng tồn để đưa vào feed mới |
| `GET /admin/items/next-codes` | Vài mã kế tiếp để gợi ý trong form |
| `GET /admin/items/sellable` | Con còn bán để chọn khi tạo đơn (tối đa 30) |
| `PUT /admin/items/:id` | Sửa một con; con đã bán không đổi giá; mã trùng → 409 ở ô mã |
| `POST /admin/items/:id/mark-sold` | Bán ngoài web (Messenger, livestream, tại shop), ghi tên người mua / ghi chú |
| `POST /admin/items/:id/mark-available` | Bỏ đánh dấu, chỉ với con admin tự đánh dấu (con bán qua đơn thì huỷ đơn) |
| `DELETE /admin/items/:id` | Xoá con chưa bán và chưa từng nằm trong đơn nào |

Trang Kho lọc, đếm và phân trang **bằng SQL** (số con tăng dần theo năm tháng). Tìm tên người mua hay tên feed
không cần gõ dấu: bảng dùng kiểu so khớp `utf8mb4_0900_ai_ci` của MySQL ("duc" khớp "Đức").

### 2.4 Tải ảnh / video (`POST /api/admin/uploads`, chỉ admin)

Web gửi form gồm `file` và `kind` (`image` / `video`), nhận về `{ url: "/uploads/…" }` — đúng như web đang gọi.

1. Kiểm tra quyền admin **trước khi nhận file**: người lạ không ghi được gì xuống ổ.
2. File được ghi thẳng xuống thư mục tạm `.tmp` (không giữ cả file trong RAM), tối đa 100 MB.
3. Đọc vài byte đầu để biết **đúng là ảnh / video**, không tin đuôi file hay loại file trình duyệt khai.
   Không nhận SVG (có thể chứa mã độc). Chữ đổi tên thành `.png` → 422.
4. Ảnh: xoay đúng chiều, thu về 1600 px, xuất WebP, bỏ EXIF / GPS; ảnh "bom" quá 100 triệu điểm ảnh bị từ chối.
   Lưu ở `img/<năm>/<tháng>/<mã ngẫu nhiên>.webp`.
5. Video: chuyển nguyên file sang `video/<năm>/<tháng>/<mã ngẫu nhiên>.mp4|mov|webm`.
6. Ghi bảng `media` (đường dẫn, loại, dung lượng, kích thước ảnh, mã băm SHA-256, ai tải). Lỗi giữa chừng thì
   không để lại file nào.

**Dọn file**:

- Lưu feed / con: ảnh / video được đánh dấu "đang dùng" (khoá dòng `media` tới hết transaction).
- Ảnh bị thay hoặc bỏ: sau khi lưu xong, kiểm tra không còn feed, con Bakugan, đơn hàng, đấu giá hay bài blog
  nào dùng thì xoá dòng `media` rồi xoá file. Hai việc chen nhau (một bên đang dùng, một bên đang dọn) cũng
  không xoá nhầm vì cùng khoá dòng `media`.
- File tải lên mà không bao giờ dùng tới (admin tải ảnh rồi đóng trang): việc chạy nền ở giai đoạn 4–5 dọn sau 24 giờ.
- File tạm sót lại khi backend tắt giữa chừng: lúc khởi động, file tạm cũ hơn 1 giờ bị xoá.

**Trả file cho khách**:

- Mini PC: Caddy trả thẳng thư mục ảnh, cache 1 năm, tua video được, chạy với CSP `sandbox`
  (lỡ có file lạ cũng không chạy được mã), **giấu thư mục `.tmp`**.
- Khi lập trình: backend tự trả `/uploads` với cùng các header đó; Vite chuyển `/uploads` sang backend
  (`DEV_API_PROXY`).

### 2.5 Thay đổi khác

| Chỗ | Đổi gì |
| --- | --- |
| Biến môi trường | `UPLOAD_DIR`: trên mini PC `/data/uploads` (đã đặt trong `deploy/docker-compose.yml`); khi lập trình để trống = `backend/uploads` (không commit) |
| Thư viện mới | `sharp` (xử lý ảnh, có sẵn bản cho Windows và Linux), `file-type` (nhận diện file), `multer` (nhận file) |
| `deploy/Caddyfile` | Giấu `.tmp` trong `/uploads` |
| `deploy/backup.sh` | Sao lưu ảnh bỏ qua `.tmp` |
| `vite.config.ts` | `DEV_API_PROXY` chuyển cả `/uploads` |
| Dùng chung với web | `formatItemCode`, `normalizeItemCode` (mã BK) qua `backend/src/shared/catalog.ts` |
| Nhật ký admin | `src/lib/audit.ts`: ghi bảng `audit_logs` trong cùng transaction với thao tác |

## 3. Khác với kế hoạch / bản giả lập

| Chỗ | Bản thật làm | Lý do |
| --- | --- | --- |
| Tìm kiếm phía khách | Lọc trên danh sách feed đệm trong bộ nhớ, đúng y như bản giả lập (kế hoạch 8.3 định dùng `LIKE` trong SQL) | Tối đa 30 feed × 60 con, lọc trong bộ nhớ nhanh hơn và kết quả giống hệt web đang chạy. Trang Kho (không giới hạn số con) thì dùng SQL |
| Giờ mở bán | Tính theo đồng hồ của backend | Backend và MySQL chạy chung một máy |
| Feed bị gỡ | Giữ dòng trong bảng (`retired_at`), xoá ảnh lô | Số feed không bao giờ bị dùng lại |
| Chặn thêm | Không đưa con đã bán (của feed đã gỡ) vào feed mới; ảnh lặp hay con lặp trong một feed; giá quá lớn | Bản giả lập cho qua, bản thật có thể làm sai số liệu |
| Câu báo lỗi mới | Tiêu đề tối đa 150 ký tự, mô tả tối đa 5.000, nhà cung cấp tối đa 150 | Theo độ dài cột trong MySQL |

## 4. Kiểm thử

**Backend** (`test/integration/catalog.test.ts` 19 test, `uploads.test.ts` 7 test), cùng 67 test cũ: 93/93 qua.

| Nhóm | Thử gì |
| --- | --- |
| Quyền | Chưa đăng nhập → 401; tài khoản khách → 403 ở mọi API admin; tải file bị chặn trước khi ghi xuống ổ |
| Đăng feed | Số feed, mã tự cấp / tự gõ, thứ tự con, nhận ra hệ, `search_text`, ảnh đánh dấu đang dùng, nhật ký admin |
| Phía khách | Không lộ giá nhập / người mua; tìm không dấu, mã viết liền, nhiều hệ, khoảng giá; gợi ý; by-ids; feed hẹn giờ |
| Kiểm tra dữ liệu | Đúng câu lỗi từng ô / từng con; link ảnh lạ, ảnh ở chỗ video và ngược lại → 422; mã trùng (cả trong cùng feed) → 409 và không ghi dở gì |
| Sửa / xoá | Đổi thứ tự, hàng tồn, con đã bán giữ giá, ảnh bị thay xoá khỏi ổ, khách thấy ngay; bán / bỏ bán, bán hết thì "đã bán hết"; sửa riêng một con; xoá con; xoá feed giữ lịch sử |
| Trang Kho | Đếm từng nhóm, lọc, tìm "duc" ra "Nguyễn Đức", tìm theo tên feed, phân trang, tổng tiền, gợi ý mã |
| Đăng cùng lúc | 5 lần đăng chen nhau: số feed và mã BK không trùng |
| Giới hạn 30 feed | Đủ 30 thì 409; xác nhận sai feed → 409; xác nhận đúng + mang hàng tồn sang |
| Tải ảnh | Ảnh điện thoại xoay EXIF → đúng chiều, 1600 px, WebP, hết EXIF; mã băm đúng; header khi trả file |
| File giả | Chữ đổi tên `.png`, SVG có mã, video gửi như ảnh, ảnh hỏng, ảnh > 15 MB, thiếu file → bị từ chối, không để lại file |
| Video | MP4 giữ nguyên byte; ảnh gửi như video bị từ chối |
| `/uploads` | Không lộ `.tmp`, không thoát ra ngoài thư mục |

**Trình duyệt thật** (backend + MySQL + web với `VITE_USE_MOCK=false`), 19/19 qua:

1. Admin (tạo bằng `admin:create`) đăng feed qua giao diện: ảnh lô, ảnh riêng và video của con → file nằm trong `backend/uploads`, mã BK-0001.
2. Khách (điện thoại): trang chủ, trang feed (ảnh hiện qua `/uploads`), trang chi tiết con, video tải và tua được, tìm không dấu.
3. Bản cho khách không có giá nhập / người mua.
4. Admin: trang Kho, đánh dấu bán ngoài web → khách thấy SOLD ngay; sửa feed qua giao diện; xoá feed → ảnh lô bị xoá khỏi ổ, ảnh của con đã bán vẫn giữ.

Thêm: `deploy/Caddyfile` qua `caddy validate`; `sharp` chạy được trong image Node của mini PC.

Ở bản dữ liệu thật, các trang khác (đơn hàng, đấu giá, chat, blog, số đếm trên menu admin) vẫn báo 404 vì API chưa
làm tới. Bản giả lập trên Vercel vẫn chạy bình thường.

## 5. Việc tiếp theo

- **Giai đoạn 4–5**: đặt hàng (chống bán trùng một con cho hai người), đơn của khách, admin xử lý đơn, mã giảm giá,
  thanh toán thẻ với cổng giả lập ở server, sự cố về tiền (không tự hoàn tiền), việc chạy nền (huỷ đơn quá hạn,
  dọn file tải lên không dùng sau 24 giờ).
