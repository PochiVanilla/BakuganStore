import type {
  AccountStatus,
  AuctionFulfillment,
  BotSettings,
  ChatConversation,
  Order,
  OrderIssue,
  OrderItem,
  Product,
  ShopSettings,
  StockReceipt,
  User,
} from '@/types';
import { productPlaceholder } from '@/utils/placeholder';
import { MOCK_PRODUCTS } from './products';
import { MOCK_AUCTIONS } from './auctions';
import { createDemoPendingOrder, createSeedDatabase } from './seed';

/* ============================================================
   "Cơ sở dữ liệu" của chế độ mock
   ------------------------------------------------------------
   Lưu trong localStorage để thao tác của admin (tạo đơn, nhập kho,
   khoá tài khoản, chat…) còn nguyên sau khi tải lại trang. Khi nối
   backend thật, toàn bộ file này không còn được dùng tới.

   Ảnh sản phẩm là SVG data-URI khá nặng nên không lưu vào đây: đơn
   hàng chỉ giữ productId, ảnh được gắn lại lúc đọc.
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
}

/** Những trường admin được sửa trên sản phẩm có sẵn. `originalPrice: 0` nghĩa là bỏ giảm giá. */
export type ProductPatch = Partial<Omit<Product, 'id' | 'slug' | 'images' | 'createdAt'>>;
export type StoredProduct = Omit<Product, 'images'>;

export interface MockDatabase {
  version: number;
  seededAt: string;
  users: UserRecord[];
  orders: StoredOrder[];
  productPatches: Record<string, ProductPatch>;
  customProducts: StoredProduct[];
  receipts: StockReceipt[];
  issues: OrderIssue[];
  auctionFulfillments: AuctionFulfillment[];
  conversations: ChatConversation[];
  botSettings: BotSettings;
  shopSettings: ShopSettings;
}

const STORAGE_KEY = 'td-bakugan:mock-db';
/** Tăng số này khi đổi cấu trúc dữ liệu; bản cũ được nâng cấp trong `migrate`. */
export const DB_VERSION = 2;

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
 * Nâng cấp dữ liệu đã lưu ở phiên bản trước, giữ nguyên đơn, khách, tin nhắn.
 * Trả về undefined nếu không nâng cấp được (khi đó seed lại từ đầu).
 */
function migrate(data: Partial<MockDatabase>): MockDatabase | undefined {
  if (data.version === DB_VERSION) return data as MockDatabase;
  if (data.version !== 1 || !data.botSettings || !data.orders || !data.users) return undefined;

  // v1 -> v2: thêm việc "tự huỷ đơn" và "kiến thức Bakugan" cho trợ lý.
  const db = data as MockDatabase;
  const topics = db.botSettings.topics as Partial<MockDatabase['botSettings']['topics']>;
  db.botSettings.topics = {
    ...db.botSettings.topics,
    'order-cancel': topics['order-cancel'] ?? true,
    'bakugan-knowledge': topics['bakugan-knowledge'] ?? true,
    // Mã giảm giá từng tắt mặc định; admin chưa từng lưu cài đặt thì bật lên.
    promotions: db.botSettings.updatedAt === db.seededAt ? true : db.botSettings.topics.promotions,
  };
  const demo = db.users.find((user) => user.id === 'usr-001');
  const demoHasPending = db.orders.some(
    (order) => order.userId === 'usr-001' && order.status === 'pending',
  );
  if (demo && !demoHasPending && !db.orders.some((order) => order.id === 'ord-demo-pending')) {
    db.orders.unshift(createDemoPendingOrder(demo, Date.now()));
  }
  db.version = DB_VERSION;
  return db;
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

function withImages(product: StoredProduct): Product {
  return {
    ...product,
    originalPrice: product.originalPrice || undefined,
    images: [0, 1].map((variant) =>
      productPlaceholder(product.name.replace(/^Bakugan\s+/, ''), product.attribute, variant),
    ),
  };
}

/** Toàn bộ sản phẩm hiện tại: dữ liệu gốc + chỉnh sửa của admin + sản phẩm admin thêm. */
export function listAllProducts(db: Readonly<MockDatabase> = readDb()): Product[] {
  const base = MOCK_PRODUCTS.map((product) => {
    const patch = db.productPatches[product.id];
    if (!patch) return product;
    // JSON bỏ mất giá trị undefined, nên "gỡ giá gốc" được lưu thành 0.
    const merged = { ...product, ...patch };
    return { ...merged, originalPrice: merged.originalPrice || undefined };
  });
  return [...base, ...db.customProducts.map(withImages)];
}

/** Sản phẩm khách được thấy (bỏ các mẫu admin đang ẩn). */
export function listVisibleProducts(db: Readonly<MockDatabase> = readDb()): Product[] {
  return listAllProducts(db).filter((product) => !product.isHidden);
}

/** Ghi thay đổi cho một sản phẩm, dù là sản phẩm gốc hay do admin thêm. */
export function patchProduct(db: MockDatabase, productId: string, patch: ProductPatch): void {
  const custom = db.customProducts.find((product) => product.id === productId);
  if (custom) {
    Object.assign(custom, patch);
    return;
  }
  db.productPatches[productId] = { ...db.productPatches[productId], ...patch };
}

const FALLBACK_IMAGE = productPlaceholder('TD Bakugan', 'darkus', 0);

function imageFor(productId: string, products: Product[]): string {
  if (productId.startsWith('auction:')) {
    const auction = MOCK_AUCTIONS.find((item) => item.id === productId.slice('auction:'.length));
    return auction?.images[0] ?? FALLBACK_IMAGE;
  }
  return products.find((product) => product.id === productId)?.images[0] ?? FALLBACK_IMAGE;
}

/** Gắn lại ảnh cho đơn đọc từ kho dữ liệu. */
export function hydrateOrder(order: StoredOrder, products: Product[] = listAllProducts()): Order {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item, image: imageFor(item.productId, products) })),
  };
}

export function stripOrderImages(items: OrderItem[]): StoredOrderItem[] {
  return items.map(({ image: _image, ...rest }) => rest);
}
