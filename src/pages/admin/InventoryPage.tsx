import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boxes, Download, Eye, EyeOff, Minus, PackagePlus, Pencil, Plus } from 'lucide-react';
import type { BakuganAttribute, Product, StockLevel } from '@/types';
import { BAKUGAN_ATTRIBUTES } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import { ATTRIBUTE_META, CONDITION_LABELS, SERIES_META } from '@/constants/catalog';
import {
  adjustStock,
  listInventory,
  setProductHidden,
  type InventoryQuery,
} from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatNumber } from '@/utils/format';
import { downloadCsv } from '@/utils/csv';
import { cn } from '@/utils/cn';
import { AttributeBadge, AttributeIcon, Button, EmptyState, Seo, Skeleton } from '@/components/ui';
import {
  AdminPageHeader,
  CompactSelect,
  ErrorBox,
  FilterTabs,
  Panel,
  SearchField,
  StatCard,
  TableShell,
  td,
  th,
} from '@/features/admin/adminUi';
import { BarList } from '@/features/admin/charts';
import { ProductFormModal } from '@/features/admin/ProductFormModal';

type LevelFilter = StockLevel | 'hidden' | 'all';
const LEVELS: readonly LevelFilter[] = ['all', 'low', 'out', 'in-stock', 'hidden'];
const LEVEL_LABELS: Record<LevelFilter, string> = {
  all: 'Tất cả',
  low: 'Sắp hết',
  out: 'Hết hàng',
  'in-stock': 'Đủ hàng',
  hidden: 'Đang ẩn',
};

function isLevel(value: string | null): value is LevelFilter {
  return LEVELS.includes(value as LevelFilter);
}

const ATTRIBUTE_OPTIONS: ReadonlyArray<{ value: BakuganAttribute | 'all'; label: string }> = [
  { value: 'all', label: 'Mọi hệ' },
  ...BAKUGAN_ATTRIBUTES.map((value) => ({ value, label: ATTRIBUTE_META[value].label })),
];

const SORT_OPTIONS: ReadonlyArray<{ value: NonNullable<InventoryQuery['sort']>; label: string }> = [
  { value: 'stock-asc', label: 'Tồn kho tăng dần' },
  { value: 'stock-desc', label: 'Tồn kho giảm dần' },
  { value: 'sold', label: 'Bán chạy nhất' },
  { value: 'name', label: 'Tên A → Z' },
];

const LEVEL_STYLES: Record<StockLevel, string> = {
  'in-stock': 'text-success',
  low: 'text-warning',
  out: 'text-danger',
};

export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const rawLevel = params.get('level');
  const level: LevelFilter = isLevel(rawLevel) ? rawLevel : 'all';
  const [keyword, setKeyword] = useState('');
  const [attribute, setAttribute] = useState<BakuganAttribute | 'all'>('all');
  const [sort, setSort] = useState<NonNullable<InventoryQuery['sort']>>('stock-asc');
  const [editing, setEditing] = useState<{ product?: Product; key: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const debouncedKeyword = useDebouncedValue(keyword, 250);
  const revision = useLiveRevision();

  const { data, isLoading, error, reload } = useAsync(
    () => listInventory({ keyword: debouncedKeyword, attribute, level, sort }),
    [debouncedKeyword, attribute, level, sort, revision],
    { keepPreviousData: true },
  );

  const setLevel = (value: LevelFilter): void => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('level');
    else next.set('level', value);
    setParams(next, { replace: true });
  };

  const runAction = async (productId: string, action: () => Promise<unknown>): Promise<void> => {
    setBusyId(productId);
    try {
      await action();
    } catch (actionError) {
      toast.error('Không cập nhật được', getApiErrorMessage(actionError));
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = (): void => {
    if (!data) return;
    downloadCsv(
      `ton-kho-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Mã',
        'Tên sản phẩm',
        'Hệ',
        'Dòng',
        'Tình trạng',
        'Giá bán',
        'Giá vốn TB',
        'Tồn kho',
        'Đã bán',
        'Trạng thái',
      ],
      data.rows.map(({ product, level: rowLevel, averageCost }) => [
        product.id,
        product.name,
        ATTRIBUTE_META[product.attribute].label,
        SERIES_META[product.series].label,
        CONDITION_LABELS[product.condition],
        product.price,
        averageCost ?? '',
        product.stock,
        product.soldCount,
        product.isHidden ? 'Đang ẩn' : LEVEL_LABELS[rowLevel],
      ]),
    );
  };

  const summary = data?.summary;

  return (
    <>
      <Seo
        title="Kho hàng"
        description="Quản lý hàng hoá và tồn kho"
        path={ADMIN_ROUTES.inventory}
        noIndex
      />
      <AdminPageHeader
        title="Kho hàng"
        description="Số lượng Bakugan theo từng mẫu và từng hệ. Hàng mới về hãy lập phiếu nhập để có báo cáo giá vốn."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={!data}
              leftIcon={<Download size={15} aria-hidden="true" />}
              onClick={exportCsv}
            >
              Xuất CSV
            </Button>
            <Link
              to={ADMIN_ROUTES.receipts}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-accent-cyan/50 bg-accent-cyan/5 px-3.5 text-sm font-semibold text-accent-cyan hover:bg-accent-cyan/15"
            >
              <PackagePlus size={15} aria-hidden="true" />
              Lập phiếu nhập
            </Link>
            <Button
              size="sm"
              leftIcon={<Plus size={15} aria-hidden="true" />}
              onClick={() => setEditing({ key: `new-${Date.now()}` })}
            >
              Thêm sản phẩm
            </Button>
          </>
        }
      />

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 xl:col-span-2">
          {summary ? (
            <>
              <StatCard
                label="Bakugan trong kho"
                value={formatNumber(summary.unitCount)}
                icon={<Boxes size={16} />}
                hint={`${summary.skuCount} mẫu khác nhau`}
              />
              <StatCard label="Giá trị tồn (giá bán)" value={formatCurrency(summary.retailValue)} />
              <StatCard
                label="Sắp hết hàng"
                value={summary.lowCount}
                tone={summary.lowCount > 0 ? 'warning' : 'default'}
                hint={`Còn từ ${summary.threshold} con trở xuống`}
              />
              <StatCard
                label="Hết hàng"
                value={summary.outCount}
                tone={summary.outCount > 0 ? 'danger' : 'default'}
                hint={`${summary.hiddenCount} mẫu đang ẩn khỏi cửa hàng`}
              />
            </>
          ) : (
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[106px] rounded-2xl" />
            ))
          )}
        </div>
        <Panel title="Số lượng theo hệ" description="Tổng số con đang có trong kho">
          {summary ? (
            <BarList
              caption="Số Bakugan trong kho theo hệ"
              data={BAKUGAN_ATTRIBUTES.map((value) => ({
                key: value,
                textLabel: ATTRIBUTE_META[value].label,
                label: (
                  <span className="flex items-center gap-1.5">
                    <AttributeIcon attribute={value} size={14} />
                    {ATTRIBUTE_META[value].label}
                  </span>
                ),
                value: summary.unitsByAttribute[value],
                display: `${summary.unitsByAttribute[value]} con`,
              }))}
            />
          ) : (
            <Skeleton className="h-44 w-full" />
          )}
        </Panel>
      </div>

      <div className="mt-6 mb-4 flex flex-col gap-3">
        <FilterTabs
          label="Lọc theo tồn kho"
          value={level}
          onChange={setLevel}
          tabs={LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }))}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchField
            label="Tìm sản phẩm"
            value={keyword}
            onChange={setKeyword}
            placeholder="Tên hoặc mã sản phẩm…"
            className="flex-1"
          />
          <CompactSelect
            label="Lọc theo hệ"
            value={attribute}
            onChange={setAttribute}
            options={ATTRIBUTE_OPTIONS}
            className="sm:w-40"
          />
          <CompactSelect
            label="Sắp xếp"
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            className="sm:w-48"
          />
        </div>
      </div>

      <div
        className={cn(
          'rounded-2xl border border-white/8 bg-surface/80',
          isLoading && data && 'opacity-60 transition-opacity',
        )}
      >
        {!data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Boxes size={26} aria-hidden="true" />}
              title="Không có sản phẩm nào khớp bộ lọc"
            />
          </div>
        ) : (
          <TableShell className="rounded-2xl">
            <thead>
              <tr>
                <th className={th}>Sản phẩm</th>
                <th className={th}>Hệ</th>
                <th className={cn(th, 'text-right')}>Giá bán</th>
                <th className={cn(th, 'text-right')}>Giá vốn TB</th>
                <th className={cn(th, 'text-center')}>Tồn kho</th>
                <th className={cn(th, 'text-right')}>Đã bán</th>
                <th className={th}>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(({ product, level: rowLevel, averageCost }) => {
                const busy = busyId === product.id;
                return (
                  <tr
                    key={product.id}
                    className={cn('transition hover:bg-white/3', product.isHidden && 'opacity-60')}
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <img
                          src={product.images[0]}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="max-w-64 truncate font-medium">{product.name}</p>
                          <p className="text-xs text-text-muted">
                            {CONDITION_LABELS[product.condition]} · {product.gPower}G
                            {product.isHidden && (
                              <span className="ml-1.5 text-warning">· Đang ẩn</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <AttributeBadge attribute={product.attribute} size="sm" />
                    </td>
                    <td className={cn(td, 'text-right tabular-nums')}>
                      {formatCurrency(product.price)}
                      {product.originalPrice && (
                        <p className="text-xs text-text-muted line-through">
                          {formatCurrency(product.originalPrice)}
                        </p>
                      )}
                    </td>
                    <td className={cn(td, 'text-right text-text-muted tabular-nums')}>
                      {averageCost ? formatCurrency(averageCost) : '—'}
                    </td>
                    <td className={td}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={busy || product.stock === 0}
                          onClick={() =>
                            void runAction(product.id, () => adjustStock(product.id, -1))
                          }
                          className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-text disabled:opacity-40"
                          aria-label={`Bớt 1 ${product.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span
                          className={cn(
                            'w-10 text-center font-semibold tabular-nums',
                            LEVEL_STYLES[rowLevel],
                          )}
                        >
                          {product.stock}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(product.id, () => adjustStock(product.id, 1))
                          }
                          className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-text disabled:opacity-40"
                          aria-label={`Thêm 1 ${product.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className={cn('text-center text-[11px]', LEVEL_STYLES[rowLevel])}>
                        {LEVEL_LABELS[rowLevel]}
                      </p>
                    </td>
                    <td className={cn(td, 'text-right text-text-muted tabular-nums')}>
                      {formatNumber(product.soldCount)}
                    </td>
                    <td className={cn(td, 'text-right')}>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({ product, key: `${product.id}-${Date.now()}` })
                          }
                          className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-accent-cyan"
                          aria-label={`Sửa ${product.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(product.id, async () => {
                              await setProductHidden(product.id, !product.isHidden);
                              toast.info(
                                product.isHidden
                                  ? 'Đã hiện lại trên cửa hàng'
                                  : 'Đã ẩn khỏi cửa hàng',
                                product.name,
                              );
                            })
                          }
                          className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-text disabled:opacity-40"
                          aria-label={
                            product.isHidden ? `Hiện ${product.name}` : `Ẩn ${product.name}`
                          }
                        >
                          {product.isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </div>

      {editing && (
        <ProductFormModal
          key={editing.key}
          isOpen
          onClose={() => setEditing(null)}
          product={editing.product}
        />
      )}
    </>
  );
}
