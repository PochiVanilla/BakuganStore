import type {
  Address,
  BotSettings,
  CancelReason,
  ChatConversation,
  ChatMessage,
  Gender,
  OrderEvent,
  OrderIssue,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  StockReceipt,
} from '@/types';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/routes';
import { MOCK_PRODUCTS } from './products';
import { MOCK_AUCTIONS } from './auctions';
import { ADMIN_ACCOUNT, MOCK_USER } from './users';
import type { MockDatabase, StoredOrder, StoredOrderItem, UserRecord } from './db';

/* ============================================================
   Bộ dữ liệu mẫu cho trang quản trị. Sinh bằng bộ số ngẫu nhiên
   có hạt giống cố định nên lần seed nào cũng ra cùng một kết quả,
   chỉ có mốc thời gian là tính theo lúc seed.
   ============================================================ */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const ADMIN_DISPLAY_NAME = 'Quản trị viên TD';

/** Bộ sinh số giả ngẫu nhiên mulberry32 — nhỏ, nhanh, lặp lại được. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]!;
}

function pickWeighted<T>(entries: ReadonlyArray<readonly [T, number]>, rand: () => number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

const iso = (ms: number): string => new Date(ms).toISOString();

/* ---------------- Khách hàng ---------------- */

interface CustomerSeed {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  gender: Gender;
  birthday: string;
  joinedDaysAgo: number;
  lastLoginDaysAgo: number;
  address: readonly [province: string, district: string, ward: string, street: string];
  bank?: readonly [bankName: string, accountNumber: string];
  tags: string[];
  note: string;
  lockedReason?: string;
}

/** Id trùng với người đặt giá trong mocks/auctions.ts để nối được lịch sử đấu giá. */
const CUSTOMER_SEEDS: CustomerSeed[] = [
  {
    id: 'usr-011',
    fullName: 'Trần Gia Bảo',
    email: 'giabao.tran@gmail.com',
    phone: '0903128456',
    gender: 'male',
    birthday: '2001-07-22',
    joinedDaysAgo: 380,
    lastLoginDaysAgo: 1,
    address: ['Hà Nội', 'Quận Cầu Giấy', 'Phường Dịch Vọng', '56 Trần Thái Tông'],
    bank: ['Techcombank', '19036528471012'],
    tags: ['Sưu tầm'],
    note: 'Hay săn hàng dòng Mechtanium Surge.',
  },
  {
    id: 'usr-012',
    fullName: 'Lê Hoàng Phúc',
    email: 'hoangphuc.le@outlook.com',
    phone: '0938452671',
    gender: 'male',
    birthday: '1995-11-02',
    joinedDaysAgo: 290,
    lastLoginDaysAgo: 3,
    address: ['TP. Hồ Chí Minh', 'Quận 6', 'Phường 6', '211 Hồng Bàng'],
    bank: ['ACB', '24681357'],
    tags: ['Khách quen'],
    note: '',
  },
  {
    id: 'usr-013',
    fullName: 'Phạm Thu Hà',
    email: 'thuha.pham@gmail.com',
    phone: '0976234518',
    gender: 'female',
    birthday: '1999-04-09',
    joinedDaysAgo: 210,
    lastLoginDaysAgo: 0,
    address: ['Hà Nội', 'Quận Ba Đình', 'Phường Kim Mã', '12 Kim Mã Thượng'],
    tags: [],
    note: 'Mua làm quà cho em trai.',
  },
  {
    id: 'usr-014',
    fullName: 'Đỗ Quang Huy',
    email: 'quanghuy.do@yahoo.com',
    phone: '0914567230',
    gender: 'male',
    birthday: '1993-01-30',
    joinedDaysAgo: 510,
    lastLoginDaysAgo: 6,
    address: ['Đà Nẵng', 'Quận Hải Châu', 'Phường Thạch Thang', '88 Lê Duẩn'],
    bank: ['MB Bank', '0680123456789'],
    tags: ['VIP', 'Sưu tầm'],
    note: 'Khách VIP, ưu tiên báo trước khi có hàng hiếm.',
  },
  {
    id: 'usr-015',
    fullName: 'Vũ Nhật Nam',
    email: 'nhatnam.vu@gmail.com',
    phone: '0869345120',
    gender: 'male',
    birthday: '2003-09-15',
    joinedDaysAgo: 150,
    lastLoginDaysAgo: 2,
    address: ['Hải Phòng', 'Quận Lê Chân', 'Phường An Biên', '34 Tô Hiệu'],
    tags: [],
    note: '',
  },
  {
    id: 'usr-016',
    fullName: 'Bùi Khánh Linh',
    email: 'khanhlinh.bui@gmail.com',
    phone: '0948123907',
    gender: 'female',
    birthday: '2000-12-01',
    joinedDaysAgo: 95,
    lastLoginDaysAgo: 0,
    address: ['TP. Hồ Chí Minh', 'Quận Bình Thạnh', 'Phường 25', '19 Điện Biên Phủ'],
    bank: ['VPBank', '128456739'],
    tags: ['Khách mới'],
    note: '',
  },
  {
    id: 'usr-017',
    fullName: 'Hoàng Anh Tuấn',
    email: 'anhtuan.hoang@gmail.com',
    phone: '0987612345',
    gender: 'male',
    birthday: '1990-06-18',
    joinedDaysAgo: 640,
    lastLoginDaysAgo: 12,
    address: ['Cần Thơ', 'Quận Ninh Kiều', 'Phường An Hội', '5 Hai Bà Trưng'],
    tags: ['Sưu tầm'],
    note: 'Thích đấu giá phiên kín.',
  },
  {
    id: 'usr-018',
    fullName: 'Đặng Tiến Dũng',
    email: 'tiendung.dang@gmail.com',
    phone: '0357812649',
    gender: 'male',
    birthday: '1997-02-25',
    joinedDaysAgo: 330,
    lastLoginDaysAgo: 4,
    address: ['Bình Dương', 'TP. Thủ Dầu Một', 'Phường Phú Cường', '102 Yersin'],
    bank: ['BIDV', '31410001234567'],
    tags: [],
    note: '',
  },
  {
    id: 'usr-019',
    fullName: 'Ngô Thanh Tùng',
    email: 'thanhtung.ngo@gmail.com',
    phone: '0779123486',
    gender: 'male',
    birthday: '2002-10-10',
    joinedDaysAgo: 60,
    lastLoginDaysAgo: 1,
    address: ['TP. Hồ Chí Minh', 'TP. Thủ Đức', 'Phường Linh Trung', 'Ký túc xá khu A'],
    tags: ['Khách mới'],
    note: '',
  },
  {
    id: 'usr-020',
    fullName: 'Lý Mỹ Duyên',
    email: 'myduyen.ly@gmail.com',
    phone: '0932765418',
    gender: 'female',
    birthday: '1996-08-08',
    joinedDaysAgo: 25,
    lastLoginDaysAgo: 5,
    address: ['TP. Hồ Chí Minh', 'Quận 5', 'Phường 7', '77 Trần Hưng Đạo'],
    tags: ['Khách mới'],
    note: '',
  },
  {
    id: 'usr-021',
    fullName: 'Châu Quốc Việt',
    email: 'quocviet.chau@gmail.com',
    phone: '0908456123',
    gender: 'male',
    birthday: '1988-05-05',
    joinedDaysAgo: 720,
    lastLoginDaysAgo: 30,
    address: ['TP. Hồ Chí Minh', 'Quận 10', 'Phường 12', '300 Ba Tháng Hai'],
    bank: ['Sacombank', '060123456789'],
    tags: ['VIP'],
    note: 'Hay mua theo combo, thường hỏi chiết khấu số lượng.',
  },
  {
    id: 'usr-022',
    fullName: 'Trịnh Bảo Ngọc',
    email: 'baongoc.trinh@gmail.com',
    phone: '0703456892',
    gender: 'female',
    birthday: '2001-01-20',
    joinedDaysAgo: 120,
    lastLoginDaysAgo: 40,
    address: ['Đồng Nai', 'TP. Biên Hòa', 'Phường Tân Mai', '45 Phạm Văn Thuận'],
    tags: ['Cảnh báo'],
    note: 'Ba đơn COD liên tiếp không nhận hàng.',
    lockedReason: 'Bom hàng 3 lần liên tiếp (đơn COD không nhận).',
  },
  {
    id: 'usr-023',
    fullName: 'Mai Xuân Trường',
    email: 'xuantruong.mai@gmail.com',
    phone: '0826543197',
    gender: 'male',
    birthday: '1994-12-12',
    joinedDaysAgo: 12,
    lastLoginDaysAgo: 0,
    address: ['Khánh Hòa', 'TP. Nha Trang', 'Phường Lộc Thọ', '20 Trần Phú'],
    tags: ['Khách mới'],
    note: '',
  },
];

/** Bỏ dấu và viết hoa, đúng kiểu tên chủ tài khoản ngân hàng. */
function toAccountHolder(fullName: string): string {
  return fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

function buildUsers(now: number): UserRecord[] {
  const demo: UserRecord = {
    ...MOCK_USER,
    status: 'active',
    lastLoginAt: iso(now - 2 * HOUR),
    tags: ['VIP', 'Sưu tầm'],
    adminNote: 'Tài khoản demo cho khách xem thử.',
  };

  const admin: UserRecord = {
    id: 'usr-admin',
    fullName: ADMIN_DISPLAY_NAME,
    email: ADMIN_ACCOUNT.email,
    phone: '0912345678',
    createdAt: iso(now - 540 * DAY),
    addresses: [],
    role: 'admin',
    status: 'active',
    lastLoginAt: iso(now - 20 * MINUTE),
    tags: ['Nhân sự'],
    adminNote: '',
  };

  const customers = CUSTOMER_SEEDS.map((seed): UserRecord => {
    const [province, district, ward, street] = seed.address;
    const address: Address = {
      id: `adr-${seed.id}`,
      label: 'Nhà riêng',
      receiverName: seed.fullName,
      phone: seed.phone,
      province,
      district,
      ward,
      street,
      isDefault: true,
    };
    return {
      id: seed.id,
      fullName: seed.fullName,
      email: seed.email,
      phone: seed.phone,
      createdAt: iso(now - seed.joinedDaysAgo * DAY),
      addresses: [address],
      role: 'customer',
      gender: seed.gender,
      birthday: seed.birthday,
      bankAccount: seed.bank
        ? {
            bankName: seed.bank[0],
            accountNumber: seed.bank[1],
            accountHolder: toAccountHolder(seed.fullName),
          }
        : undefined,
      status: seed.lockedReason ? 'locked' : 'active',
      lockedReason: seed.lockedReason,
      lastLoginAt: iso(now - seed.lastLoginDaysAgo * DAY - 3 * HOUR),
      tags: seed.tags,
      adminNote: seed.note,
    };
  });

  return [admin, demo, ...customers];
}

/* ---------------- Đơn hàng ---------------- */

const FLOW: readonly OrderStatus[] = ['pending', 'confirmed', 'packing', 'shipping', 'completed'];

const EVENT_NOTES: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Đã gọi xác nhận với khách.',
  packing: 'Bọc chống sốc hai lớp, quay video đóng gói.',
  completed: 'Khách đã nhận hàng.',
  returned: 'Khách hoàn hàng, đã kiểm tra và nhập lại kho.',
};

const CANCEL_NOTES: Record<CancelReason, string> = {
  'customer-request': 'Khách nhắn đổi ý, muốn chờ phiên đấu giá.',
  'out-of-stock': 'Mẫu cuối cùng bị lỗi nam châm khi kiểm tra.',
  'payment-timeout': 'Quá 24 giờ chưa nhận được chuyển khoản.',
  unreachable: 'Gọi 3 lần không nghe máy, đơn vị vận chuyển hoàn về.',
  duplicate: 'Khách đặt trùng hai lần.',
  'fraud-suspected': 'Thông tin nhận hàng không khớp, nghi đơn ảo.',
  other: '',
};

function orderCode(createdAt: number, index: number): string {
  const date = new Date(createdAt);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const letter = String.fromCharCode(65 + (index % 26));
  return `TD${day}${month}${letter}${String(10 + (index % 90)).padStart(2, '0')}`;
}

function statusPath(status: OrderStatus, rand: () => number): OrderStatus[] {
  if (status === 'cancelled') {
    return [...FLOW.slice(0, 1 + Math.floor(rand() * 3)), 'cancelled'];
  }
  if (status === 'returned') return [...FLOW.slice(0, 4), 'returned'];
  return FLOW.slice(0, FLOW.indexOf(status) + 1);
}

function actorFor(status: OrderStatus, source: OrderSource): string {
  if (status === 'pending') {
    if (source === 'web') return 'Khách hàng';
    if (source === 'auction') return 'Hệ thống đấu giá';
    return ADMIN_DISPLAY_NAME;
  }
  if (status === 'completed') return 'Đơn vị vận chuyển';
  return ADMIN_DISPLAY_NAME;
}

function buildTimeline(
  orderId: string,
  path: OrderStatus[],
  createdAt: number,
  now: number,
  source: OrderSource,
  rand: () => number,
  cancelReason?: CancelReason,
): OrderEvent[] {
  const age = now - createdAt;
  // Mỗi bước cách nhau vài giờ tới một ngày, nhưng không vượt quá hiện tại.
  const step = Math.min((6 + rand() * 20) * HOUR, age / (path.length + 0.5));
  return path.map((status, index) => {
    let note = EVENT_NOTES[status];
    if (status === 'shipping') {
      note = `Đã bàn giao vận chuyển · Mã vận đơn TDV${Math.floor(100_000 + rand() * 899_999)}`;
    }
    if (status === 'cancelled' && cancelReason) note = CANCEL_NOTES[cancelReason] || undefined;
    return {
      id: `${orderId}-ev${index}`,
      status,
      at: iso(createdAt + index * step),
      actor: actorFor(status, source),
      note,
    };
  });
}

function statusForAge(ageDays: number, rand: () => number): OrderStatus {
  if (ageDays < 0.5) {
    return pickWeighted<OrderStatus>(
      [
        ['pending', 7],
        ['confirmed', 2],
        ['cancelled', 0.6],
      ],
      rand,
    );
  }
  if (ageDays < 2) {
    return pickWeighted<OrderStatus>(
      [
        ['confirmed', 3],
        ['packing', 3.5],
        ['shipping', 2.5],
        ['cancelled', 0.6],
      ],
      rand,
    );
  }
  if (ageDays < 5) {
    return pickWeighted<OrderStatus>(
      [
        ['shipping', 5],
        ['completed', 4],
        ['cancelled', 0.6],
      ],
      rand,
    );
  }
  return pickWeighted<OrderStatus>(
    [
      ['completed', 88],
      ['cancelled', 8],
      ['returned', 4],
    ],
    rand,
  );
}

function paymentStatusFor(
  status: OrderStatus,
  method: PaymentMethod,
  rand: () => number,
): PaymentStatus {
  if (status === 'returned') return 'refunded';
  if (status === 'cancelled') return method !== 'cod' && rand() < 0.5 ? 'refunded' : 'unpaid';
  if (status === 'completed') return 'paid';
  if (method === 'cod') return 'unpaid';
  if (status === 'pending') return rand() < 0.5 ? 'unpaid' : 'paid';
  return 'paid';
}

function addressLine(address: Address): string {
  return `${address.street}, ${address.ward}, ${address.district}, ${address.province}`;
}

function itemsFrom(products: Product[], quantities: number[]): StoredOrderItem[] {
  return products.map((product, index) => ({
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: quantities[index] ?? 1,
  }));
}

interface OrderDraft {
  id: string;
  code: string;
  customer: UserRecord;
  address: Address;
  items: StoredOrderItem[];
  createdAt: number;
  status: OrderStatus;
  method: PaymentMethod;
  source: OrderSource;
  discount?: number;
  cancelReason?: CancelReason;
  auctionId?: string;
  note?: string;
}

function finalizeOrder(draft: OrderDraft, now: number, rand: () => number): StoredOrder {
  const subtotal = draft.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const discount = draft.discount ?? 0;
  const timeline = buildTimeline(
    draft.id,
    statusPath(draft.status, rand),
    draft.createdAt,
    now,
    draft.source,
    rand,
    draft.cancelReason,
  );
  return {
    id: draft.id,
    code: draft.code,
    items: draft.items,
    subtotal,
    shippingFee,
    discount,
    total: Math.max(0, subtotal + shippingFee - discount),
    status: draft.status,
    createdAt: iso(draft.createdAt),
    updatedAt: timeline[timeline.length - 1]!.at,
    receiverName: draft.address.receiverName,
    phone: draft.address.phone,
    addressLine: addressLine(draft.address),
    paymentMethod: draft.method,
    paymentStatus: paymentStatusFor(draft.status, draft.method, rand),
    source: draft.source,
    userId: draft.customer.id,
    customerEmail: draft.customer.email,
    auctionId: draft.auctionId,
    note: draft.note,
    cancelReason: draft.status === 'cancelled' ? draft.cancelReason : undefined,
    cancelNote:
      draft.status === 'cancelled' && draft.cancelReason
        ? CANCEL_NOTES[draft.cancelReason] || undefined
        : undefined,
    timeline,
  };
}

function buildOrders(users: UserRecord[], now: number, rand: () => number): StoredOrder[] {
  const byId = new Map(users.map((user) => [user.id, user]));
  const demo = byId.get('usr-001')!;
  const [home, office] = [demo.addresses[0]!, demo.addresses[1] ?? demo.addresses[0]!];
  const P = MOCK_PRODUCTS;

  // Bốn đơn quen thuộc của tài khoản demo (giữ nguyên mã để khớp bản cũ).
  const drafts: OrderDraft[] = [
    {
      id: 'ord-001',
      code: 'TD2609A17',
      customer: demo,
      address: home,
      items: itemsFrom([P[0]!, P[1]!], [1, 1]),
      createdAt: now - 2 * DAY,
      status: 'shipping',
      method: 'cod',
      source: 'web',
      discount: 100_000,
    },
    {
      id: 'ord-002',
      code: 'TD2508B04',
      customer: demo,
      address: home,
      items: itemsFrom([P[5]!, P[6]!], [1, 1]),
      createdAt: now - 28 * DAY,
      status: 'completed',
      method: 'bank-transfer',
      source: 'web',
    },
    {
      id: 'ord-003',
      code: 'TD2507C22',
      customer: demo,
      address: office,
      items: itemsFrom([P[20]!, P[21]!], [2, 2]),
      createdAt: now - 63 * DAY,
      status: 'completed',
      method: 'momo',
      source: 'web',
    },
    {
      id: 'ord-004',
      code: 'TD2506D09',
      customer: demo,
      address: home,
      items: itemsFrom([P[12]!], [1]),
      createdAt: now - 94 * DAY,
      status: 'cancelled',
      method: 'cod',
      source: 'web',
      cancelReason: 'customer-request',
    },
  ];

  const buyers = users.filter(
    (user) => user.role === 'customer' && user.status === 'active' && user.id !== 'usr-001',
  );
  const TOTAL = 72;

  for (let index = 0; index < TOTAL; index += 1) {
    // Mười đơn đầu nằm trong 3 ngày gần đây để luôn có việc cần xử lý.
    const ageDays = index < 10 ? rand() * 3 : Math.pow(rand(), 1.5) * 88;
    const createdAt = now - ageDays * DAY - rand() * HOUR;
    const status = statusForAge(ageDays, rand);
    // Chỉ khách đã đăng ký trước ngày đặt mới có thể có đơn này.
    const eligible = buyers.filter((user) => new Date(user.createdAt).getTime() < createdAt);
    const customer = pick(eligible.length > 0 ? eligible : buyers, rand);
    const itemCount = pickWeighted(
      [
        [1, 6],
        [2, 3],
        [3, 1],
      ] as const,
      rand,
    );
    const chosen = new Set<Product>();
    while (chosen.size < itemCount) chosen.add(pick(P, rand));
    const products = [...chosen];

    drafts.push({
      id: `ord-${String(index + 5).padStart(3, '0')}`,
      code: orderCode(createdAt, index + 4),
      customer,
      address: customer.addresses[0]!,
      items: itemsFrom(
        products,
        products.map(() => (rand() < 0.85 ? 1 : 2)),
      ),
      createdAt,
      status,
      method: pickWeighted<PaymentMethod>(
        [
          ['cod', 45],
          ['bank-transfer', 35],
          ['momo', 20],
        ],
        rand,
      ),
      source: rand() < 0.15 ? 'manual' : 'web',
      discount: rand() < 0.12 ? 50_000 * (1 + Math.floor(rand() * 3)) : 0,
      cancelReason:
        status === 'cancelled'
          ? pick(
              [
                'customer-request',
                'customer-request',
                'payment-timeout',
                'unreachable',
                'out-of-stock',
                'duplicate',
              ] as const,
              rand,
            )
          : undefined,
    });
  }

  // Khách bị khoá: ba đơn COD liên tiếp không nhận.
  const locked = byId.get('usr-022')!;
  [52, 37, 21].forEach((ago, index) => {
    const createdAt = now - ago * DAY;
    drafts.push({
      id: `ord-bn${index + 1}`,
      code: orderCode(createdAt, 60 + index),
      customer: locked,
      address: locked.addresses[0]!,
      items: itemsFrom([P[(index * 7 + 3) % P.length]!], [1]),
      createdAt,
      status: 'cancelled',
      method: 'cod',
      source: 'web',
      cancelReason: 'unreachable',
    });
  });

  // Đơn của phiên đấu giá Preyas đã kết thúc — người thắng đã được tạo đơn.
  const preyas = MOCK_AUCTIONS.find((auction) => auction.id === 'auc-007');
  const preyasWinner = preyas?.bids[0] ? byId.get(preyas.bids[0].bidderId) : undefined;
  if (preyas && preyasWinner) {
    const createdAt = new Date(preyas.endAt).getTime() + 5 * HOUR;
    drafts.push({
      id: 'ord-auc-007',
      code: orderCode(createdAt, 70),
      customer: preyasWinner,
      address: preyasWinner.addresses[0]!,
      items: [
        {
          productId: `auction:${preyas.id}`,
          name: preyas.title,
          price: preyas.currentPrice,
          quantity: 1,
        },
      ],
      createdAt,
      status: 'packing',
      method: 'bank-transfer',
      source: 'auction',
      auctionId: preyas.id,
      note: 'Hàng đấu giá — khách đã chuyển khoản đủ.',
    });
  }

  return drafts
    .map((draft) => finalizeOrder(draft, now, rand))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------------- Phiếu nhập ---------------- */

const SUPPLIERS = [
  'Đại lý Toys Sài Gòn',
  'Lô nhập Nhật Bản (JP)',
  'Nhà sưu tầm Hà Nội',
  'Nguồn ký gửi của khách',
  'Kho sỉ Chợ Lớn',
] as const;

function buildReceipts(now: number, rand: () => number): StockReceipt[] {
  const ages = [86, 74, 61, 52, 40, 31, 19, 9, 3];
  return ages
    .map((ago, index) => {
      const receivedAt = now - ago * DAY - rand() * 6 * HOUR;
      const count = 3 + Math.floor(rand() * 3);
      const chosen = new Set<Product>();
      while (chosen.size < count) chosen.add(pick(MOCK_PRODUCTS, rand));
      const items = [...chosen].map((product) => ({
        productId: product.id,
        productName: product.name,
        attribute: product.attribute,
        quantity: 2 + Math.floor(rand() * 7),
        unitCost: Math.round((product.price * (0.48 + rand() * 0.18)) / 10_000) * 10_000,
      }));
      const date = new Date(receivedAt);
      const stamp = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      return {
        id: `rcp-${String(index + 1).padStart(3, '0')}`,
        code: `PN${stamp}-${String(index + 1).padStart(2, '0')}`,
        supplier: SUPPLIERS[index % SUPPLIERS.length]!,
        receivedAt: iso(receivedAt),
        createdBy: ADMIN_DISPLAY_NAME,
        note: index % 3 === 0 ? 'Đã kiểm tra nam châm và cơ cấu bung từng con.' : undefined,
        items,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        totalCost: items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
      } satisfies StockReceipt;
    })
    .reverse();
}

/* ---------------- Sự cố ---------------- */

function buildIssues(orders: StoredOrder[], users: UserRecord[], now: number): OrderIssue[] {
  const used = new Set<string>();
  const nameOf = (order: StoredOrder): string =>
    users.find((user) => user.id === order.userId)?.fullName ?? order.receiverName;

  const plans: Array<{
    match: (order: StoredOrder) => boolean;
    issue: Omit<OrderIssue, 'id' | 'orderId' | 'orderCode' | 'customerName'>;
  }> = [
    {
      match: (order) => order.status === 'shipping',
      issue: {
        type: 'late-delivery',
        status: 'open',
        description: 'Khách báo đã 4 ngày chưa nhận được hàng, mã vận đơn không cập nhật.',
        reportedBy: 'customer',
        createdAt: iso(now - 5 * HOUR),
        updatedAt: iso(now - 5 * HOUR),
      },
    },
    {
      match: (order) => order.status === 'completed',
      issue: {
        type: 'damaged',
        status: 'investigating',
        description: 'Hộp móp một góc, khách gửi ảnh qua Zalo. Sản phẩm bên trong còn nguyên.',
        reportedBy: 'customer',
        createdAt: iso(now - 2 * DAY),
        updatedAt: iso(now - DAY),
      },
    },
    {
      match: (order) => order.status === 'completed',
      issue: {
        type: 'wrong-item',
        status: 'resolved',
        description: 'Giao nhầm bản Aquos thay vì Pyrus.',
        reportedBy: 'customer',
        createdAt: iso(now - 12 * DAY),
        updatedAt: iso(now - 9 * DAY),
        resolution: 'Đã gửi bù đúng mẫu, thu hồi món giao nhầm. Shop chịu phí hai chiều.',
      },
    },
    {
      match: (order) => order.status === 'cancelled' && order.cancelReason === 'unreachable',
      issue: {
        type: 'unreachable',
        status: 'resolved',
        description: 'Shipper gọi 3 lần không liên lạc được, đơn hoàn về kho.',
        reportedBy: 'carrier',
        createdAt: iso(now - 20 * DAY),
        updatedAt: iso(now - 19 * DAY),
        resolution: 'Đã nhập lại kho, ghi chú cảnh báo vào hồ sơ khách.',
      },
    },
    {
      match: (order) =>
        order.status === 'pending' &&
        order.paymentMethod !== 'cod' &&
        order.paymentStatus === 'unpaid',
      issue: {
        type: 'payment',
        status: 'open',
        description: 'Khách báo đã chuyển khoản nhưng chưa thấy tiền về tài khoản shop.',
        reportedBy: 'customer',
        createdAt: iso(now - 90 * MINUTE),
        updatedAt: iso(now - 90 * MINUTE),
      },
    },
    {
      match: (order) => order.status === 'returned',
      issue: {
        type: 'other',
        status: 'resolved',
        description: 'Khách đổi ý sau khi nhận, hàng còn nguyên seal.',
        reportedBy: 'customer',
        createdAt: iso(now - 30 * DAY),
        updatedAt: iso(now - 27 * DAY),
        resolution: 'Nhận lại hàng, hoàn tiền trừ phí vận chuyển theo chính sách.',
      },
    },
  ];

  const issues: OrderIssue[] = [];
  plans.forEach((plan, index) => {
    const order = orders.find((item) => !used.has(item.id) && plan.match(item));
    if (!order) return;
    used.add(order.id);
    issues.push({
      ...plan.issue,
      id: `iss-${String(index + 1).padStart(3, '0')}`,
      orderId: order.id,
      orderCode: order.code,
      customerName: nameOf(order),
    });
  });
  return issues;
}

/* ---------------- Chat ---------------- */

export const DEFAULT_BOT_SETTINGS: Omit<BotSettings, 'updatedAt'> = {
  enabled: true,
  greeting:
    'Chào bạn! Mình là trợ lý AI của TD Bakugan. Mình tra được đơn hàng, phí ship, luật đấu giá, thông tin sản phẩm… Việc nào cần nhân viên, mình chuyển ngay nhé.',
  topics: {
    'order-status': true,
    shipping: true,
    payment: true,
    returns: true,
    'auction-rules': true,
    'product-info': true,
    'store-info': true,
    promotions: false,
  },
  extraKnowledge:
    'Tuần này shop đang có phiên đấu giá Titanium Dragonoid mạ vàng. Hàng hiếm không nhận giữ quá 24 giờ.',
  handoffMessage:
    'Mình đã chuyển cuộc trò chuyện cho nhân viên TD Bakugan. Bạn chờ chút nhé — giờ làm việc 09:00–21:00 hằng ngày.',
};

function conversation(
  base: Omit<ChatConversation, 'messages' | 'createdAt' | 'updatedAt'>,
  now: number,
  script: Array<[sender: ChatMessage['sender'], minutesAgo: number, text: string]>,
): ChatConversation {
  const messages = script.map(([sender, minutesAgo, text], index): ChatMessage => ({
    id: `${base.id}-m${index + 1}`,
    sender,
    text,
    createdAt: iso(now - minutesAgo * MINUTE),
    authorName: sender === 'admin' ? ADMIN_DISPLAY_NAME : undefined,
  }));
  return {
    ...base,
    messages,
    createdAt: messages[0]!.createdAt,
    updatedAt: messages[messages.length - 1]!.createdAt,
  };
}

function buildConversations(now: number): ChatConversation[] {
  const handoff = DEFAULT_BOT_SETTINGS.handoffMessage;
  return [
    conversation(
      {
        id: 'cvs-002',
        customerId: 'usr-016',
        customerName: 'Bùi Khánh Linh',
        customerContact: 'khanhlinh.bui@gmail.com',
        status: 'waiting',
        botEnabled: true,
        unreadByAdmin: 2,
        unreadByCustomer: 0,
      },
      now,
      [
        [
          'customer',
          26,
          'Shop giữ giúp em con Dragonoid Chiến Binh Lửa tới thứ 7 được không ạ? Em nhận lương rồi chuyển khoản.',
        ],
        [
          'bot',
          26,
          'Việc giữ hàng cần nhân viên TD Bakugan xác nhận, nên mình chuyển cho nhân viên ngay nhé.',
        ],
        ['system', 26, handoff],
        ['customer', 24, 'Dạ em chờ ạ.'],
      ],
    ),
    conversation(
      {
        id: 'cvs-003',
        customerName: 'Anh Tùng (khách vãng lai)',
        customerContact: '0903456789',
        status: 'admin',
        botEnabled: false,
        unreadByAdmin: 1,
        unreadByCustomer: 0,
      },
      now,
      [
        [
          'customer',
          190,
          'Shop có thu mua lại Bakugan cũ không? Mình có khoảng 20 con đời Battle Brawlers.',
        ],
        [
          'bot',
          190,
          'Thu mua hàng cũ cần nhân viên định giá trực tiếp, mình chuyển cho nhân viên nhé.',
        ],
        ['system', 190, handoff],
        [
          'admin',
          150,
          'Chào anh Tùng, shop có thu mua ạ. Anh chụp giúp shop ảnh từng con (lúc đóng và lúc bung) gửi qua Zalo 0912 345 678 để shop định giá nhé.',
        ],
        ['customer', 140, 'Ok, tối nay mình chụp rồi gửi.'],
      ],
    ),
    conversation(
      {
        id: 'cvs-004',
        customerId: 'usr-001',
        customerName: 'Nguyễn Minh Khôi',
        customerContact: 'demo@tdbakugan.vn',
        status: 'bot',
        botEnabled: true,
        unreadByAdmin: 0,
        unreadByCustomer: 0,
      },
      now,
      [
        ['customer', 1_450, 'Đơn TD2609A17 của mình tới đâu rồi shop?'],
        [
          'bot',
          1_450,
          'Đơn #TD2609A17 của bạn đang được giao. Nội thành TP.HCM thường nhận trong 1–2 ngày làm việc, bạn để ý điện thoại giúp shop nhé!',
        ],
      ],
    ),
    conversation(
      {
        id: 'cvs-001',
        customerId: 'usr-013',
        customerName: 'Phạm Thu Hà',
        customerContact: 'thuha.pham@gmail.com',
        status: 'resolved',
        botEnabled: true,
        unreadByAdmin: 0,
        unreadByCustomer: 0,
      },
      now,
      [
        ['customer', 2_900, 'Shop ơi ship ra Hà Nội mất bao lâu và phí bao nhiêu ạ?'],
        [
          'bot',
          2_900,
          'Chào bạn! Các tỉnh ngoài TP.HCM nhận hàng trong 2–5 ngày làm việc. Phí ship cố định 30.000₫ và miễn phí cho đơn từ 800.000₫ nhé.',
        ],
        ['customer', 2_895, 'Ok cảm ơn shop.'],
        ['bot', 2_895, 'Dạ không có gì ạ! Cần gì thêm bạn cứ nhắn mình nha.'],
      ],
    ),
    conversation(
      {
        id: 'cvs-005',
        customerId: 'usr-014',
        customerName: 'Đỗ Quang Huy',
        customerContact: 'quanghuy.do@yahoo.com',
        status: 'resolved',
        botEnabled: true,
        unreadByAdmin: 0,
        unreadByCustomer: 0,
      },
      now,
      [
        ['customer', 4_400, 'Sao phiên Linehalt cứ tự cộng thêm giờ vậy shop?'],
        [
          'bot',
          4_400,
          'Đó là luật chống bắn tỉa: lượt đặt nào rơi vào 5 phút cuối sẽ đẩy giờ kết thúc thêm 5 phút, nên không ai thắng được bằng cách bấm ở giây chót. Phiên chỉ kết thúc khi đủ 5 phút không còn ai đặt giá.',
        ],
      ],
    ),
  ];
}

/* ---------------- Tổng hợp ---------------- */

export function createSeedDatabase(version: number): MockDatabase {
  const now = Date.now();
  const rand = createRandom(20_260_926);
  const users = buildUsers(now);
  const orders = buildOrders(users, now, rand);

  // Khách đặt đơn trên web thì chắc chắn đã đăng nhập ít nhất lúc đó.
  users.forEach((user) => {
    const latestWebOrder = orders
      .filter((order) => order.userId === user.id && order.source === 'web')
      .reduce<string | undefined>(
        (latest, order) => (!latest || order.createdAt > latest ? order.createdAt : latest),
        undefined,
      );
    if (latestWebOrder && (!user.lastLoginAt || latestWebOrder > user.lastLoginAt)) {
      user.lastLoginAt = latestWebOrder;
    }
  });

  return {
    version,
    seededAt: iso(now),
    users,
    orders,
    productPatches: {},
    customProducts: [],
    receipts: buildReceipts(now, rand),
    issues: buildIssues(orders, users, now),
    auctionFulfillments: orders
      .filter((order) => order.source === 'auction' && order.auctionId)
      .map((order) => ({
        auctionId: order.auctionId!,
        status: 'order-created' as const,
        orderId: order.id,
        updatedAt: order.createdAt,
      })),
    conversations: buildConversations(now),
    botSettings: { ...DEFAULT_BOT_SETTINGS, updatedAt: iso(now) },
    shopSettings: { lowStockThreshold: 3 },
  };
}
