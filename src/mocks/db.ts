import type {
  AccountStatus,
  AuctionFulfillment,
  BakuganAttribute,
  BakuganItem,
  BakuganSeries,
  BotSettings,
  ChatConversation,
  FeedPost,
  ItemStatus,
  LevelSource,
  MembershipRequest,
  Order,
  OrderIssue,
  OrderItem,
  ProductCondition,
  ShopSettings,
  User,
} from '@/types';
import { BOT_TOPIC_IDS } from '@/types';
import { lotPlaceholder, productPlaceholder } from '@/utils/placeholder';
import { MOCK_AUCTIONS } from './auctions';
import { createSeedDatabase, DEFAULT_BOT_SETTINGS } from './seed';

/* ============================================================
   "Cơ sở dữ liệu" của chế độ mock
   ------------------------------------------------------------
   Lưu trong localStorage để thao tác của admin (đăng feed, tạo đơn,
   khoá tài khoản, chat…) còn nguyên sau khi tải lại trang. Khi nối
   backend thật, toàn bộ file này không còn được dùng tới.

   Ảnh minh hoạ là SVG sinh tại chỗ nên không lưu vào đây; ảnh admin
   tải lên nằm trong IndexedDB (xem services/api/imageStore.ts), ở đây
   chỉ giữ mã tham chiếu "idb:<id>".
   ============================================================ */

export type StoredOrderItem = Omit<OrderItem, 'image'>;
export interface StoredOrder extends Omit<Order, 'items'> {
  items: StoredOrderItem[];
}

/** Bản ghi người dùng phía "server" — có thêm các trường chỉ admin quản lý. */
export interface UserRecord extends User {
  status: AccountStatus;
  lockedReason?: string;
  lastLoginAt?: string;
  tags: string[];
  adminNote: string;
  levelSource?: LevelSource;
  levelUpAt?: string;
  /** Tổng tiền khách đã nạp (để lên Lv2 / trừ vào đơn đấu giá) */
  depositBalance?: number;
}

/** Một con Bakugan như được lưu phía server. */
export interface StoredItem {
  id: string;
  code: string;
  name: string;
  price: number;
  attribute: BakuganAttribute;
  series?: BakuganSeries;
  condition: ProductCondition;
  conditionNote?: string;
  gPower?: number;
  /** Ảnh riêng (mã tham chiếu hoặc URL) */
  photo?: string;
  status: ItemStatus;
  soldAt?: string;
  soldVia?: 'order' | 'manual';
  orderId?: string;
  soldNote?: string;
  buyerName?: string;
  feedId?: string;
  /** Thứ tự trong feed */
  position: number;
  /** Tên / số feed lúc con này được bán hoặc lúc feed bị xoá */
  feedTitle?: string;
  feedNumber?: number;
  createdAt: string;
}

export interface StoredFeed {
  id: string;
  number: number;
  title: string;
  caption: string;
  /** Mã tham chiếu ảnh: "lot:<hạt giống>", "idb:<id>", "/feeds/…" hoặc URL */
  images: string[];
  publishedAt: string;
  opensAt: string;
  lotCost?: number;
  supplier?: string;
  createdBy: string;
}

export interface MockDatabase {
  version: number;
  seededAt: string;
  users: UserRecord[];
  orders: StoredOrder[];
  feeds: StoredFeed[];
  items: StoredItem[];
  nextFeedNumber: number;
  nextItemNumber: number;
  membershipRequests: MembershipRequest[];
  issues: OrderIssue[];
  auctionFulfillments: AuctionFulfillment[];
  conversations: ChatConversation[];
  botSettings: BotSettings;
  shopSettings: ShopSettings;
}

const STORAGE_KEY = 'td-bakugan:mock-db';
/** Tăng số này khi đổi cấu trúc dữ liệu; bản cũ được nâng cấp trong `migrate`. */
export const DB_VERSION = 3;

let cache: MockDatabase | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function persist(db: MockDatabase): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Hết dung lượng hoặc bị chặn — dữ liệu vẫn sống trong bộ nhớ tới khi tải lại.
  }
}

/**
 * Nâng cấp dữ liệu đã lưu ở phiên bản trước.
 *
 * v1/v2 bán theo "mẫu sản phẩm có số lượng"; v3 bán theo feed, mỗi con một mã.
 * Đơn và kho cũ gắn với mẫu sản phẩm nên được sinh lại theo cách bán mới,
 * còn tài khoản, cài đặt bot và tin nhắn thì giữ nguyên.
 */
function migrate(data: Partial<MockDatabase>): MockDatabase | undefined {
  if (data.version === DB_VERSION) return data as MockDatabase;
  if ((data.version !== 1 && data.version !== 2) || !data.users || !data.botSettings) {
    return undefined;
  }

  const fresh = createSeedDatabase(DB_VERSION);
  const seeded = new Map(fresh.users.map((user) => [user.id, user]));
  const users = data.users.map((user): UserRecord => {
    const seed = seeded.get(user.id);
    return seed
      ? {
          ...user,
          memberLevel: seed.memberLevel,
          levelSource: seed.levelSource,
          levelUpAt: seed.levelUpAt,
          depositBalance: seed.depositBalance,
        }
      : user;
  });
  // Tài khoản mới có trong bộ mẫu (VD khách demo Lv1) mà bản cũ chưa có.
  fresh.users.forEach((user) => {
    if (!users.some((item) => item.id === user.id)) users.push(user);
  });

  const oldTopics = data.botSettings.topics as Partial<BotSettings['topics']>;
  const topics = Object.fromEntries(
    BOT_TOPIC_IDS.map((topic) => [topic, oldTopics[topic] ?? DEFAULT_BOT_SETTINGS.topics[topic]]),
  ) as BotSettings['topics'];

  return {
    ...fresh,
    users,
    conversations: (data.conversations ?? fresh.conversations).map(
      ({ pendingAction: _pending, ...conversation }) => conversation,
    ),
    botSettings: {
      ...data.botSettings,
      topics,
      // Lời chào cũ nhắc tới "tư vấn mẫu" — đổi sang lời chào mới nếu admin chưa sửa.
      greeting:
        data.botSettings.updatedAt === data.seededAt
          ? DEFAULT_BOT_SETTINGS.greeting
          : data.botSettings.greeting,
    },
  };
}

function load(): MockDatabase {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MockDatabase>;
      const storedVersion = parsed.version;
      const migrated = migrate(parsed);
      if (migrated) {
        if (storedVersion !== DB_VERSION) persist(migrated);
        return migrated;
      }
    }
  } catch {
    // Dữ liệu hỏng thì seed lại từ đầu.
  }
  const fresh = createSeedDatabase(DB_VERSION);
  persist(fresh);
  return fresh;
}

function emit(): void {
  revision += 1;
  listeners.forEach((listener) => listener());
}

/** Đọc toàn bộ dữ liệu. Không sửa trực tiếp object trả về — dùng `updateDb`. */
export function readDb(): Readonly<MockDatabase> {
  if (!cache) cache = load();
  return cache;
}

/**
 * Sửa dữ liệu trên một bản sao rồi mới thay vào, nên object nào đã trả cho
 * giao diện trước đó vẫn giữ nguyên giá trị cũ (React so sánh được).
 */
export function updateDb<T>(mutate: (db: MockDatabase) => T): T {
  const draft = structuredClone(readDb()) as MockDatabase;
  const result = mutate(draft);
  cache = draft;
  persist(draft);
  emit();
  return result;
}

/** Xoá dữ liệu đã chỉnh sửa, quay về bộ dữ liệu mẫu ban đầu. */
export function resetDb(): void {
  cache = createSeedDatabase(DB_VERSION);
  persist(cache);
  emit();
}

export function subscribeDb(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDbRevision(): number {
  return revision;
}

// Tab khác (VD: một tab khách, một tab admin) ghi dữ liệu -> tab này cập nhật theo.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    emit();
  });
}

/* ---------------- Tiện ích dùng chung cho các service mock ---------------- */

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function itemImage(item: Pick<StoredItem, 'photo' | 'name' | 'attribute'>): string {
  return item.photo ?? productPlaceholder(item.name, item.attribute);
}

/** Ảnh của feed: ảnh minh hoạ "lot:" được sinh theo màu hệ của những con trong lô. */
export function feedImages(feed: StoredFeed, items: readonly StoredItem[]): string[] {
  return feed.images.map((ref) =>
    ref.startsWith('lot:')
      ? lotPlaceholder(
          ref.slice(4),
          items.map((item) => item.attribute),
        )
      : ref,
  );
}

export function isFeedOpen(feed: Pick<StoredFeed, 'opensAt'>, now: number = Date.now()): boolean {
  return new Date(feed.opensAt).getTime() <= now;
}

export function itemsOfFeed(db: Readonly<MockDatabase>, feedId: string): StoredItem[] {
  return db.items.filter((item) => item.feedId === feedId).sort((a, b) => a.position - b.position);
}

/** Con Bakugan như khách thấy: không có người mua, đơn hay ghi chú nội bộ. */
export function toPublicItem(
  item: StoredItem,
  feed?: Pick<StoredFeed, 'number' | 'title' | 'opensAt'>,
  now: number = Date.now(),
): BakuganItem {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    price: item.price,
    attribute: item.attribute,
    series: item.series,
    condition: item.condition,
    conditionNote: item.conditionNote,
    gPower: item.gPower,
    image: itemImage(item),
    hasOwnPhoto: Boolean(item.photo),
    status: item.status,
    soldAt: item.soldAt,
    feedId: item.feedId,
    feedNumber: feed?.number ?? item.feedNumber,
    feedTitle: feed?.title ?? item.feedTitle,
    feedOpensAt: feed?.opensAt,
    onSale: item.status === 'available' && Boolean(feed) && isFeedOpen(feed!, now),
    createdAt: item.createdAt,
  };
}

export function toFeedPost(
  feed: StoredFeed,
  items: readonly StoredItem[],
  now: number = Date.now(),
): FeedPost {
  const soldCount = items.filter((item) => item.status === 'sold').length;
  const available = items.filter((item) => item.status === 'available');
  const soldOut = items.length > 0 && available.length === 0;
  const prices = available.map((item) => item.price);
  return {
    id: feed.id,
    number: feed.number,
    title: feed.title,
    caption: feed.caption,
    images: feedImages(feed, items),
    publishedAt: feed.publishedAt,
    opensAt: feed.opensAt,
    status: !isFeedOpen(feed, now) ? 'upcoming' : soldOut ? 'sold-out' : 'selling',
    itemCount: items.length,
    soldCount,
    soldOutAt: soldOut
      ? items.reduce<string | undefined>(
          (latest, item) =>
            item.soldAt && (!latest || item.soldAt > latest) ? item.soldAt : latest,
          undefined,
        )
      : undefined,
    priceRange:
      prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : undefined,
    items: items.map((item) => toPublicItem(item, feed, now)),
  };
}

/*
 * Danh sách feed được dựng lại (ghép từng con, ảnh, trạng thái) mỗi khi màn hình
 * cần. Nhớ kết quả cho tới khi dữ liệu đổi (updateDb tạo object mới) hoặc tới giờ
 * mở bán của feed kế tiếp (trạng thái "sắp mở bán" đổi thành "đang bán").
 */
let postsCache: { db: Readonly<MockDatabase>; validUntil: number; posts: FeedPost[] } | null = null;

/** Các feed đang có trên web, mới nhất trước. */
export function listFeedPosts(db: Readonly<MockDatabase> = readDb()): FeedPost[] {
  const now = Date.now();
  if (postsCache && postsCache.db === db && now < postsCache.validUntil) return postsCache.posts;

  const byFeed = new Map<string, StoredItem[]>();
  db.items.forEach((item) => {
    if (!item.feedId) return;
    const list = byFeed.get(item.feedId);
    if (list) list.push(item);
    else byFeed.set(item.feedId, [item]);
  });
  byFeed.forEach((list) => list.sort((a, b) => a.position - b.position));

  const posts = [...db.feeds]
    .sort((a, b) => b.number - a.number)
    .map((feed) => toFeedPost(feed, byFeed.get(feed.id) ?? [], now));
  const nextOpening = db.feeds
    .map((feed) => new Date(feed.opensAt).getTime())
    .filter((time) => time > now)
    .reduce((soonest, time) => Math.min(soonest, time), Number.POSITIVE_INFINITY);
  postsCache = { db, validUntil: nextOpening, posts };
  return posts;
}

const FALLBACK_IMAGE = productPlaceholder('TD Bakugan', 'darkus', 0);

function imageFor(itemId: string, db: Readonly<MockDatabase>): string {
  if (itemId.startsWith('auction:')) {
    const auction = MOCK_AUCTIONS.find((item) => item.id === itemId.slice('auction:'.length));
    return auction?.images[0] ?? FALLBACK_IMAGE;
  }
  const item = db.items.find((entry) => entry.id === itemId);
  return item ? itemImage(item) : FALLBACK_IMAGE;
}

/** Gắn lại ảnh cho đơn đọc từ kho dữ liệu. */
export function hydrateOrder(order: StoredOrder, db: Readonly<MockDatabase> = readDb()): Order {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item, image: imageFor(item.itemId, db) })),
  };
}
