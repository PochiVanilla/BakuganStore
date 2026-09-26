# TD Bakugan — Frontend

Website thương mại điện tử cho shop **TD Bakugan** (chuyên đồ chơi/sưu tầm Bakugan tại Việt Nam).
Giai đoạn này là **frontend thuần**, chạy hoàn toàn trên mock data, nhưng kiến trúc đã sẵn sàng
nối với backend TypeScript (Node.js) — chỉ cần đổi biến môi trường, không phải sửa component.

Giao diện: dark mode, neon/glow theo bộ nhận diện của logo (tím/hồng/cyan + mặt trăng vàng).
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
| Khách hàng | `demo@tdbakugan.vn` | bất kỳ từ 8 ký tự (VD `Bakugan123`) |
| Quản trị | `admin@tdbakugan.vn` | `TdAdmin@2026` (phải đúng) |

Ở chế độ mock, mọi email đúng định dạng + mật khẩu ≥ 8 ký tự đều đăng nhập được với vai trò
khách. Trang đăng nhập có nút điền sẵn cả hai tài khoản (chỉ hiện khi `VITE_USE_MOCK` bật).

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
3. Vào `/admin/cai-dat`: ô trạng thái chuyển sang "Đã kết nối Gemini"; dùng ô **Thử bot** để xem
   bot trả lời thế nào trước khi mở cho khách.

Chưa có khoá, hết hạn mức miễn phí hoặc Gemini lỗi → bot tự lùi về bộ trả lời theo từ khoá, khách
vẫn được trả lời các câu cơ bản. Chạy thử ở máy: tạo `.env.local` có `GEMINI_API_KEY=...` rồi
`npm run dev` (dev server tự chạy luôn `api/chat-bot.ts`).

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
│   │                        # Skeleton, Countdown, Rating, Pagination, Seo…
│   └── layout/              # Header, Footer, MobileMenu, Logo, SearchBox, AccountMenu
├── features/                # Theo nghiệp vụ, mỗi feature tự chứa logic + UI
│   ├── auth/                # schemas.ts (Zod), AuthLayout, PasswordStrengthMeter,
│   │                        # ProtectedRoute, legalContent
│   ├── products/            # ProductCard, ProductFilters, ProductGallery,
│   │                        # ProductTabs, useProductFilters
│   ├── auction/             # AuctionCard, BidForm, useAuctionSocket
│   ├── cart/                # MiniCart (drawer)
│   ├── blog/                # BlogCard
│   ├── account/             # 5 tab: Profile, Address, Orders, BidHistory, ChangePassword
│   └── home/                # Hero, CategoryGrid, Commitments
├── pages/                   # 1 file = 1 route, export default để lazy-load
├── services/api/            # Axios instance + service theo domain (hiện trả mock)
├── mocks/                   # 32 sản phẩm, 6 phiên đấu giá, 6 bài blog, đơn hàng, coupon
├── store/                   # Zustand: cart, wishlist, auth, ui (toast/menu)
├── hooks/                   # useAsync, useCountdown, useDebouncedValue, useMediaQuery,
│                            # useClickOutside, useLockBodyScroll, useLatestRef
├── types/                   # Product, Auction, Bid, User, CartItem, Order, BlogPost…
├── constants/               # routes.ts (URL tiếng Việt), catalog.ts (nhãn hệ/series…)
├── utils/                   # formatCurrency, slugify, cn, placeholder (SVG data-URI)
└── styles/globals.css       # Tailwind v4 @theme: màu, font, glow, animation
```

---

## 5. Các trang

| Route | Trang |
| --- | --- |
| `/` | Trang chủ: hero neon, danh mục theo hệ & series, hàng mới, đấu giá đang diễn ra (đếm ngược), bán chạy, blog, cam kết |
| `/san-pham` | Lưới/danh sách + sidebar lọc (hệ, series, tình trạng, giá, G-Power, còn hàng, giảm giá), sắp xếp, phân trang |
| `/san-pham/:slug` | Gallery zoom, thông tin sưu tầm, phụ kiện kèm theo, tab Mô tả/Thông số/Đánh giá, sản phẩm liên quan |
| `/hang-moi` | Sản phẩm nhập trong 30 ngày, nhãn **NEW** phát sáng |
| `/dau-gia` | Danh sách phiên: đang diễn ra / sắp diễn ra / đã kết thúc + thể lệ |
| `/dau-gia/:id` | Đếm ngược, lịch sử đặt giá (ẩn tên), ô đặt giá có validate, cảnh báo bị vượt giá, yêu cầu đăng nhập |
| `/gio-hang` | Tăng/giảm/xoá, mã giảm giá, tạm tính, phí ship, tổng cộng |
| `/yeu-thich` | Lưới đã thích, thêm tất cả vào giỏ |
| `/blog`, `/blog/:slug` | Tìm kiếm, lọc theo danh mục & thẻ, bài nổi bật, bài liên quan |
| `/gioi-thieu` | Câu chuyện shop, cột mốc, cam kết |
| `/lien-he` | Form có validate, Zalo/Messenger, bản đồ nhúng |
| `/tai-khoan` | **Route bảo vệ** — 5 tab: thông tin, sổ địa chỉ, đơn hàng, lịch sử đấu giá, đổi mật khẩu |
| `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` | Xác thực |
| `/dieu-khoan`, `/chinh-sach-bao-mat`, `/chinh-sach-van-chuyen`, `/chinh-sach-doi-tra` | Trang chính sách |
| `*` | 404 theo phong cách thương hiệu |

### Khu vực quản trị (`/admin`)

Chỉ tài khoản có vai trò **admin** vào được. Đăng nhập bằng tài khoản quản trị sẽ được đưa thẳng
vào đây; menu tài khoản ở cửa hàng cũng có mục "Trang quản trị".

| Route | Trang |
| --- | --- |
| `/admin` | Bảng điều khiển: doanh thu, số đơn, tỉ lệ huỷ (so với kỳ trước), việc cần xử lý, biểu đồ doanh thu 14 ngày, đơn theo trạng thái, hàng sắp hết |
| `/admin/don-hang` | Mọi đơn (web / đấu giá / admin tạo): lọc trạng thái, nguồn, thời gian, tìm kiếm, xuất CSV |
| `/admin/don-hang/:id` | Đổi trạng thái theo đúng quy trình, huỷ có lý do (tự trả hàng về kho), hoàn hàng, xác nhận tiền / hoàn tiền, báo sự cố, ghi chú nội bộ, lịch sử xử lý |
| `/admin/don-hang/tao-moi` | Tạo đơn cho khách có tài khoản hoặc khách lẻ, chọn địa chỉ, thêm sản phẩm (kiểm tồn kho), sửa đơn giá, phí ship, giảm giá |
| `/admin/dau-gia` | Phiên đang chạy, phiên thắng chờ tạo đơn (liên hệ người thắng), tạo đơn đấu giá, đánh dấu bỏ cọc. Admin thấy cả giá phiên kín |
| `/admin/kho-hang` | Số lượng Bakugan theo mẫu và theo hệ, cảnh báo sắp hết / hết hàng, +/- nhanh, thêm & sửa sản phẩm, ẩn khỏi cửa hàng, xuất CSV |
| `/admin/nhap-hang` | Lập phiếu nhập (cộng tồn kho), báo cáo nhập theo tháng / nhà cung cấp / hệ, giá vốn trung bình, xuất CSV |
| `/admin/huy-va-su-co` | Báo cáo đơn huỷ (theo lý do), đơn hoàn trả, sự cố giao hàng / thanh toán — nhận xử lý, đóng sự cố kèm cách giải quyết, xuất CSV |
| `/admin/khach-hang` | Danh sách khách: số đơn, tổng chi tiêu, đăng nhập gần nhất, liên kết ngân hàng, trạng thái |
| `/admin/khach-hang/:id` | Hồ sơ đầy đủ, sổ địa chỉ, đơn hàng, lịch sử đấu giá, sửa thông tin / thẻ / ghi chú, khoá tài khoản, cấp / thu hồi quyền admin, gửi link đặt lại mật khẩu |
| `/admin/tin-nhan` | Hộp thư chat: cuộc cần nhân viên trả lời, nhận lời thay bot, trả lại cho bot, câu trả lời mẫu |
| `/admin/cai-dat` | Bật/tắt trợ lý AI, chọn **những việc bot được tự giải quyết**, lời chào, ghi chú cho bot, thử bot; ngưỡng sắp hết hàng; khôi phục dữ liệu mẫu |

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
giá, hàng còn…). Huỷ/sửa đơn, hoàn tiền, khiếu nại, giữ hàng, trả giá, thu mua hàng cũ luôn được
chuyển nhân viên. Khoá Gemini nằm trong Vercel Function `api/chat-bot.ts`, có kiểm tra nguồn gọi,
giới hạn độ dài dữ liệu và giới hạn 8 lượt/phút mỗi IP để giữ hạn mức miễn phí.

**Dữ liệu demo:** ở chế độ mock, đơn, khách, phiếu nhập, tin nhắn… lưu trong `localStorage` của
trình duyệt (`src/mocks/db.ts`), nên thao tác của admin còn nguyên sau khi tải lại trang và hiện
luôn ở phía khách (VD admin tạo đơn cho `demo@tdbakugan.vn` → khách thấy trong "Đơn hàng của
tôi"). Mở hai tab (một khách, một admin) là thấy tin nhắn cập nhật qua lại. Muốn làm lại từ đầu:
`/admin/cai-dat` → **Khôi phục dữ liệu mẫu**. Vì lưu theo từng trình duyệt, chat giữa hai máy khác
nhau chỉ chạy được khi đã nối backend thật.

---

## 6. Nối backend sau này

Mọi lời gọi mạng đi qua `src/services/api/`. Mỗi hàm service có sẵn **cả hai nhánh**:

```ts
export async function fetchProducts(query: ProductQuery = {}): Promise<Paginated<Product>> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Paginated<Product>>>('/products', {
      params: query,
    });
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

- **Code-splitting theo route** — mỗi trang là một chunk riêng (trang nặng nhất ~19 kB).
- **Vendor chunk tách riêng** (react / form / motion) để cache tốt hơn giữa các lần deploy.
- **Lazy-load ảnh** (`loading="lazy"` + `width`/`height` chống layout shift).
- **Skeleton loading** cho mọi danh sách, không nhảy layout khi dữ liệu về.
- **Một timer duy nhất** cho tất cả đồng hồ đếm ngược (`useSyncExternalStore`).
- **TypeScript strict, không dùng `any`.** ESLint sạch, không có `eslint-disable` che lỗi.
- **Accessibility:** label cho mọi input, `alt` cho ảnh, `aria-*` đúng vai trò, điều hướng bàn
  phím (Escape đóng modal/drawer, mũi tên chọn gợi ý tìm kiếm), link "Bỏ qua điều hướng",
  `focus-visible` rõ trên nền tối, tôn trọng `prefers-reduced-motion`.
- **Ảnh sản phẩm là SVG placeholder sinh tại chỗ** (`src/utils/placeholder.ts`) — không dùng
  hình nhân vật có bản quyền, không phụ thuộc mạng. Khi có ảnh thật chỉ cần thay `product.images`.
