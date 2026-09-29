# 03 · Không tự hoàn tiền; tên, hệ, tình trạng do shop tự gõ

| Mục | Nội dung |
| --- | --- |
| Ngày | 29/09/2026 |
| Giai đoạn | 0 → 1: chốt kế hoạch (bản 3) và sửa web theo quyết định mới |
| Đã làm | Luật tiền mới: hệ thống **không bao giờ tự hoàn tiền**. Web: tên, hệ, tình trạng của từng con là **ô chữ shop tự gõ**; **bỏ G-Power**. Cập nhật kế hoạch [01](01-ke-hoach-backend.md) lên bản 3 |
| Kết quả kiểm tra | `typecheck`, `lint`, `prettier`, `build` sạch. Bài thử mới cho ô tự gõ: 18/18. Chạy lại các bộ cũ: thanh toán 35 + 19 + 18, trang chi tiết 29 + 19, feed, admin đăng feed, chat khách vãng lai, bot tư vấn: đều qua |
| Việc tiếp theo | Giai đoạn 1 của kế hoạch: khung backend, MySQL, Gemini chạy trong backend, bộ cài mini PC (file 04) |

## 1. Quyết định của chủ shop

| Quyết định | Nghĩa là |
| --- | --- |
| "Tiền thì sẽ không refund" | Hệ thống **không tự hoàn tiền** trong bất kỳ trường hợp nào. Có vấn đề về tiền thì khách liên hệ shop, admin kiểm tra và tự quyết cách giải quyết |
| Tên và hệ "đừng làm sổ ra" | Form đăng feed không còn danh sách tên gợi ý, không còn hộp chọn hệ. Shop gõ đúng chữ mình muốn |
| "G-Power bỏ đi" | Không còn ô G-Power ở form, trang khách, CSDL |
| Tình trạng "để shop tự điền" | Không còn hộp chọn "Mới / Like new / Đã dùng" và ô ghi chú riêng. Một ô chữ duy nhất, có thể để trống |
| "Tiến hành làm backend đi" | Kế hoạch coi như đã duyệt. Hai luật chưa có ý kiến dùng theo đề xuất, đổi lúc nào cũng được (mục 3) |

## 2. Luật tiền mới

**Nguyên tắc**: tiền chỉ đi ra khỏi shop khi **admin bấm**. Hệ thống chỉ ghi nhận, báo admin, và nhắc khách liên hệ shop.

| Tình huống | Kế hoạch bản 2 | Bây giờ (bản 3) |
| --- | --- | --- |
| Khách trả thẻ trễ, đơn đã tự huỷ, **các con vẫn còn** | Giữ đơn lại cho khách | **Giữ nguyên**: không có tiền nào phải trả lại, khách nhận hàng như thường. Lịch sử đơn ghi rõ "trả trễ" |
| Khách trả thẻ trễ, **có con đã bán cho người khác** | Tự hoàn tiền về thẻ | Ghi nhận tiền vào đơn (đơn huỷ nhưng "đã thanh toán"), **tự mở sự cố "Lỗi thanh toán"**, báo admin |
| Khách trả **hai lần** cho một đơn | Tự hoàn lượt thừa | Ghi nhận lượt thừa, mở sự cố, báo admin |
| Lượt thẻ báo thành công **sau khi khách đã đổi sang COD / chuyển khoản** | Tự hoàn lượt đó | Ghi nhận, mở sự cố, báo admin (để shipper không thu tiền lần nữa) |
| Cổng báo **số tiền khác** tổng đơn | Đánh dấu bất thường, báo admin | Như cũ, thêm mở sự cố |
| Admin bấm "Hoàn tiền về thẻ" | Có | **Giữ**. Chỉ chạy khi admin bấm và xác nhận trong hộp hỏi lại |

**Khi có sự cố tiền** (làm ở giai đoạn 5, cùng phần thanh toán thẻ)
- **Admin** thấy sự cố ở trang "Sự cố" có sẵn (loại "Lỗi thanh toán", người báo "Hệ thống") và trên số đếm ở menu. Trang tổng quan có dòng nhắc; có email báo shop khi đã cài gửi thư.
- **Khách** thấy trên trang đơn của mình: "Shop đã nhận khoản thanh toán của bạn nhưng đơn cần kiểm tra lại. Bạn nhắn shop để được hỗ trợ", kèm nút mở chat.
- **Admin tự quyết**: hoàn tiền (bấm nút), đổi con khác cho khách, giữ tiền cho đơn sau… Đóng sự cố phải ghi cách đã giải quyết.
- **Bot chat**: khách hỏi hoàn tiền thì bot chuyển nhân viên (đã làm sẵn). Dữ kiện gửi Gemini có thêm câu "hệ thống không tự hoàn tiền; khách nhắn shop để nhân viên giải quyết".

**Đã sửa ở web ngay trong lần này**
- **Trang điều khoản**, mục "Đặt hàng và thanh toán": thêm câu "Có vấn đề về tiền (bị trừ tiền nhưng đơn đã huỷ, trả hai lần, sai số tiền…): bạn liên hệ shop…; hệ thống không tự hoàn tiền".
- **Trang đơn của admin**: câu nhắc khi huỷ đơn đã trả tiền đổi từ "bấm hoàn tiền…" thành "Hệ thống không tự hoàn tiền: liên hệ khách để thống nhất cách giải quyết; nếu hoàn thì bấm…".
- Web giả lập **vốn không có chỗ nào tự hoàn tiền**: cổng giả lập từ chối trả tiền khi đơn đã quá hạn, nên không xảy ra trả trễ. Luật mới chủ yếu nằm ở backend (giai đoạn 5).

## 3. Hai luật dùng theo đề xuất

| Luật | Chốt |
| --- | --- |
| (a) Đơn chuyển khoản quá 24 giờ chưa nhận tiền | Tự huỷ **chỉ khi đơn còn "Chờ xác nhận"**. Admin đã xác nhận đơn thì để admin quyết |
| (b) Mã `TDNEW10` | Chỉ dùng cho **đơn đầu tiên** của mỗi tài khoản |

## 4. Tên, hệ, tình trạng do shop tự gõ

### 4.1 Form và giới hạn

| Ô | Trước | Bây giờ |
| --- | --- | --- |
| Tên | Ô chữ kèm danh sách gợi ý; chọn tên thì tự điền hệ, dòng, G-Power | Ô chữ tự gõ, 2–80 ký tự, không gợi ý, không tự điền |
| Hệ | Hộp chọn 6 hệ | Ô chữ **bắt buộc**, tối đa 40 ký tự (VD "Pyrus", "Hệ Lửa", "Aurelus") |
| Tình trạng | Hộp chọn 3 mức + ô ghi chú riêng | **Một** ô chữ, tối đa 160 ký tự, được để trống (VD "Like new, trầy nhẹ ở chân") |
| G-Power | Ô số | Bỏ |

Sửa ô nào thì báo lỗi của ô đó tắt ngay, không phải chờ bấm "Đăng feed" lần nữa. Hộp "Sửa" từng con ở trang Kho cũng đổi y như vậy.

### 4.2 Vẫn có icon, bộ lọc và bot tư vấn

Chữ shop gõ được **nhận ra** bằng hai hàm dùng chung (`src/constants/catalog.ts`), backend cũng dùng lại đúng hai hàm này:

- `attributeKeyOf(chữ)`: nhận ra 6 hệ quen thuộc, không phân biệt hoa thường hay dấu.
  - "Pyrus", "Hệ Lửa", "lửa", "fire" → Pyrus. "Hệ Đất", "earth" → Subterra.
  - Chữ lạ như "Aurelus" → không nhận ra: vẫn hiện đúng chữ đó, nhưng không có icon và không lọc theo 6 hệ.
- `conditionGradeOf(chữ)`: xếp tình trạng vào 3 mức, chỉ để bot tư vấn lọc.
  - Mới: "nguyên seal", "chưa bóc", "new".
  - Like new: "like new", "như mới", "95%".
  - Đã dùng: "đã qua sử dụng", "cũ", "trầy", "used".
  - Không nhận ra: bot không lọc con đó theo tình trạng.

| Chỗ dùng | Hành vi |
| --- | --- |
| Thẻ sản phẩm, trang chi tiết, giỏ hàng, đấu giá | Hiện đúng chữ shop gõ. Hệ quen thuộc có icon và màu của hệ |
| Bộ lọc `?he=pyrus` | Lọc theo hệ nhận ra được. "Hệ Lửa" vẫn ra khi lọc Pyrus |
| Bot tư vấn | Lọc theo hệ và mức tình trạng nhận ra được. Hỏi "con nào mạnh nhất" thì bot nói shop không ghi chỉ số sức mạnh và gợi ý vài con đang bán |
| Kiến thức chung của bot | Vẫn giải thích được "G-Power là gì" (khái niệm trong trò chơi), chỉ là shop không ghi cho từng con |

Tìm kiếm cũng sửa luôn một lỗi nhỏ: chữ "Đ" viết hoa trước đây không được đổi thành "d" khi bỏ dấu (gõ "Đất" không khớp). Bây giờ khớp.

### 4.3 Dữ liệu cũ được nâng cấp tự động

| Nơi | Nâng cấp |
| --- | --- |
| CSDL giả lập trong trình duyệt (bản 5 → 6) | Mã hệ → tên hệ ("darkus" → "Darkus"); mức tình trạng + ghi chú gộp thành một câu ("Đã qua sử dụng — Trầy nhẹ"); bỏ G-Power |
| Giỏ hàng đã lưu (bản 3 → 4) | "pyrus" → "Pyrus", "like-new" → "Like new" |

### 4.4 Ảnh hưởng tới backend (đã sửa trong kế hoạch bản 3)

- Bảng `items` và `auctions`:
  - `attribute VARCHAR(40) NOT NULL` là chữ shop gõ.
  - `attribute_key` là hệ nhận ra được, có chỉ mục để lọc. Server tính bằng `attributeKeyOf` mỗi lần lưu.
  - `condition VARCHAR(160) NULL`.
  - Bỏ `g_power` và `condition_note`.
- Tìm kiếm lọc theo `attribute_key`. Bỏ lọc theo tình trạng (web không còn gửi).
- Nếu sau này thêm cách gọi mới cho một hệ, chạy lại lệnh `items:rekey` để tính lại `attribute_key` cho hàng cũ.

## 5. File web đã đổi

| Nhóm | File |
| --- | --- |
| Kiểu dữ liệu, nhận ra chữ | `src/types/index.ts`, `src/constants/catalog.ts`, `src/utils/slugify.ts` |
| Form admin | `src/pages/admin/FeedEditorPage.tsx`, `src/pages/admin/ItemsAdminPage.tsx`, `src/services/api/admin/feeds.ts`, `src/services/api/admin/items.ts` |
| Trang khách | `src/components/ui/Badge.tsx`, `src/features/feed/ItemCard.tsx`, `src/features/feed/feedUi.ts`, `src/pages/ItemDetailPage.tsx`, `src/pages/CartPage.tsx`, `src/features/auction/AuctionCard.tsx`, `src/pages/AuctionDetailPage.tsx`, `src/services/api/feedService.ts` |
| Dữ liệu giả lập và giỏ | `src/mocks/db.ts`, `src/mocks/seed.ts`, `src/mocks/models.ts`, `src/mocks/auctions.ts`, `src/store/cartStore.ts` |
| Bot | `src/features/chat/botKnowledge.ts`, `src/features/chat/consultFlow.ts`, `src/features/chat/ruleBot.ts`, `api/chat-bot.ts` |
| Luật tiền | `src/features/auth/legalContent.tsx`, `src/pages/admin/OrderDetailPage.tsx`, `src/features/chat/botKnowledge.ts` |
