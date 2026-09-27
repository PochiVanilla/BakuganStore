/** URL tiếng Việt không dấu — tập trung một chỗ để đổi đường dẫn không sợ sót. */
export const ROUTES = {
  home: '/',
  /** Feed bán: mỗi feed là một lô Bakugan, mỗi con một mã riêng */
  feeds: '/feed',
  feedDetail: (number: number, code?: string) => `/feed/${number}${code ? `#${code}` : ''}`,
  /** Trang riêng của một con Bakugan: 3 ảnh phóng to được + video giới thiệu */
  itemDetail: (code: string) => `/bakugan/${code}`,
  auctions: '/dau-gia',
  auctionDetail: (id: string) => `/dau-gia/${id}`,
  blog: '/blog',
  blogDetail: (slug: string) => `/blog/${slug}`,
  contact: '/lien-he',
  cart: '/gio-hang',
  wishlist: '/yeu-thich',
  account: '/tai-khoan',
  membership: '/tai-khoan?tab=membership',
  login: '/dang-nhap',
  register: '/dang-ky',
  forgotPassword: '/quen-mat-khau',
  terms: '/dieu-khoan',
  privacy: '/chinh-sach-bao-mat',
  shipping: '/chinh-sach-van-chuyen',
  returns: '/chinh-sach-doi-tra',
} as const;

/** Đường dẫn cũ (trước khi bán theo feed) — tự chuyển sang trang mới để link cũ không chết. */
export const LEGACY_REDIRECTS: ReadonlyArray<{ from: string; to: string }> = [
  { from: '/san-pham', to: '/feed' },
  { from: '/san-pham/*', to: '/feed' },
  { from: '/hang-moi', to: '/feed' },
  { from: '/gioi-thieu', to: '/' },
];

/** Khu vực quản trị — chỉ tài khoản có quyền admin vào được. */
export const ADMIN_ROUTES = {
  dashboard: '/admin',
  orders: '/admin/don-hang',
  orderDetail: (id: string) => `/admin/don-hang/${id}`,
  createOrder: '/admin/don-hang/tao-moi',
  auctions: '/admin/dau-gia',
  feeds: '/admin/feed',
  newFeed: '/admin/feed/dang-moi',
  editFeed: (id: string) => `/admin/feed/${id}`,
  items: '/admin/bakugan',
  problems: '/admin/huy-va-su-co',
  customers: '/admin/khach-hang',
  customerDetail: (id: string) => `/admin/khach-hang/${id}`,
  chat: '/admin/tin-nhan',
  settings: '/admin/cai-dat',
} as const;

export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Trang chủ', to: ROUTES.home },
  { label: 'Feed bán', to: ROUTES.feeds },
  { label: 'Đấu giá', to: ROUTES.auctions },
  { label: 'Blog', to: ROUTES.blog },
  { label: 'Liên hệ', to: ROUTES.contact },
];

export const SHOP_INFO = {
  name: 'TD Bakugan',
  tagline: 'Chiến binh Bakugan chính hãng — Feed bán mỗi tuần & Đấu giá',
  hotline: '0912 345 678',
  email: 'hello@tdbakugan.vn',
  address: '633/12/19 Hồng Bàng, Phường 6, Quận 6, TP. Hồ Chí Minh',
  workingHours: '09:00 – 21:00, tất cả các ngày trong tuần',
  zaloUrl: 'https://zalo.me/0912345678',
  messengerUrl: 'https://m.me/tdbakugan',
  mapEmbedUrl:
    'https://www.google.com/maps?q=633/12/19%20H%E1%BB%93ng%20B%C3%A0ng%2C%20Ph%C6%B0%E1%BB%9Dng%206%2C%20Qu%E1%BA%ADn%206%2C%20Th%C3%A0nh%20ph%E1%BB%91%20H%E1%BB%93%20Ch%C3%AD%20Minh&output=embed',
} as const;

/** Phí vận chuyển mock — backend sẽ tính lại theo địa chỉ. */
export const SHIPPING_FEE = 30_000;
export const FREE_SHIPPING_THRESHOLD = 800_000;
