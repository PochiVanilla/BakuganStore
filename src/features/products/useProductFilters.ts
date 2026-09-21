import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BAKUGAN_ATTRIBUTES,
  BAKUGAN_SERIES,
  PRODUCT_CONDITIONS,
  PRODUCT_SORTS,
  type BakuganAttribute,
  type BakuganSeries,
  type ProductCondition,
  type ProductQuery,
  type ProductSort,
} from '@/types';
import { PRODUCT_PAGE_SIZE } from '@/constants/catalog';

/** Tên tham số URL bằng tiếng Việt không dấu cho thân thiện SEO. */
const PARAM = {
  keyword: 'q',
  attribute: 'he',
  series: 'series',
  condition: 'tinh-trang',
  minPrice: 'gia-tu',
  maxPrice: 'gia-den',
  minGPower: 'gp-tu',
  maxGPower: 'gp-den',
  inStock: 'con-hang',
  onSale: 'giam-gia',
  sort: 'sort',
  page: 'trang',
} as const;

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  return raw
    .split(',')
    .filter((value): value is T => (allowed as readonly string[]).includes(value));
}

function parseNumber(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export interface ProductFilterState {
  query: ProductQuery;
  attributes: BakuganAttribute[];
  series: BakuganSeries[];
  conditions: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  minGPower?: number;
  maxGPower?: number;
  inStockOnly: boolean;
  onSaleOnly: boolean;
  keyword: string;
  sort: ProductSort;
  page: number;
  activeCount: number;
}

export interface ProductFilterActions {
  toggleAttribute: (value: BakuganAttribute) => void;
  toggleSeries: (value: BakuganSeries) => void;
  toggleCondition: (value: ProductCondition) => void;
  setPriceRange: (min?: number, max?: number) => void;
  setGPowerRange: (min?: number, max?: number) => void;
  setInStockOnly: (value: boolean) => void;
  setOnSaleOnly: (value: boolean) => void;
  setSort: (value: ProductSort) => void;
  setPage: (value: number) => void;
  setKeyword: (value: string) => void;
  resetFilters: () => void;
}

/** Bộ lọc được lưu trên URL — người dùng chia sẻ link là giữ nguyên bộ lọc. */
export function useProductFilters(): ProductFilterState & ProductFilterActions {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<ProductFilterState>(() => {
    const attributes = parseList(searchParams.get(PARAM.attribute), BAKUGAN_ATTRIBUTES);
    const series = parseList(searchParams.get(PARAM.series), BAKUGAN_SERIES);
    const conditions = parseList(searchParams.get(PARAM.condition), PRODUCT_CONDITIONS);
    const minPrice = parseNumber(searchParams.get(PARAM.minPrice));
    const maxPrice = parseNumber(searchParams.get(PARAM.maxPrice));
    const minGPower = parseNumber(searchParams.get(PARAM.minGPower));
    const maxGPower = parseNumber(searchParams.get(PARAM.maxGPower));
    const inStockOnly = searchParams.get(PARAM.inStock) === '1';
    const onSaleOnly = searchParams.get(PARAM.onSale) === '1';
    const keyword = searchParams.get(PARAM.keyword) ?? '';
    const rawSort = searchParams.get(PARAM.sort);
    const sort: ProductSort = PRODUCT_SORTS.includes(rawSort as ProductSort)
      ? (rawSort as ProductSort)
      : 'newest';
    const page = Math.max(1, parseNumber(searchParams.get(PARAM.page)) ?? 1);

    const activeCount =
      attributes.length +
      series.length +
      conditions.length +
      (minPrice !== undefined || maxPrice !== undefined ? 1 : 0) +
      (minGPower !== undefined || maxGPower !== undefined ? 1 : 0) +
      (inStockOnly ? 1 : 0) +
      (onSaleOnly ? 1 : 0);

    return {
      query: {
        keyword: keyword || undefined,
        attributes: attributes.length ? attributes : undefined,
        series: series.length ? series : undefined,
        conditions: conditions.length ? conditions : undefined,
        minPrice,
        maxPrice,
        minGPower,
        maxGPower,
        inStockOnly: inStockOnly || undefined,
        onSaleOnly: onSaleOnly || undefined,
        sort,
        page,
        pageSize: PRODUCT_PAGE_SIZE,
      },
      attributes,
      series,
      conditions,
      minPrice,
      maxPrice,
      minGPower,
      maxGPower,
      inStockOnly,
      onSaleOnly,
      keyword,
      sort,
      page,
      activeCount,
    };
  }, [searchParams]);

  /** Mọi thay đổi bộ lọc đều đưa về trang 1 (trừ khi chính nó là đổi trang). */
  const update = useCallback(
    (mutate: (params: URLSearchParams) => void, resetPage = true) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          mutate(next);
          if (resetPage) next.delete(PARAM.page);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggleInList = useCallback(
    (key: string, value: string) => {
      update((params) => {
        const current = (params.get(key) ?? '').split(',').filter(Boolean);
        const next = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value];
        if (next.length) params.set(key, next.join(','));
        else params.delete(key);
      });
    },
    [update],
  );

  const setRange = useCallback(
    (minKey: string, maxKey: string, min?: number, max?: number) => {
      update((params) => {
        if (min === undefined) params.delete(minKey);
        else params.set(minKey, String(min));
        if (max === undefined || max === Number.MAX_SAFE_INTEGER) params.delete(maxKey);
        else params.set(maxKey, String(max));
      });
    },
    [update],
  );

  const setFlag = useCallback(
    (key: string, value: boolean) => {
      update((params) => {
        if (value) params.set(key, '1');
        else params.delete(key);
      });
    },
    [update],
  );

  return {
    ...state,
    toggleAttribute: (value) => toggleInList(PARAM.attribute, value),
    toggleSeries: (value) => toggleInList(PARAM.series, value),
    toggleCondition: (value) => toggleInList(PARAM.condition, value),
    setPriceRange: (min, max) => setRange(PARAM.minPrice, PARAM.maxPrice, min, max),
    setGPowerRange: (min, max) => setRange(PARAM.minGPower, PARAM.maxGPower, min, max),
    setInStockOnly: (value) => setFlag(PARAM.inStock, value),
    setOnSaleOnly: (value) => setFlag(PARAM.onSale, value),
    setSort: (value) =>
      update((params) => {
        if (value === 'newest') params.delete(PARAM.sort);
        else params.set(PARAM.sort, value);
      }),
    setPage: (value) =>
      update((params) => {
        if (value <= 1) params.delete(PARAM.page);
        else params.set(PARAM.page, String(value));
      }, false),
    setKeyword: (value) =>
      update((params) => {
        if (value) params.set(PARAM.keyword, value);
        else params.delete(PARAM.keyword);
      }),
    resetFilters: () =>
      setSearchParams(
        (previous) => {
          const keyword = previous.get(PARAM.keyword);
          const next = new URLSearchParams();
          if (keyword) next.set(PARAM.keyword, keyword);
          return next;
        },
        { replace: true },
      ),
  };
}
