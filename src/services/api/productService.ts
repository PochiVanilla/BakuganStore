import type { ApiResponse, Paginated, Product, ProductQuery, Review } from '@/types';
import { MOCK_REVIEWS } from '@/mocks';
import { listVisibleProducts } from '@/mocks/db';
import { normalizeSearch } from '@/utils/slugify';
import { PRODUCT_PAGE_SIZE } from '@/constants/catalog';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** Hàng đang bày bán: dữ liệu gốc cộng chỉnh sửa của admin, bỏ các mẫu bị ẩn. */
const catalog = (): Product[] => listVisibleProducts();

export function isNewArrival(product: Product, now: number = Date.now()): boolean {
  return now - new Date(product.createdAt).getTime() <= THIRTY_DAYS;
}

function matchesQuery(product: Product, query: ProductQuery): boolean {
  const {
    keyword,
    attributes,
    series,
    conditions,
    minPrice,
    maxPrice,
    minGPower,
    maxGPower,
    inStockOnly,
    onSaleOnly,
  } = query;

  if (keyword) {
    const needle = normalizeSearch(keyword);
    const haystack = normalizeSearch(
      `${product.name} ${product.shortDescription} ${product.tags.join(' ')}`,
    );
    if (!haystack.includes(needle)) return false;
  }
  if (attributes?.length && !attributes.includes(product.attribute)) return false;
  if (series?.length && !series.includes(product.series)) return false;
  if (conditions?.length && !conditions.includes(product.condition)) return false;
  if (minPrice !== undefined && product.price < minPrice) return false;
  if (maxPrice !== undefined && product.price > maxPrice) return false;
  if (minGPower !== undefined && product.gPower < minGPower) return false;
  if (maxGPower !== undefined && product.gPower > maxGPower) return false;
  if (inStockOnly && product.stock <= 0) return false;
  if (onSaleOnly && !product.originalPrice) return false;
  return true;
}

function sortProducts(items: Product[], sort: ProductQuery['sort']): Product[] {
  const sorted = [...items];
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'best-selling':
      return sorted.sort((a, b) => b.soldCount - a.soldCount);
    case 'g-power-desc':
      return sorted.sort((a, b) => b.gPower - a.gPower);
    case 'newest':
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

export async function fetchProducts(query: ProductQuery = {}): Promise<Paginated<Product>> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Paginated<Product>>>('/products', {
      params: query,
    });
    return data.data;
  }

  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? PRODUCT_PAGE_SIZE;
  const filtered = sortProducts(
    catalog().filter((product) => matchesQuery(product, query)),
    query.sort,
  );
  const total = filtered.length;

  return mockDelay({
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function fetchProductBySlug(slug: string): Promise<Product> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product>>(`/products/${slug}`);
    return data.data;
  }
  const product = catalog().find((item) => item.slug === slug);
  if (!product) throw new MockApiError('Không tìm thấy sản phẩm này.', 404);
  return mockDelay(product);
}

export async function fetchFeaturedProducts(limit = 8): Promise<Product[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/products/featured', {
      params: { limit },
    });
    return data.data;
  }
  return mockDelay(
    catalog()
      .filter((product) => product.isFeatured)
      .slice(0, limit),
    260,
  );
}

export async function fetchBestSellers(limit = 8): Promise<Product[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/products/best-sellers', {
      params: { limit },
    });
    return data.data;
  }
  return mockDelay([...catalog()].sort((a, b) => b.soldCount - a.soldCount).slice(0, limit), 260);
}

export async function fetchNewArrivals(limit = 12): Promise<Product[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/products/new-arrivals', {
      params: { limit },
    });
    return data.data;
  }
  const now = Date.now();
  return mockDelay(
    catalog()
      .filter((product) => isNewArrival(product, now))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit),
    260,
  );
}

export async function fetchRelatedProducts(slug: string, limit = 4): Promise<Product[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product[]>>(`/products/${slug}/related`, {
      params: { limit },
    });
    return data.data;
  }
  const current = catalog().find((item) => item.slug === slug);
  if (!current) return mockDelay([], 200);
  const scored = catalog()
    .filter((item) => item.id !== current.id)
    .map((item) => ({
      item,
      score:
        (item.attribute === current.attribute ? 2 : 0) + (item.series === current.series ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.item.soldCount - a.item.soldCount)
    .slice(0, limit)
    .map((entry) => entry.item);
  return mockDelay(scored, 220);
}

export async function fetchProductReviews(productId: string): Promise<Review[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Review[]>>(`/products/${productId}/reviews`);
    return data.data;
  }
  return mockDelay(
    MOCK_REVIEWS.filter((review) => review.productId === productId),
    200,
  );
}

/** Gợi ý tìm kiếm nhanh cho ô search ở header. */
export async function searchSuggestions(keyword: string, limit = 6): Promise<Product[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/products/suggestions', {
      params: { keyword, limit },
    });
    return data.data;
  }
  const needle = normalizeSearch(keyword);
  if (needle.length < 2) return mockDelay([], 80);
  return mockDelay(
    catalog()
      .filter((product) =>
        normalizeSearch(`${product.name} ${product.tags.join(' ')}`).includes(needle),
      )
      .slice(0, limit),
    140,
  );
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Product[]>>('/products/by-ids', {
      params: { ids: ids.join(',') },
    });
    return data.data;
  }
  return mockDelay(
    catalog().filter((product) => ids.includes(product.id)),
    200,
  );
}

/** Khoảng giá thực tế của kho hàng — dùng cho thanh lọc giá. */
export function getPriceBounds(): { min: number; max: number } {
  const prices = catalog().map((product) => product.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
