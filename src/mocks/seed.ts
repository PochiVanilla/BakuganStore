import type {
  Address,
  BotSettings,
  CancelReason,
  ChatConversation,
  ChatMessage,
  Gender,
  MembershipRequest,
  OrderEvent,
  OrderIssue,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductCondition,
} from '@/types';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/constants/routes';
import { PURCHASES_FOR_LV2 } from '@/constants/catalog';
import { formatItemCode } from '@/utils/itemCode';
import { BAKUGAN_MODELS, type BakuganModel } from './models';
import { AUCTION_BIDDERS, MOCK_AUCTIONS } from './auctions';
import { ADMIN_ACCOUNT, DEMO_NEW_ACCOUNT, MOCK_USER } from './users';
import type {
  MockDatabase,
  StoredFeed,
  StoredItem,
  StoredOrder,
  StoredOrderItem,
  UserRecord,
} from './db';

/* ============================================================
   Bộ dữ liệu mẫu. Sinh bằng bộ số ngẫu nhiên có hạt giống cố định
   nên lần seed nào cũng ra cùng một kết quả, chỉ có mốc thời gian
   là tính theo lúc seed.

   Cách bán mô phỏng: shop nhập Bakugan theo lô, mỗi lô đăng thành
   một feed (ảnh cả lô + từng con có mã riêng). Đơn hàng lấy đúng
   những con đang còn trong feed lúc khách đặt; con nào bán rồi thì
   SOLD. Web giữ tối đa 30 feed nên các feed cũ nhất đã được xoá,
   con chưa bán trong đó thành "hàng tồn" chờ đăng lại.
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
    id: 'usr-002',
    fullName: 'Trần Bảo Anh',
    email: DEMO_NEW_ACCOUNT.email,
    phone: '0901234987',
    gender: 'male',
    birthday: '2004-05-19',
    joinedDaysAgo: 18,
    lastLoginDaysAgo: 1,
    address: ['TP. Hồ Chí Minh', 'Quận 6', 'Phường 6', '15 Hậu Giang'],
    tags: ['Khách mới'],
    note: 'Tài khoản demo khách mới (Lv1) — để thử luồng lên hạng.',
  },
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

interface OrderDraft {
  id: string;
  code: string;
  customer: UserRecord;
  address: Address;
  /** Số con Bakugan khách mua — lấy từ những feed đang mở lúc đặt */
  itemCount: number;
  /** Món đã định sẵn (đơn cho người thắng đấu giá) */
  fixedItems?: StoredOrderItem[];
  createdAt: number;
  status: OrderStatus;
  method: PaymentMethod;
  source: OrderSource;
  discount?: number;
  cancelReason?: CancelReason;
  auctionId?: string;
  note?: string;
}

function finalizeOrder(
  draft: OrderDraft,
  items: StoredOrderItem[],
  now: number,
  rand: () => number,
): StoredOrder {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const discount = Math.min(draft.discount ?? 0, subtotal);
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
    items,
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

function buildOrderDrafts(users: UserRecord[], now: number, rand: () => number): OrderDraft[] {
  const byId = new Map(users.map((user) => [user.id, user]));
  const demo = byId.get('usr-001')!;
  const newcomer = byId.get('usr-002')!;
  const [home, office] = [demo.addresses[0]!, demo.addresses[1] ?? demo.addresses[0]!];

  // Các đơn quen thuộc của tài khoản demo (giữ nguyên mã để khớp tin nhắn mẫu).
  const drafts: OrderDraft[] = [
    {
      id: 'ord-001',
      code: 'TD2609A17',
      customer: demo,
      address: home,
      itemCount: 2,
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
      itemCount: 2,
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
      itemCount: 2,
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
      itemCount: 1,
      createdAt: now - 94 * DAY,
      status: 'cancelled',
      method: 'cod',
      source: 'web',
      cancelReason: 'customer-request',
    },
    // Đơn "Chờ xác nhận", chưa thanh toán — để thử tính năng trợ lý tự huỷ đơn.
    {
      id: 'ord-demo-pending',
      code: orderCode(now - 3 * HOUR, 81),
      customer: demo,
      address: home,
      itemCount: 1,
      createdAt: now - 3 * HOUR,
      status: 'pending',
      method: 'cod',
      source: 'web',
    },
    // Khách mới (Lv1): mới nhận 1 con, còn thiếu 2 con nữa để lên Lv2.
    {
      id: 'ord-new-001',
      code: orderCode(now - 9 * DAY, 82),
      customer: newcomer,
      address: newcomer.addresses[0]!,
      itemCount: 1,
      createdAt: now - 9 * DAY,
      status: 'completed',
      method: 'cod',
      source: 'web',
    },
  ];

  // Khách mới (usr-002, usr-020, usr-023) chỉ có đơn riêng bên dưới, để còn ở Lv1.
  const NEWCOMERS = new Set(['usr-001', 'usr-002', 'usr-020', 'usr-023']);
  const buyers = users.filter(
    (user) => user.role === 'customer' && user.status === 'active' && !NEWCOMERS.has(user.id),
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

    drafts.push({
      id: `ord-${String(index + 5).padStart(3, '0')}`,
      code: orderCode(createdAt, index + 4),
      customer,
      address: customer.addresses[0]!,
      itemCount: pickWeighted(
        [
          [1, 7],
          [2, 2.5],
          [3, 0.5],
        ] as const,
        rand,
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

  // Hai khách mới: mới mua một con, đang xin lên Lv2 (xem buildMembershipRequests).
  const duyen = byId.get('usr-020')!;
  const truong = byId.get('usr-023')!;
  drafts.push(
    {
      id: 'ord-new-002',
      code: orderCode(now - 16 * DAY, 83),
      customer: duyen,
      address: duyen.addresses[0]!,
      itemCount: 1,
      createdAt: now - 16 * DAY,
      status: 'completed',
      method: 'bank-transfer',
      source: 'web',
    },
    {
      id: 'ord-new-003',
      code: orderCode(now - 1.5 * DAY, 84),
      customer: truong,
      address: truong.addresses[0]!,
      itemCount: 1,
      createdAt: now - 1.5 * DAY,
      status: 'shipping',
      method: 'cod',
      source: 'web',
    },
  );

  // Khách bị khoá: ba đơn COD liên tiếp không nhận.
  const locked = byId.get('usr-022')!;
  [52, 37, 21].forEach((ago, index) => {
    const createdAt = now - ago * DAY;
    drafts.push({
      id: `ord-bn${index + 1}`,
      code: orderCode(createdAt, 60 + index),
      customer: locked,
      address: locked.addresses[0]!,
      itemCount: 1,
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
      itemCount: 0,
      fixedItems: [
        { itemId: `auction:${preyas.id}`, name: preyas.title, price: preyas.currentPrice },
      ],
      createdAt,
      status: 'packing',
      method: 'bank-transfer',
      source: 'auction',
      auctionId: preyas.id,
      note: 'Hàng đấu giá — khách đã chuyển khoản đủ.',
    });
  }

  return drafts;
}

/* ---------------- Feed & từng con Bakugan ---------------- */

/** Tổng số feed shop từng đăng trong bộ mẫu. */
const FEED_TOTAL = 36;
/**
 * Web chỉ giữ tối đa 30 feed. Bộ mẫu để sẵn 28 feed (8 feed cũ nhất đã xoá)
 * để admin đăng thêm vài feed là gặp bước xác nhận xoá feed cũ.
 */
const FEEDS_ON_WEB = 28;

interface FeedTheme {
  title: string;
  series?: BakuganModel['series'][];
  attributes?: BakuganModel['attribute'][];
  cheap?: boolean;
  rare?: boolean;
}

const FEED_THEMES: readonly FeedTheme[] = [
  { title: 'Lô Battle Brawlers đời đầu', series: ['battle-brawlers'] },
  { title: 'Lô Battle Planet đủ hệ', series: ['battle-planet'] },
  { title: 'Lô New Vestroia & Gundalian', series: ['new-vestroia', 'gundalian-invaders'] },
  { title: 'Lô hàng Nhật tuyển chọn', rare: true },
  { title: 'Lô Mechtanium Surge', series: ['mechtanium-surge', 'gundalian-invaders'] },
  { title: 'Lô Geogan Rising', series: ['geogan-rising'] },
  { title: 'Lô ký gửi của khách' },
  { title: 'Lô giá mềm cho người mới chơi', cheap: true },
  { title: 'Lô tổng hợp nhiều đời' },
  { title: 'Lô hệ Pyrus & Darkus', attributes: ['pyrus', 'darkus'] },
  { title: 'Lô hệ Aquos & Ventus', attributes: ['aquos', 'ventus'] },
  { title: 'Lô sưu tầm hàng hiếm', rare: true },
];

const FEED_CAPTIONS = [
  'Lô {n} con vừa về, shop đã test bung và nam châm từng con. Giá ghi theo từng mã bên dưới — ai chốt trước được trước.',
  '{n} con tuyển từ lô nhập tuần này, tình trạng ghi rõ từng con. Chốt đơn trên web hoặc nhắn shop kèm mã Bakugan.',
  'Mở bán {n} con, ảnh thật cả lô. Con nào có người mua sẽ hiện SOLD ngay trên feed.',
  'Lô {n} con nhiều đời, có vài con hiếm. Mỗi con một mã riêng, bấm vào mã để xem tình trạng chi tiết.',
] as const;

const NEWEST_FEED_CAPTION =
  'Shop vừa nhập về một lô tổng hợp nhiều đời (ảnh chụp cả lô). Đợt 1 mở bán 14 con bên dưới, các con còn lại sẽ lên feed sau. Mỗi con một mã riêng, ai chốt trước được trước — xem giờ mở bán ở trên và đặt báo thức kẻo lỡ nhé!';

const LOT_SUPPLIERS = [
  'Đại lý Toys Sài Gòn',
  'Lô nhập Nhật Bản (JP)',
  'Nhà sưu tầm Hà Nội',
  'Nguồn ký gửi của khách',
  'Kho sỉ Chợ Lớn',
] as const;

const CONDITION_NOTES: Record<ProductCondition, readonly string[]> = {
  'new-sealed': [
    'Nguyên seal, hộp đẹp',
    'Nguyên seal, hộp móp nhẹ một góc',
    'Seal zin, kèm thẻ Gate',
  ],
  'like-new': [
    'Bung mượt, nam châm khoẻ',
    'Đã mở hộp, như mới',
    'Trầy rất nhẹ ở lưng, bung tốt',
    'Đủ thẻ năng lực đi kèm',
  ],
  used: [
    'Trầy nhẹ, bung tốt',
    'Phai màu nhẹ ở cánh',
    'Lò xo hơi yếu, vẫn bung được',
    'Thiếu thẻ Gate, còn lại ổn',
    'Bung chậm, giá mềm cho người mới',
  ],
};

const CONDITION_PRICE_FACTOR: Record<ProductCondition, number> = {
  'new-sealed': 1.3,
  'like-new': 1,
  used: 0.62,
};

const MANUAL_SALE_NOTES = [
  'Khách chốt qua Messenger',
  'Bán trực tiếp tại shop',
  'Chốt trong buổi livestream',
  'Khách quen đặt qua Zalo',
] as const;

const WALK_IN_BUYERS = [
  'Anh Tùng',
  'Chị Mai',
  'Bạn Khoa',
  'Anh Phong',
  'Bạn Nhi',
  'Anh Đạt',
] as const;

/** Feed số n được đăng cách đây bao nhiêu ngày (feed mới nhất: 2 giờ trước). */
function feedAgeDays(number: number): number {
  if (number === FEED_TOTAL) return 2 / 24;
  return 1 + (FEED_TOTAL - 1 - number) * 3.1 + ((number * 37) % 10) / 20;
}

/** 20:00 tối nay giờ Việt Nam; nếu đã quá giờ đó thì 4 tiếng nữa. */
function nextOpeningTime(now: number): number {
  const VN_OFFSET = 7 * HOUR;
  const vnMidnight = Math.floor((now + VN_OFFSET) / DAY) * DAY - VN_OFFSET;
  const tonight = vnMidnight + 20 * HOUR;
  return tonight - now > 30 * MINUTE ? tonight : now + 4 * HOUR;
}

function roundPrice(value: number): number {
  return Math.max(150_000, Math.round(value / 10_000) * 10_000);
}

function pickModel(theme: FeedTheme, rand: () => number): BakuganModel {
  let pool = BAKUGAN_MODELS.filter(
    (model) =>
      (!theme.series || theme.series.includes(model.series)) &&
      (!theme.attributes || theme.attributes.includes(model.attribute)) &&
      (!theme.cheap || model.basePrice <= 700_000),
  );
  if (theme.rare) {
    const rare = pool.filter((model) => model.rare || model.basePrice >= 1_300_000);
    if (rare.length > 0 && rand() < 0.7) pool = rare;
  }
  return pick(pool.length > 0 ? pool : BAKUGAN_MODELS, rand);
}

function buildFeeds(
  now: number,
  rand: () => number,
): { feeds: StoredFeed[]; items: StoredItem[]; nextItemNumber: number } {
  const feeds: StoredFeed[] = [];
  const items: StoredItem[] = [];
  let sequence = 1;

  for (let number = 1; number <= FEED_TOTAL; number += 1) {
    const newest = number === FEED_TOTAL;
    const publishedAt = now - feedAgeDays(number) * DAY;
    const theme: FeedTheme = newest
      ? { title: 'Lô tổng hợp mới về' }
      : FEED_THEMES[(number * 7) % FEED_THEMES.length]!;
    const count = newest ? 14 : 8 + Math.floor(rand() * 7);
    const id = `feed-${String(number).padStart(3, '0')}`;
    let lotValue = 0;

    for (let index = 0; index < count; index += 1) {
      const model = pickModel(theme, rand);
      const condition = pickWeighted<ProductCondition>(
        theme.cheap
          ? [
              ['new-sealed', 5],
              ['like-new', 30],
              ['used', 65],
            ]
          : [
              ['new-sealed', 15],
              ['like-new', 45],
              ['used', 40],
            ],
        rand,
      );
      const price = roundPrice(
        model.basePrice * CONDITION_PRICE_FACTOR[condition] * (0.85 + rand() * 0.3),
      );
      lotValue += price;
      items.push({
        id: `itm-${String(sequence).padStart(4, '0')}`,
        code: formatItemCode(sequence),
        name: model.name,
        price,
        attribute: model.attribute,
        series: model.series,
        condition,
        conditionNote: pick(CONDITION_NOTES[condition], rand),
        gPower: model.gPower,
        status: 'available',
        feedId: id,
        position: index + 1,
        createdAt: iso(publishedAt),
      });
      sequence += 1;
    }

    feeds.push({
      id,
      number,
      title: newest ? `${theme.title} — đợt 1: ${count} con` : `${theme.title} — ${count} con`,
      caption: newest
        ? NEWEST_FEED_CAPTION
        : pick(FEED_CAPTIONS, rand).replace('{n}', String(count)),
      images: newest ? ['/feeds/lo-mau-01.webp'] : [`lot:${number}`],
      publishedAt: iso(publishedAt),
      opensAt: iso(newest ? nextOpeningTime(now) : publishedAt + 2 * HOUR),
      lotCost: Math.round((lotValue * (0.45 + rand() * 0.12)) / 100_000) * 100_000,
      supplier: pick(LOT_SUPPLIERS, rand),
      createdBy: ADMIN_DISPLAY_NAME,
    });
  }
  return { feeds, items, nextItemNumber: sequence };
}

/**
 * Gắn cho mỗi đơn những con đang còn bán trong các feed đã mở lúc khách đặt
 * (ưu tiên feed mở trong 2 tuần trước đó). Đơn còn hiệu lực làm con đó SOLD;
 * đơn huỷ / hoàn trả thì con đó quay lại bán tiếp.
 */
function fulfilOrders(
  drafts: OrderDraft[],
  feeds: readonly StoredFeed[],
  items: StoredItem[],
  now: number,
  rand: () => number,
): StoredOrder[] {
  const feedById = new Map(feeds.map((feed) => [feed.id, feed]));
  const opensAt = (item: StoredItem): number =>
    new Date(feedById.get(item.feedId!)!.opensAt).getTime();

  const orders: StoredOrder[] = [];
  [...drafts]
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((draft) => {
      if (draft.fixedItems) {
        orders.push(finalizeOrder(draft, draft.fixedItems, now, rand));
        return;
      }
      const opened = items.filter(
        (item) => item.status === 'available' && item.feedId && opensAt(item) <= draft.createdAt,
      );
      const fresh = opened.filter((item) => draft.createdAt - opensAt(item) <= 14 * DAY);
      const pool = [...(fresh.length >= draft.itemCount ? fresh : opened)];
      const chosen: StoredItem[] = [];
      while (chosen.length < draft.itemCount && pool.length > 0) {
        chosen.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
      }
      if (chosen.length === 0) return;

      if (draft.status !== 'cancelled' && draft.status !== 'returned') {
        chosen.forEach((item) => {
          const feed = feedById.get(item.feedId!)!;
          item.status = 'sold';
          item.soldVia = 'order';
          item.orderId = draft.id;
          item.soldAt = iso(draft.createdAt);
          item.feedTitle = feed.title;
          item.feedNumber = feed.number;
        });
      }
      orders.push(
        finalizeOrder(
          draft,
          chosen.map((item) => ({
            itemId: item.id,
            code: item.code,
            name: item.name,
            price: item.price,
          })),
          now,
          rand,
        ),
      );
    });
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Nhiều con được chốt ngoài web (Messenger, livestream, bán tại shop): feed càng
 * cũ càng bán gần hết, vài feed cũ còn sót 1–2 con.
 */
function sellOutsideWeb(
  feeds: readonly StoredFeed[],
  items: StoredItem[],
  now: number,
  rand: () => number,
): void {
  feeds.forEach((feed) => {
    const opened = new Date(feed.opensAt).getTime();
    if (opened > now) return;
    const ageDays = (now - opened) / DAY;
    const chance = ageDays > 24 ? 0.9 : ageDays > 12 ? 0.5 : ageDays > 5 ? 0.22 : 0.04;
    items
      .filter((item) => item.feedId === feed.id && item.status === 'available')
      .forEach((item) => {
        if (rand() >= chance) return;
        item.status = 'sold';
        item.soldVia = 'manual';
        item.soldAt = iso(Math.min(now - HOUR, opened + rand() * Math.min(ageDays, 6) * DAY));
        item.soldNote = pick(MANUAL_SALE_NOTES, rand);
        item.buyerName = pick(WALK_IN_BUYERS, rand);
        item.feedTitle = feed.title;
        item.feedNumber = feed.number;
      });
  });
}

/** Giữ lại các feed mới nhất; con chưa bán của feed đã xoá thành hàng tồn chờ đăng lại. */
function retireOldFeeds(feeds: StoredFeed[], items: StoredItem[]): StoredFeed[] {
  const keep = [...feeds].sort((a, b) => b.number - a.number).slice(0, FEEDS_ON_WEB);
  const kept = new Set(keep.map((feed) => feed.id));
  items.forEach((item) => {
    if (!item.feedId || kept.has(item.feedId)) return;
    const feed = feeds.find((entry) => entry.id === item.feedId)!;
    item.feedTitle = feed.title;
    item.feedNumber = feed.number;
    item.feedId = undefined;
  });
  return keep.sort((a, b) => a.number - b.number);
}

/* ---------------- Hạng thành viên ---------------- */

export const DEFAULT_MEMBER_DEPOSIT = 500_000;

function assignMemberships(users: UserRecord[], orders: readonly StoredOrder[], now: number): void {
  const bidders = new Set(AUCTION_BIDDERS.map((bidder) => bidder.id));
  users.forEach((user) => {
    if (user.role !== 'customer') return;
    const completed = orders
      .filter((order) => order.userId === user.id && order.status === 'completed')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let count = 0;
    let reachedAt: string | undefined;
    completed.forEach((order) => {
      count += order.items.length;
      if (!reachedAt && count >= PURCHASES_FOR_LV2) reachedAt = order.updatedAt;
    });

    if (reachedAt) {
      user.memberLevel = 2;
      user.levelSource = 'purchases';
      user.levelUpAt = reachedAt;
    } else if (bidders.has(user.id)) {
      // Khách đã tham gia đấu giá từ trước khi có luật Lv2 — admin duyệt lên.
      user.memberLevel = 2;
      user.levelSource = 'admin';
      user.levelUpAt = iso(now - 45 * DAY);
    } else {
      user.memberLevel = 1;
    }
  });

  // Khách VIP nạp tiền cọc để đấu giá.
  const vip = users.find((user) => user.id === 'usr-014');
  if (vip) {
    vip.depositBalance = DEFAULT_MEMBER_DEPOSIT;
    if (vip.levelSource !== 'purchases') {
      vip.memberLevel = 2;
      vip.levelSource = 'deposit';
      vip.levelUpAt = iso(now - 60 * DAY);
    }
  }
}

function buildMembershipRequests(users: readonly UserRecord[], now: number): MembershipRequest[] {
  const waiting = users.filter(
    (user) =>
      user.role === 'customer' &&
      user.status === 'active' &&
      user.memberLevel === 1 &&
      user.id !== 'usr-002',
  );
  const requests: MembershipRequest[] = [];
  const depositor = waiting.find((user) => user.id === 'usr-020') ?? waiting[0];
  const reviewer = waiting.find((user) => user.id === 'usr-023') ?? waiting[1];
  if (depositor) {
    requests.push({
      id: 'mbr-002',
      userId: depositor.id,
      kind: 'deposit',
      amount: DEFAULT_MEMBER_DEPOSIT,
      transferNote: `TDLV2 ${depositor.phone}`,
      message: 'Mình đã chuyển khoản 500.000₫ để lên Lv2, shop kiểm tra giúp nhé.',
      status: 'pending',
      createdAt: iso(now - 3 * HOUR),
    });
  }
  if (reviewer) {
    requests.push({
      id: 'mbr-003',
      userId: reviewer.id,
      kind: 'review',
      message: 'Mình hay mua trực tiếp ở shop (đã mua 4 con), admin duyệt giúp mình lên Lv2 với.',
      status: 'pending',
      createdAt: iso(now - 26 * HOUR),
    });
  }
  requests.push({
    id: 'mbr-001',
    userId: 'usr-014',
    kind: 'deposit',
    amount: DEFAULT_MEMBER_DEPOSIT,
    transferNote: 'TDLV2 0914567230',
    status: 'approved',
    createdAt: iso(now - 61 * DAY),
    resolvedAt: iso(now - 60 * DAY),
    resolvedBy: ADMIN_DISPLAY_NAME,
    adminNote: 'Đã nhận đủ tiền.',
  });
  return requests;
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
    'Chào bạn! Mình là trợ lý AI của TD Bakugan. Mình tư vấn chọn Bakugan trong feed, tra đơn, huỷ đơn chưa xác nhận, giải thích cách lên Lv2 để đấu giá… Việc nào cần nhân viên, mình chuyển ngay nhé.',
  topics: {
    'order-status': true,
    'order-cancel': true,
    shipping: true,
    payment: true,
    returns: true,
    'auction-rules': true,
    'product-info': true,
    'bakugan-knowledge': true,
    membership: true,
    'store-info': true,
    promotions: true,
  },
  extraKnowledge:
    'Feed mới thường mở bán lúc 20:00. Tuần này có phiên đấu giá Titanium Dragonoid mạ vàng. Hàng hiếm không nhận giữ quá 24 giờ.',
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
  const rand = createRandom(20_260_927);
  const users = buildUsers(now);
  const { feeds, items, nextItemNumber } = buildFeeds(now, rand);
  const orders = fulfilOrders(buildOrderDrafts(users, now, rand), feeds, items, now, rand);
  sellOutsideWeb(feeds, items, now, rand);
  const webFeeds = retireOldFeeds(feeds, items);
  assignMemberships(users, orders, now);

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
    feeds: webFeeds,
    items,
    nextFeedNumber: FEED_TOTAL + 1,
    nextItemNumber,
    membershipRequests: buildMembershipRequests(users, now),
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
    shopSettings: {
      memberDepositAmount: DEFAULT_MEMBER_DEPOSIT,
      // Để trống: admin tự nhập tài khoản nhận tiền thật trong trang Cài đặt.
      bank: { bankName: '', accountNumber: '', accountHolder: '' },
    },
  };
}
