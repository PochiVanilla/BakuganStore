import type {
  ApiResponse,
  BakuganAttribute,
  BakuganSeries,
  Product,
  ProductCondition,
  StockLevel,
  StockReceipt,
} from '@/types';
import { BAKUGAN_ATTRIBUTES } from '@/types';
import { ATTRIBUTE_META, CONDITION_LABELS, SERIES_META } from '@/constants/catalog';
import {
  createId,
  listAllProducts,
  patchProduct,
  readDb,
  updateDb,
  type StoredProduct,
} from '@/mocks/db';
import { normalizeSearch, slugify } from '@/utils/slugify';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from '../client';
import { requireAdmin } from '../mockSession';
import { stockLevelOf, vnDateKey, withinDays } from './shared';

/* ============================================================
   Hàng hoá & tồn kho
   ============================================================ */

export interface InventoryRow {
  product: Product;
  level: StockLevel;
  /** Giá vốn bình quân từ các phiếu nhập (nếu có) */
  averageCost?: number;
}

export interface InventorySummary {
  skuCount: number;
  unitCount: number;
  lowCount: number;
  outCount: number;
  hiddenCount: number;
  /** Giá trị hàng tồn theo giá bán */
  retailValue: number;
  unitsByAttribute: Record<BakuganAttribute, number>;
  threshold: number;
}

export interface InventoryQuery {
  keyword?: string;
  attribute?: BakuganAttribute | 'all';
  level?: StockLevel | 'hidden' | 'all';
  sort?: 'stock-asc' | 'stock-desc' | 'name' | 'sold';
}

export interface InventoryResult {
  rows: InventoryRow[];
  summary: InventorySummary;
}

function averageCosts(receipts: readonly StockReceipt[]): Map<string, number> {
  const totals = new Map<string, { cost: number; quantity: number }>();
  receipts.forEach((receipt) =>
    receipt.items.forEach((item) => {
      const entry = totals.get(item.productId) ?? { cost: 0, quantity: 0 };
      entry.cost += item.unitCost * item.quantity;
      entry.quantity += item.quantity;
      totals.set(item.productId, entry);
    }),
  );
  return new Map(
    [...totals].map(([productId, entry]) => [
      productId,
      // Làm tròn tới nghìn đồng cho dễ đọc
      Math.round(entry.cost / entry.quantity / 1_000) * 1_000,
    ]),
  );
}

export async function listInventory(query: InventoryQuery = {}): Promise<InventoryResult> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<InventoryResult>>('/admin/inventory', {
      params: query,
    });
    return data.data;
  }
  requireAdmin();
  const { keyword = '', attribute = 'all', level = 'all', sort = 'stock-asc' } = query;
  const db = readDb();
  const threshold = db.shopSettings.lowStockThreshold;
  const costs = averageCosts(db.receipts);
  const all = listAllProducts(db).map((product): InventoryRow => ({
    product,
    level: stockLevelOf(product, threshold),
    averageCost: costs.get(product.id),
  }));

  const unitsByAttribute = Object.fromEntries(
    BAKUGAN_ATTRIBUTES.map((value) => [value, 0]),
  ) as Record<BakuganAttribute, number>;
  all.forEach((row) => {
    unitsByAttribute[row.product.attribute] += row.product.stock;
  });

  const summary: InventorySummary = {
    skuCount: all.length,
    unitCount: all.reduce((sum, row) => sum + row.product.stock, 0),
    lowCount: all.filter((row) => row.level === 'low').length,
    outCount: all.filter((row) => row.level === 'out').length,
    hiddenCount: all.filter((row) => row.product.isHidden).length,
    retailValue: all.reduce((sum, row) => sum + row.product.stock * row.product.price, 0),
    unitsByAttribute,
    threshold,
  };

  const needle = normalizeSearch(keyword);
  const rows = all
    .filter((row) => (attribute === 'all' ? true : row.product.attribute === attribute))
    .filter((row) => {
      if (level === 'all') return true;
      if (level === 'hidden') return Boolean(row.product.isHidden);
      return row.level === level;
    })
    .filter((row) =>
      needle ? normalizeSearch(`${row.product.name} ${row.product.id}`).includes(needle) : true,
    )
    .sort((a, b) => {
      switch (sort) {
        case 'stock-desc':
          return b.product.stock - a.product.stock;
        case 'name':
          return a.product.name.localeCompare(b.product.name, 'vi');
        case 'sold':
          return b.product.soldCount - a.product.soldCount;
        case 'stock-asc':
        default:
          return a.product.stock - b.product.stock;
      }
    });

  return mockDelay({ rows, summary }, 260);
}

/** Danh sách gọn để chọn sản phẩm khi tạo đơn / lập phiếu nhập. */
export async function listProductOptions(): Promise<Product[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/admin/products/options');
    return data.data;
  }
  requireAdmin();
  return mockDelay(
    [...listAllProducts()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    160,
  );
}

export interface ProductInput {
  name: string;
  shortDescription: string;
  attribute: BakuganAttribute;
  series: BakuganSeries;
  condition: ProductCondition;
  gPower: number;
  price: number;
  originalPrice?: number;
  stock: number;
  isFeatured: boolean;
  isRare: boolean;
  isHidden: boolean;
}

function validateProduct(input: ProductInput): void {
  if (input.originalPrice !== undefined && input.originalPrice <= input.price) {
    throw new MockApiError('Giá gốc phải lớn hơn giá bán nếu đang giảm giá.', 422, {
      originalPrice: 'Giá gốc phải lớn hơn giá bán.',
    });
  }
}

export async function saveProduct(input: ProductInput, productId?: string): Promise<Product> {
  if (!USE_MOCK) {
    const { data } = productId
      ? await apiClient.put<ApiResponse<Product>>(`/admin/products/${productId}`, input)
      : await apiClient.post<ApiResponse<Product>>('/admin/products', input);
    return data.data;
  }
  requireAdmin();
  validateProduct(input);

  const savedId = updateDb((db) => {
    if (productId) {
      if (!listAllProducts(db).some((product) => product.id === productId)) {
        throw new MockApiError('Không tìm thấy sản phẩm này.', 404);
      }
      patchProduct(db, productId, { ...input, originalPrice: input.originalPrice ?? 0 });
      return productId;
    }

    const id = createId('prd');
    const attributeMeta = ATTRIBUTE_META[input.attribute];
    const seriesMeta = SERIES_META[input.series];
    const product: StoredProduct = {
      id,
      slug: `${slugify(input.name)}-${id.slice(-4)}`,
      name: input.name.trim(),
      shortDescription: input.shortDescription.trim(),
      description: [
        input.shortDescription.trim(),
        `Hệ ${attributeMeta.label} (${attributeMeta.element}), dòng ${seriesMeta.label} (${seriesMeta.years}). G-Power ${input.gPower}G, tình trạng ${CONDITION_LABELS[input.condition].toLowerCase()}.`,
      ].join('\n\n'),
      price: input.price,
      originalPrice: input.originalPrice,
      attribute: input.attribute,
      series: input.series,
      gPower: input.gPower,
      condition: input.condition,
      stock: input.stock,
      soldCount: 0,
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
      accessories: [{ name: 'Túi chống sốc', included: true }],
      specs: [
        { label: 'Hệ (Attribute)', value: `${attributeMeta.label} — ${attributeMeta.element}` },
        { label: 'Dòng (Series)', value: `${seriesMeta.label} (${seriesMeta.years})` },
        { label: 'G-Power', value: `${input.gPower} G` },
        { label: 'Tình trạng', value: CONDITION_LABELS[input.condition] },
      ],
      tags: [attributeMeta.label, seriesMeta.label, CONDITION_LABELS[input.condition]],
      isFeatured: input.isFeatured,
      isBestSeller: false,
      isRare: input.isRare,
      isHidden: input.isHidden,
    };
    db.customProducts.push(product);
    return id;
  });

  const saved = listAllProducts().find((product) => product.id === savedId)!;
  return mockDelay(saved, 450);
}

/** Cộng/trừ nhanh tồn kho (kiểm kê, hàng hỏng…). Nhập hàng mới nên dùng phiếu nhập. */
export async function adjustStock(productId: string, delta: number): Promise<Product> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<Product>>(
      `/admin/products/${productId}/stock-adjustments`,
      { delta },
    );
    return data.data;
  }
  requireAdmin();
  if (!Number.isInteger(delta) || delta === 0) {
    throw new MockApiError('Số lượng điều chỉnh không hợp lệ.', 422);
  }
  updateDb((db) => {
    const product = listAllProducts(db).find((item) => item.id === productId);
    if (!product) throw new MockApiError('Không tìm thấy sản phẩm này.', 404);
    patchProduct(db, productId, { stock: Math.max(0, product.stock + delta) });
  });
  return mockDelay(
    listAllProducts().find((product) => product.id === productId)!,
    200,
  );
}

export async function setProductHidden(productId: string, isHidden: boolean): Promise<void> {
  if (!USE_MOCK) {
    await apiClient.patch(`/admin/products/${productId}`, { isHidden });
    return;
  }
  requireAdmin();
  updateDb((db) => patchProduct(db, productId, { isHidden }));
  await mockDelay(null, 200);
}

/* ============================================================
   Phiếu nhập & báo cáo nhập hàng
   ============================================================ */

export interface ReceiptQuery {
  days?: number;
  supplier?: string;
}

export interface ReceiptReport {
  receipts: StockReceipt[];
  totalCost: number;
  totalQuantity: number;
  bySupplier: Array<{ supplier: string; receipts: number; quantity: number; cost: number }>;
  byAttribute: Record<BakuganAttribute, number>;
  /** Theo tháng, cũ -> mới: "2026-09" */
  byMonth: Array<{ month: string; quantity: number; cost: number }>;
  suppliers: string[];
}

export async function getReceiptReport(query: ReceiptQuery = {}): Promise<ReceiptReport> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<ReceiptReport>>('/admin/stock-receipts', {
      params: query,
    });
    return data.data;
  }
  requireAdmin();
  const { days = 90, supplier = '' } = query;
  const all = readDb().receipts;
  const receipts = all
    .filter((receipt) => withinDays(receipt.receivedAt, days))
    .filter((receipt) => (supplier ? receipt.supplier === supplier : true))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const suppliers = new Map<string, { receipts: number; quantity: number; cost: number }>();
  const months = new Map<string, { quantity: number; cost: number }>();
  const byAttribute = Object.fromEntries(BAKUGAN_ATTRIBUTES.map((value) => [value, 0])) as Record<
    BakuganAttribute,
    number
  >;

  receipts.forEach((receipt) => {
    const entry = suppliers.get(receipt.supplier) ?? { receipts: 0, quantity: 0, cost: 0 };
    entry.receipts += 1;
    entry.quantity += receipt.totalQuantity;
    entry.cost += receipt.totalCost;
    suppliers.set(receipt.supplier, entry);

    const month = vnDateKey(receipt.receivedAt).slice(0, 7);
    const monthEntry = months.get(month) ?? { quantity: 0, cost: 0 };
    monthEntry.quantity += receipt.totalQuantity;
    monthEntry.cost += receipt.totalCost;
    months.set(month, monthEntry);

    receipt.items.forEach((item) => {
      byAttribute[item.attribute] += item.quantity;
    });
  });

  return mockDelay(
    {
      receipts,
      totalCost: receipts.reduce((sum, receipt) => sum + receipt.totalCost, 0),
      totalQuantity: receipts.reduce((sum, receipt) => sum + receipt.totalQuantity, 0),
      bySupplier: [...suppliers]
        .map(([name, entry]) => ({ supplier: name, ...entry }))
        .sort((a, b) => b.cost - a.cost),
      byAttribute,
      byMonth: [...months]
        .map(([month, entry]) => ({ month, ...entry }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      suppliers: [...new Set(all.map((receipt) => receipt.supplier))].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
    },
    280,
  );
}

export interface ReceiptInput {
  supplier: string;
  receivedAt: string;
  note?: string;
  items: Array<{ productId: string; quantity: number; unitCost: number }>;
}

export async function createReceipt(input: ReceiptInput): Promise<StockReceipt> {
  if (!USE_MOCK) {
    const { data } = await apiClient.post<ApiResponse<StockReceipt>>(
      '/admin/stock-receipts',
      input,
    );
    return data.data;
  }
  const admin = requireAdmin();
  if (input.items.length === 0)
    throw new MockApiError('Phiếu nhập cần ít nhất một dòng hàng.', 422);

  const receipt = updateDb((db) => {
    const products = listAllProducts(db);
    const items = input.items.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) throw new MockApiError('Có sản phẩm không tồn tại trong kho.', 422);
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.unitCost < 0) {
        throw new MockApiError(`Số lượng hoặc giá vốn của "${product.name}" không hợp lệ.`, 422);
      }
      patchProduct(db, product.id, { stock: product.stock + line.quantity });
      return {
        productId: product.id,
        productName: product.name,
        attribute: product.attribute,
        quantity: line.quantity,
        unitCost: line.unitCost,
      };
    });

    const receivedAt = new Date(input.receivedAt);
    const stamp = vnDateKey(receivedAt).slice(2).replace(/-/g, '');
    const sameDay = db.receipts.filter((item) => item.code.startsWith(`PN${stamp}`)).length;
    const created: StockReceipt = {
      id: createId('rcp'),
      code: `PN${stamp}-${String(sameDay + 1).padStart(2, '0')}`,
      supplier: input.supplier.trim(),
      receivedAt: receivedAt.toISOString(),
      createdBy: admin.fullName,
      note: input.note?.trim() || undefined,
      items,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalCost: items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
    };
    db.receipts.unshift(created);
    return created;
  });

  return mockDelay(receipt, 500);
}
