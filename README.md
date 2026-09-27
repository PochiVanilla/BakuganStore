# TD Bakugan — Frontend

Website thương mại điện tử cho shop **TD Bakugan** (chuyên đồ chơi/sưu tầm Bakugan tại Việt Nam).
Giai đoạn này là **frontend thuần**, chạy hoàn toàn trên mock data, nhưng kiến trúc đã sẵn sàng
nối với backend TypeScript (Node.js) — chỉ cần đổi biến môi trường, không phải sửa component.

Shop **bán theo feed**: mỗi feed là một lô hàng (ảnh chụp cả lô + danh sách từng con), mỗi con
Bakugan là **duy nhất** — có tên và mã riêng (`BK-0231`), tình trạng riêng, không có số lượng; bán
rồi hiện **SOLD**. Sàn đấu giá chỉ dành cho **thành viên Lv2**, không công khai tên người đặt.

Giao diện: dark mode, neon/glow theo logo TD (tím/cyan + trăng khuyết vàng).
Toàn bộ nội dung bằng tiếng Việt, tiền tệ VND (`1.250.000₫`).

---

## 1. Công nghệ

| Hạng mục | Lựa chọn |
| --- | --- |
| Framework | React 19 + TypeScript (strict) + Vite 8 |
| Styling | Tailwind CSS v4 (cấu hình CSS-first qua `@theme`) |
| Routing | React Router v7 (chế độ khai báo, API tương thích v6) |
| State | Zustand v5 + middleware `persist` (localStorage) |
| Form | React Hook Form + Zod v4 |
| HTTP | Axios (interceptor gắn token, chuẩn hoá lỗi) |
| Icon / Animation | lucide-react, Framer Motion |
| SEO | react-helmet-async (title/meta theo từng trang) |
| Chất lượng | ESLint (flat config + jsx-a11y + react-hooks), Prettier |

> **Ghi chú về phiên bản:** prompt gốc yêu cầu React 18 / React Router v6 / `tailwind.config.ts`.
> Repo này đã được khởi tạo sẵn với React 19, React Router v7 và Tailwind v4 nên dự án dùng
> đúng các phiên bản đã cài. Về mặt API, React Router v7 ở chế độ khai báo giữ nguyên
> `BrowserRouter / Routes / Route / useNavigate…` như v6; còn Tailwind v4 đã bỏ file
> `tailwind.config.ts` và khai báo theme trực tiếp trong CSS (`src/styles/globals.css`).

---

## 2. Chạy dự án

```bash
npm install
npm run dev        # http://localhost:3000
```

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy dev server |
| `npm run build` | Typecheck (`tsc -b`) + build production vào `dist/` |
| `npm run preview` | Xem thử bản build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Chỉ kiểm tra kiểu |
| `npm run format` | Prettier |

**Tài khoản demo:**

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Khách thành viên Lv2 (đã mua nhiều, đấu giá được) | `demo@tdbakugan.vn` | `Bakugan123` |
| Khách mới Lv1 (chưa đấu giá được) | `khachmoi@tdbakugan.vn` | `Bakugan123` |
| Quản trị | `admin@tdbakugan.vn` | `TdAdmin@2026` (phải đúng) |

Ở chế độ mock, mọi email đúng định dạng + mật khẩu ≥ 8 ký tự đều đăng nhập được với vai trò
khách. Trang đăng nhập có nút điền sẵn các tài khoản trên (chỉ hiện khi `VITE_USE_MOCK` bật).

---

## 3. Deploy lên Vercel

Repo đã có sẵn `vercel.json` (rewrite mọi route về `index.html` cho SPA + cache `assets/`).

**Cách 1 — qua GitHub (khuyến nghị, auto-deploy mỗi lần push):**

1. Vào [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → chọn repo này.
2. Vercel tự nhận framework **Vite**; giữ nguyên `npm run build` và output `dist`.
3. Bấm **Deploy**. Từ đó mỗi lần push lên branch là Vercel build lại tự động.

**Cách 2 — qua CLI:**

```bash
npm i -g vercel
vercel          # tạo bản preview
vercel --prod   # đẩy lên production
```

**Biến môi trường** (Project Settings → Environment Variables), chỉ cần khi có backend:

| Biến | Mock (hiện tại) | Khi có backend |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` (mặc định) | `false` |
| `VITE_API_BASE_URL` | – | `https://api.tdbakugan.vn/api` |
| `VITE_WS_URL` | – | `wss://api.tdbakugan.vn/ws` |
| `GEMINI_API_KEY` | khoá Gemini để bot chat trả lời bằng AI (tuỳ chọn) | như cũ |
| `GEMINI_MODEL` | tuỳ chọn, mặc định `gemini-flash-latest` | như cũ |

Xem mẫu trong `.env.example`.

**Bật trợ lý AI (Gemini, miễn phí):**

1. Vào [Google AI Studio](https://aistudio.google.com/apikey) → **Create API key** (gói miễn phí).
2. Trên Vercel: **Settings → Environment Variables** → thêm `GEMINI_API_KEY` (không có tiền tố
   `VITE_`, để khoá chỉ nằm ở server) → **Redeploy**.
3. Vào `/admin/cai-dat` → bấm **Kiểm tra kết nối**: thấy "Gemini đang trả lời bình thường" là xong.
   Nếu lỗi, ô này ghi rõ lý do (chưa có khoá, khoá sai, Google chặn khoá, hết hạn mức, không có
   model…) và cách sửa. Dùng ô **Thử bot** để xem bot trả lời thế nào trước khi mở cho khách.

Endpoint tự thử lần lượt `GEMINI_MODEL` (nếu có) → `gemini-flash-latest` → `gemini-2.5-flash` →
`gemini-2.0-flash`, nên không cần đặt `GEMINI_MODEL` trừ khi muốn ghim một model.

Chưa có khoá, hết hạn mức miễn phí hoặc Gemini lỗi → bot tự lùi về bộ trả lời theo từ khoá
(`src/features/chat/ruleBot.ts`). Bộ này hiểu câu có dấu / không dấu và kiểu viết tắt khi chat
("ko", "dc", "sp", "bh"…), trả lời được: tra đơn, con nào còn / đã SOLD (theo tên hoặc mã BK),
feed nào đang / sắp mở bán, gợi ý theo hệ / dòng / tầm giá / rẻ nhất / mạnh nhất, cách lên Lv2,
phí và thời gian ship, thanh toán, đổi trả, luật đấu giá, mã giảm giá, địa chỉ, kiến thức Bakugan. Câu chưa hiểu thì bot hỏi lại kèm gợi ý; hỏi lại vẫn không hiểu mới chuyển
nhân viên. Chạy thử ở máy: tạo `.env.local` có `GEMINI_API_KEY=...` rồi `npm run dev` (dev server
tự chạy luôn `api/chat-bot.ts`).

---

## 4. Cấu trúc thư mục

```
src/
├── app/                     # Router, layout, providers, ScrollToTop
│   ├── App.tsx              # Khai báo route + code-splitting (React.lazy)
│   ├── layouts/Layout.tsx   # Header + Footer + MobileMenu + MiniCart + Toast
│   └── providers/           # HelmetProvider, BrowserRouter
├── components/
│   ├── ui/                  # Button, Input, Card, Badge, Modal, Drawer, Toast,
│   │                        # Skeleton, Countdown, ImageGallery, RefImage, Pagination, Seo…
│   └── layout/              # Header, Footer, MobileMenu, Logo, SearchBox, AccountMenu
├── features/                # Theo nghiệp vụ, mỗi feature tự chứa logic + UI
│   ├── auth/                # schemas.ts (Zod), AuthLayout, PasswordStrengthMeter,
│   │                        # ProtectedRoute, legalContent
│   ├── feed/                # FeedCard, FeedGallery, ItemCard (SOLD, mã BK), FeedProgress
│   ├── auction/             # AuctionCard, BidForm (chặn Lv1), useAuctionSocket
│   ├── cart/                # MiniCart (drawer)
│   ├── chat/                # ChatWidget, ruleBot, consultFlow (tư vấn chọn Bakugan), botActions
│   ├── admin/               # AdminLayout, adminUi, schemas
│   ├── blog/                # BlogCard
│   ├── account/             # Tab: Profile, Address, Orders, BidHistory, Membership, ChangePassword
│   └── home/                # Hero, CategoryGrid, Commitments
├── pages/                   # 1 file = 1 route, export default để lazy-load
├── services/api/            # Axios instance + service theo domain (hiện trả mock)
├── mocks/                   # db.ts (kho dữ liệu localStorage), seed.ts (28 feed, ~400 con,
│                            # khách, đơn, hạng thành viên), models.ts, đấu giá, blog, coupon
├── store/                   # Zustand: cart, wishlist, auth, ui (toast/menu)
├── hooks/                   # useAsync, useCountdown, useDebouncedValue, useMediaQuery,
│                            # useClickOutside, useLockBodyScroll, useLatestRef
├── types/                   # FeedPost, BakuganItem, Auction, User, CartItem, Order, BlogPost…
├── constants/               # routes.ts (URL tiếng Việt), catalog.ts (nhãn hệ/series…)
├── utils/                   # formatCurrency, slugify, cn, itemCode
└── styles/globals.css       # Tailwind v4 @theme: màu, font, glow, animation
```

---

## 5. Các trang

| Route | Trang |
| --- | --- |
| `/` | Màn intro (chỉ lần đầu trên mỗi máy, chạm bất kỳ đâu để vào ngay), feed mới nhất, **chọn theo hệ chiến đấu**, băng **feed trượt ngang** (vuốt / kéo chuột / mũi tên, tổng tối đa 10 feed), nút **Tư vấn chọn Bakugan**, đấu giá, cách lên Lv2, blog, cam kết |
| `/feed` | Mọi feed trên web (tối đa 30): lọc đang bán / sắp mở bán / đã bán hết, theo hệ, tìm theo tên / mã BK |
| `/feed/:number` | Ảnh cả lô (phóng to), danh sách từng con: mã BK, tình trạng riêng, SOLD, thêm vào giỏ; `#BK-0231` cuộn tới đúng con đó |
| `/dau-gia` | Danh sách phiên: đang diễn ra / sắp diễn ra / đã kết thúc + thể lệ |
| `/dau-gia/:id` | Đếm ngược, giá cao nhất + **số người đã đặt** (không lộ tên ai), lượt đặt của chính mình, cảnh báo bị vượt giá; khách Lv1 thấy 3 cách lên Lv2 |
| `/gio-hang` | Từng con một (không có số lượng), tự loại con vừa có người mua, mã giảm giá, **chốt đơn trên web** (COD / chuyển khoản / MoMo) |
| `/yeu-thich` | Những con đã thích, còn bán hay đã SOLD |
| `/blog`, `/blog/:slug` | Tìm kiếm, lọc theo danh mục & thẻ, bài nổi bật, bài liên quan |
| `/lien-he` | Form có validate, Zalo/Messenger, bản đồ nhúng |
| `/tai-khoan` | **Route bảo vệ** — thông tin, sổ địa chỉ, đơn hàng, lịch sử đấu giá, **hạng thành viên**, đổi mật khẩu |
| `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` | Xác thực |
| `/dieu-khoan`, `/chinh-sach-bao-mat`, `/chinh-sach-van-chuyen`, `/chinh-sach-doi-tra` | Trang chính sách |
| `*` | 404 theo phong cách thương hiệu |

Link cũ `/san-pham`, `/san-pham/*`, `/hang-moi` tự chuyển về `/feed`; `/gioi-thieu` (đã bỏ) về
trang chủ.

### Bán theo feed

- **Feed** = một lô: 1–6 ảnh chụp cả lô (ảnh đầu là ảnh bìa) + danh sách từng con. Feed có thể
  **mở bán ngay** hoặc **hẹn giờ** (VD 20:00) — trước giờ đó khách xem trước danh sách nhưng chưa
  thêm vào giỏ được.
- **Mỗi con là duy nhất**: chủ shop đặt tên, mã BK tự cấp (hoặc tự gõ), hệ, dòng, tình trạng +
  ghi chú riêng (trầy nhẹ, lỏng khớp…), G-Power, ảnh riêng nếu có. Khách chốt đơn → con đó
  chuyển **SOLD** ngay; đơn huỷ / hoàn thì con đó được mở bán lại.
- **Tối đa 30 feed trên web.** Đăng feed thứ 31 → web hỏi admin xác nhận xoá feed cũ nhất, báo
  feed đó đã bán hết chưa; nếu còn con chưa bán thì liệt kê ra và cho **đưa luôn vào feed mới**
  (bỏ chọn thì chúng nằm ở "Hàng tồn" để đăng sau). Lịch sử bán và đơn hàng của feed cũ vẫn giữ.
- Ở bản mock, ảnh admin tải lên được thu nhỏ (cạnh dài 1600px, WebP) và lưu trong IndexedDB của
  trình duyệt; khi có backend thì thay `src/services/api/imageStore.ts` bằng upload lên kho ảnh.

### Hạng thành viên (đấu giá)

Tài khoản mới là **Lv1** — mua hàng bình thường. Muốn đặt giá đấu giá phải lên **Lv2** bằng
**một trong ba cách**:

1. Nhận đủ **3 con** mua ở TD shop (tính khi đơn hoàn tất) — tự lên hạng.
2. **Nạp tiền thành viên** (mặc định 500.000₫, đổi ở `/admin/cai-dat`): khách chuyển khoản theo
   nội dung `TDLV2 <SĐT>` rồi bấm "Tôi đã chuyển khoản", admin đối soát và duyệt.
3. Gửi yêu cầu để **admin xét duyệt** (khách quen, mua tại shop…).

Khách xem tiến độ ở **Tài khoản → Hạng thành viên**. Việc chặn đặt giá được kiểm tra ở tầng
"server" (`placeBid`), không chỉ ở giao diện.

### Trợ lý AI tư vấn chọn Bakugan

Nút **Tư vấn chọn Bakugan** (trang chủ, khung chat) mở chat và hỏi khách mới 4 câu có nút trả lời
nhanh: mua để làm gì → thích hệ nào (kèm màu, tính cách từng hệ) → ngân sách → tình trạng. Khách
cũng gõ tự do được ("xanh lá", "tầm 1tr5", "cũ cũng được"), nói sẵn trong câu đầu ("tư vấn con hệ
lửa dưới 500k") thì bot bỏ qua câu đã biết. Cuối cùng bot gợi ý tối đa 3 con **đang còn bán**, nêu
lý do, kèm nút mở đúng con đó trong feed; không có con khớp đủ thì nói rõ đã nới tiêu chí nào.
Phần này chạy bằng luật cố định (`src/features/chat/consultFlow.ts`) nên trả lời ngay, không tốn
hạn mức Gemini.

### Khu vực quản trị (`/admin`)

Chỉ tài khoản có vai trò **admin** vào được. Đăng nhập bằng tài khoản quản trị sẽ được đưa thẳng
vào đây; menu tài khoản ở cửa hàng cũng có mục "Trang quản trị".

| Route | Trang |
| --- | --- |
| `/admin` | Bảng điều khiển: doanh thu, số đơn, tỉ lệ huỷ (so với kỳ trước), việc cần xử lý (gồm yêu cầu lên Lv2), biểu đồ doanh thu 14 ngày, đơn theo trạng thái, tình hình feed (đang bán, đã bán hết, hàng tồn, x/30 feed) |
| `/admin/don-hang` | Mọi đơn (web / đấu giá / admin tạo): lọc trạng thái, nguồn, thời gian, tìm kiếm, xuất CSV |
| `/admin/don-hang/:id` | Đổi trạng thái theo đúng quy trình, huỷ có lý do (các con trong đơn được mở bán lại), hoàn hàng, xác nhận tiền / hoàn tiền, báo sự cố, ghi chú nội bộ, lịch sử xử lý |
| `/admin/don-hang/tao-moi` | Tạo đơn cho khách có tài khoản hoặc khách lẻ (VD chốt qua Zalo), chọn từng con theo tên / mã BK, sửa giá, phí ship, giảm giá |
| `/admin/dau-gia` | Phiên đang chạy, phiên thắng chờ tạo đơn (liên hệ người thắng), tạo đơn đấu giá, đánh dấu bỏ cọc. Admin thấy cả giá phiên kín |
| `/admin/feed` | **Giám sát theo feed**: x/30 feed, danh sách **feed đã bán hết** (gỡ khỏi web một chạm), mỗi feed đã bán bao nhiêu, doanh thu, giá nhập lô, lãi; xoá feed (báo con còn tồn) |
| `/admin/feed/dang-moi`, `/admin/feed/:id` | Đăng / sửa feed: ảnh cả lô, từng con (tên gợi ý theo mẫu, mã BK tự cấp, hệ, dòng, giá, tình trạng, ghi chú, ảnh riêng), thêm từ hàng tồn, giờ mở bán, giá nhập lô |
| `/admin/bakugan` | **Giám sát từng con**: còn bán / đã bán / hàng tồn, bán cho ai, qua đơn nào, tổng tiền đã bán; đánh dấu SOLD khi bán ngoài web, bỏ SOLD, sửa, xoá hàng tồn |
| `/admin/huy-va-su-co` | Báo cáo đơn huỷ (theo lý do), đơn hoàn trả, sự cố giao hàng / thanh toán — nhận xử lý, đóng sự cố kèm cách giải quyết, xuất CSV |
| `/admin/khach-hang` | Danh sách khách: **hạng Lv1/Lv2**, lọc **chờ duyệt Lv2**, số đơn, tổng chi tiêu, đăng nhập gần nhất, liên kết ngân hàng, trạng thái |
| `/admin/khach-hang/:id` | Hồ sơ đầy đủ, **hạng thành viên** (duyệt / từ chối yêu cầu nạp tiền hoặc xét duyệt, cấp / hạ hạng), sổ địa chỉ, đơn hàng, lịch sử đấu giá, sửa thông tin, khoá tài khoản, cấp / thu hồi quyền admin, gửi link đặt lại mật khẩu |
| `/admin/tin-nhan` | Hộp thư chat: cuộc cần nhân viên trả lời, nhận lời thay bot, trả lại cho bot, câu trả lời mẫu |
| `/admin/cai-dat` | Bật/tắt trợ lý AI, chọn **những việc bot được tự giải quyết**, lời chào, ghi chú cho bot, thử bot; **số tiền nạp lên Lv2 và tài khoản nhận tiền của shop**; khôi phục dữ liệu mẫu |

**Bảo mật thông tin khách:**

- **Số tài khoản ngân hàng không bao giờ rời khỏi "server".** API quản trị dựng hồ sơ khách bằng
  cách *liệt kê từng trường được phép* (`toAdminCustomer` trong `src/services/api/admin/shared.ts`),
  nên số tài khoản không có mặt trong dữ liệu trả về — không phải chỉ bị ẩn trên giao diện. Admin
  chỉ thấy tên ngân hàng và tên chủ tài khoản. Khách tự xem được 4 số cuối của mình.
- **Quyền admin được kiểm tra ở từng API**, không chỉ ở route: mọi hàm trong
  `src/services/api/admin/` gọi `requireAdmin()` đọc token rồi tra vai trò. Backend thật phải làm
  y như vậy — ẩn menu ở giao diện không phải là bảo mật.
- Admin không đặt được mật khẩu hộ khách, chỉ gửi link đặt lại. Không tự khoá hay tự hạ quyền
  chính mình được.

**Trợ lý AI trong chat:** khách chat ở nút tròn góc phải (cả khách chưa đăng nhập). Bot chỉ được
biết dữ liệu của những chủ đề admin đang bật (đơn của chính khách đó, phí ship, đổi trả, luật đấu
giá, hàng còn…). Sửa đơn, hoàn tiền, khiếu nại, giữ hàng, trả giá, thu mua hàng cũ luôn được
chuyển nhân viên. Khoá Gemini nằm trong Vercel Function `api/chat-bot.ts`, có kiểm tra nguồn gọi,
giới hạn độ dài dữ liệu và giới hạn 8 lượt/phút mỗi IP để giữ hạn mức miễn phí.

- **Bot tự huỷ đơn** (chủ đề "Tự huỷ đơn chưa xác nhận"): khách đã đăng nhập nhắn "huỷ đơn" → bot
  hỏi lại "Bạn muốn huỷ đơn #… đúng không?" kèm nút **Đồng ý / Không**. Chỉ huỷ đơn của chính
  khách, còn "Chờ xác nhận" và chưa thanh toán; lời xác nhận hết hạn sau 10 phút. Việc huỷ viết
  bằng luật cố định (`src/features/chat/botActions.ts`), không để AI tự quyết. Đơn đã xác nhận,
  đang giao hoặc đã trả tiền → bot giải thích và chuyển nhân viên. Tài khoản demo có sẵn một đơn
  "Chờ xác nhận" để thử.
- **Đang chờ nhân viên**, bot vẫn trả lời các câu đơn giản để khách không phải đợi; khi nhân viên
  nhận cuộc chat thì bot dừng.

**Tài khoản nhận tiền của shop** để trống sẵn (không bịa số tài khoản): khi trống, trang xác
nhận đơn và mục Hạng thành viên nhắc khách nhắn shop để nhận số tài khoản. Điền ở
`/admin/cai-dat` → **Thành viên & thanh toán** là web hiện ngay cho khách.

**Dữ liệu demo:** ở chế độ mock, feed, đơn, khách, tin nhắn… lưu trong `localStorage` của
trình duyệt (`src/mocks/db.ts`), nên thao tác của admin còn nguyên sau khi tải lại trang và hiện
luôn ở phía khách (VD admin tạo đơn cho `demo@tdbakugan.vn` → khách thấy trong "Đơn hàng của
tôi"). Mở hai tab (một khách, một admin) là thấy tin nhắn cập nhật qua lại. Muốn làm lại từ đầu:
`/admin/cai-dat` → **Khôi phục dữ liệu mẫu**. Vì lưu theo từng trình duyệt, chat giữa hai máy khác
nhau chỉ chạy được khi đã nối backend thật.

---

## 6. Nối backend sau này

Mọi lời gọi mạng đi qua `src/services/api/`. Mỗi hàm service có sẵn **cả hai nhánh**:

```ts
export async function fetchFeeds(query: FeedQuery = {}): Promise<FeedPost[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<FeedPost[]>>('/feeds', { params: query });
    return data.data;            // ← nhánh HTTP thật
  }
  /* … lọc trên mock data … */   // ← nhánh mock hiện tại
}
```

Vì vậy để chuyển sang backend thật chỉ cần:

1. Đặt `VITE_USE_MOCK=false` và `VITE_API_BASE_URL` trỏ tới API.
2. Backend trả đúng hình dạng `ApiResponse<T>` / `Paginated<T>` khai báo trong `src/types`.

**Dùng chung schema:** `src/features/auth/schemas.ts` là nguồn chân lý duy nhất cho quy tắc
validate tài khoản (họ tên, email, SĐT Việt Nam, mật khẩu…). Backend TypeScript import lại đúng
file này để validate phía server — frontend và backend không bao giờ lệch quy tắc.

**Đấu giá realtime:** `useAuctionSocket` đã viết sẵn cả hai chế độ. Hiện tại giả lập người khác
đặt giá theo chu kỳ; khi đặt `VITE_WS_URL`, hook tự mở WebSocket tới
`${VITE_WS_URL}/auctions/:id` và phát ra cùng kiểu sự kiện `AuctionSocketEvent`.
Component dùng hook không phải sửa một dòng nào.

---

## 7. Hiệu năng & chất lượng

- **Lần tải đầu nhẹ (~185 kB JS nén)**: trang chủ đóng gói sẵn cùng khung trang; các trang khác
  là chunk riêng, được tải sẵn khi trình duyệt rảnh nên bấm là hiện ngay. Những thứ chưa cần lúc
  mở trang đều tải sau: thư viện form (react-hook-form + zod) chỉ ở trang có form, "bộ não" bot chat
  chỉ khi khách gửi tin đầu tiên, phần hiệu ứng của framer-motion (`LazyMotion`), và axios chỉ khi
  nối backend thật.
- **Vendor chunk tách riêng** (react / form) có độ ưu tiên để React không bị cuốn nhầm vào chunk
  form (`build.rolldownOptions.output.codeSplitting` trong `vite.config.ts`).
- **Màn chờ trong `index.html`** (nền tối + logo) hiện ngay khi HTML tới, không để màn hình trắng
  trong lúc JavaScript tải; font Google tải không chặn hiển thị, chỉ lấy các độ đậm đang dùng.
- **Dữ liệu mock trả về ngay** (không giả lập độ trễ mạng; bật lại bằng `VITE_MOCK_LATENCY=1`),
  danh sách feed được nhớ lại cho tới khi dữ liệu đổi.
- **Ảnh**: ảnh lô có bản 640 / 960 / 1280px, điện thoại tự tải bản nhỏ. Không dùng `backdrop-blur`
  trên thẻ và `background-attachment: fixed` (hai thứ làm điện thoại giật khi cuộn).
- **Lazy-load ảnh** (`loading="lazy"` + `width`/`height` chống layout shift).
- **Skeleton loading** cho mọi danh sách, không nhảy layout khi dữ liệu về.
- **Một timer duy nhất** cho tất cả đồng hồ đếm ngược (`useSyncExternalStore`).
- **TypeScript strict, không dùng `any`.** ESLint sạch, không có `eslint-disable` che lỗi.
- **Accessibility:** label cho mọi input, `alt` cho ảnh, `aria-*` đúng vai trò, điều hướng bàn
  phím (Escape đóng modal/drawer, mũi tên chọn gợi ý tìm kiếm), link "Bỏ qua điều hướng",
  `focus-visible` rõ trên nền tối, tôn trọng `prefers-reduced-motion`.
- **Không tự vẽ ảnh**: chỗ nào chưa có ảnh thật (feed mẫu, từng con, phiên đấu giá, bài blog) thì
  hiện khung trống; khi nối backend ảnh lấy từ database. Feed mới nhất dùng ảnh lô thật của shop
  (`public/feeds/`); admin tải ảnh thật lên khi đăng feed (không bắt buộc).
