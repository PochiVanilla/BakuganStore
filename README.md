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

**Tài khoản demo:** `demo@tdbakugan.vn` — mật khẩu bất kỳ từ 8 ký tự (VD `Bakugan123`).
Ở chế độ mock, mọi email đúng định dạng + mật khẩu ≥ 8 ký tự đều đăng nhập được.

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

Xem mẫu trong `.env.example`.

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
