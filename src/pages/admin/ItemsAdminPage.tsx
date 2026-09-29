import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, CircleCheck, Film, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { AdminItem, BakuganAttribute, BakuganSeries } from '@/types';
import { BAKUGAN_ATTRIBUTES, BAKUGAN_SERIES } from '@/types';
import { ADMIN_ROUTES, ROUTES } from '@/constants/routes';
import { ATTRIBUTE_META, SERIES_META } from '@/constants/catalog';
import {
  deleteItem,
  listAdminItems,
  markItemAvailable,
  markItemSold,
  updateItem,
  type AdminItemFilter,
} from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { AttributeBadge, Button, Modal, Pagination, Skeleton } from '@/components/ui';
import {
  AdminPageHeader,
  CompactSelect,
  ErrorBox,
  FilterTabs,
  Panel,
  SearchField,
  TableShell,
  td,
  th,
} from '@/features/admin/adminUi';
import { ItemMediaEditor, type ItemMedia } from '@/features/admin/ItemMediaEditor';
import { useUploader } from '@/features/admin/useUploader';

const FILTERS: ReadonlyArray<{ value: AdminItemFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'available', label: 'Đang bán' },
  { value: 'sold', label: 'Đã bán' },
  { value: 'leftover', label: 'Hàng tồn' },
];

const SOLD_WINDOWS = [
  { value: '0', label: 'Mọi lúc' },
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
] as const;

type SoldWindow = (typeof SOLD_WINDOWS)[number]['value'];

function isFilter(value: string | null): value is AdminItemFilter {
  return FILTERS.some((filter) => filter.value === value);
}

const fieldClass =
  'h-10 w-full rounded-lg border border-white/10 bg-surface-2/80 px-3 text-sm text-text outline-none focus:border-accent-cyan';

function MarkSoldModal({
  item,
  onClose,
  onDone,
}: {
  item: AdminItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [buyer, setBuyer] = useState('');
  const [note, setNote] = useState('Khách chốt qua Messenger');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!item) return;
    setBusy(true);
    try {
      await markItemSold(item.id, { buyerName: buyer, note });
      toast.success(`${item.code} đã chuyển sang SOLD`, item.name);
      setBuyer('');
      onDone();
    } catch (error) {
      toast.error('Chưa đánh dấu được', getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title={item ? `Đánh dấu ${item.code} đã bán` : ''}
      description="Dùng khi khách chốt ngoài web (Messenger, livestream, tại shop). Con này hiện SOLD trên feed ngay."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button isLoading={busy} onClick={() => void submit()}>
            Đánh dấu SOLD
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-text">Người mua (tuỳ chọn)</span>
          <input
            value={buyer}
            onChange={(event) => setBuyer(event.target.value)}
            placeholder="VD: Anh Tùng — Zalo 09…"
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-text">Ghi chú</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={fieldClass}
          />
        </label>
        <p className="text-xs text-text-muted">
          Muốn có đơn hàng đầy đủ (địa chỉ, thanh toán) thì dùng trang Tạo đơn thay cho cách này.
        </p>
      </div>
    </Modal>
  );
}

function EditItemModal({
  item,
  onClose,
  onDone,
}: {
  item: AdminItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title={item ? `Sửa ${item.code}` : ''}
      size="sm"
    >
      {item && <EditItemForm key={item.id} item={item} onDone={onDone} />}
    </Modal>
  );
}

function EditItemForm({ item, onDone }: { item: AdminItem; onDone: () => void }) {
  const [name, setName] = useState(item.name);
  const [code, setCode] = useState(item.code);
  const [price, setPrice] = useState(String(item.price));
  const [attribute, setAttribute] = useState(item.attribute);
  const [series, setSeries] = useState<BakuganSeries | ''>(item.series ?? '');
  const [condition, setCondition] = useState(item.condition ?? '');
  const [media, setMedia] = useState<ItemMedia>({ photos: [...item.images], video: item.video });
  const { upload, isUploading } = useUploader();
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    try {
      await updateItem(item.id, {
        name,
        code,
        price: Number(price),
        attribute,
        series: series || undefined,
        condition,
        photos: media.photos,
        video: media.video,
      });
      toast.success('Đã lưu', code);
      onDone();
    } catch (error) {
      toast.error('Chưa lưu được', getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs text-text-muted">Tên</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Mã</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={cn(fieldClass, 'font-mono uppercase')}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Hệ</span>
          <input
            name="attribute"
            value={attribute}
            onChange={(e) => setAttribute(e.target.value)}
            maxLength={40}
            placeholder="VD: Pyrus"
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-text-muted">Dòng</span>
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value as BakuganSeries | '')}
            className={fieldClass}
          >
            <option value="">Không rõ</option>
            {BAKUGAN_SERIES.map((value) => (
              <option key={value} value={value}>
                {SERIES_META[value].label}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs text-text-muted">
            Giá {item.status === 'sold' && '(đã bán, giữ nguyên)'}
          </span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
            disabled={item.status === 'sold'}
            inputMode="numeric"
            className={cn(fieldClass, 'text-right tabular-nums')}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-text-muted">Tình trạng</span>
        <input
          name="condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          maxLength={160}
          placeholder="VD: Like new, trầy nhẹ ở chân"
          className={fieldClass}
        />
      </label>
      <div>
        <p className="mb-1.5 text-xs text-text-muted">
          Ảnh & video — tối đa 3 ảnh (ảnh chính hiện trên thẻ) và 1 video giới thiệu
        </p>
        <ItemMediaEditor
          media={media}
          onChange={setMedia}
          upload={upload}
          label={name || item.code}
        />
      </div>
      <div className="flex justify-end pt-1">
        <Button isLoading={busy} disabled={isUploading} onClick={() => void submit()}>
          {isUploading ? 'Đang tải file…' : 'Lưu'}
        </Button>
      </div>
    </div>
  );
}

export default function ItemsAdminPage() {
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('trang-thai');
  const status: AdminItemFilter = isFilter(rawStatus) ? rawStatus : 'all';
  const [keyword, setKeyword] = useState('');
  const [attribute, setAttribute] = useState<BakuganAttribute | 'all'>('all');
  const [soldWindow, setSoldWindow] = useState<SoldWindow>('0');
  const [page, setPage] = useState(1);
  const [toSell, setToSell] = useState<AdminItem | null>(null);
  const [toEdit, setToEdit] = useState<AdminItem | null>(null);
  const debounced = useDebouncedValue(keyword, 250);
  const revision = useLiveRevision();

  const { data, isLoading, error, reload } = useAsync(
    () =>
      listAdminItems({
        status,
        keyword: debounced,
        attribute,
        soldWithinDays: Number(soldWindow),
        page,
        pageSize: 20,
      }),
    [status, debounced, attribute, soldWindow, page, revision],
    { keepPreviousData: true },
  );

  const setStatus = (value: AdminItemFilter): void => {
    setPage(1);
    setParams(value === 'all' ? {} : { 'trang-thai': value }, { replace: true });
  };

  const act = async (label: string, task: () => Promise<unknown>): Promise<void> => {
    try {
      await task();
      toast.success(label);
      reload();
    } catch (actionError) {
      toast.error('Chưa làm được', getApiErrorMessage(actionError));
    }
  };

  const rows = data?.page.items ?? [];

  return (
    <>
      <AdminPageHeader
        title="Từng con Bakugan"
        description="Mỗi con là duy nhất, không có số lượng: còn bán hoặc SOLD. Theo dõi con nào đã bán, bán cho ai, qua đơn nào; hàng tồn là con chưa bán của feed đã gỡ."
      />

      {error && <ErrorBox message={error} onRetry={reload} />}

      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-white/6 p-4">
          <FilterTabs
            label="Lọc theo trạng thái"
            value={status}
            onChange={setStatus}
            tabs={FILTERS.map((filter) => ({ ...filter, count: data?.counts[filter.value] }))}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchField
              value={keyword}
              onChange={(value) => {
                setKeyword(value);
                setPage(1);
              }}
              label="Tìm Bakugan"
              placeholder="Mã, tên, feed, người mua, mã đơn…"
              className="sm:flex-1"
            />
            <CompactSelect
              label="Lọc theo hệ"
              value={attribute}
              onChange={(value) => {
                setAttribute(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'Mọi hệ' },
                ...BAKUGAN_ATTRIBUTES.map((value) => ({
                  value,
                  label: ATTRIBUTE_META[value].label,
                })),
              ]}
              className="sm:w-40"
            />
            {status === 'sold' && (
              <CompactSelect
                label="Bán trong khoảng"
                value={soldWindow}
                onChange={(value) => {
                  setSoldWindow(value);
                  setPage(1);
                }}
                options={SOLD_WINDOWS}
                className="sm:w-36"
              />
            )}
          </div>
          {status === 'sold' && data && (
            <p className="text-xs text-text-muted">
              {data.page.total} con đã bán · tổng{' '}
              <span className="font-semibold text-gold">{formatCurrency(data.soldValue)}</span>
            </p>
          )}
        </div>

        {isLoading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">
            Không có con nào khớp bộ lọc.
          </p>
        ) : (
          <TableShell className={cn(isLoading && 'opacity-70')}>
            <thead>
              <tr>
                <th className={th}>Mã</th>
                <th className={th}>Bakugan</th>
                <th className={th}>Feed</th>
                <th className={cn(th, 'text-right')}>Giá</th>
                <th className={th}>Trạng thái</th>
                <th className={th}>Người mua / Đơn</th>
                <th className={cn(th, 'text-right')}>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const isLeftover = item.status === 'available' && !item.feedId;
                return (
                  <tr key={item.id} className="hover:bg-white/3">
                    <td className={cn(td, 'font-mono text-xs font-bold text-accent-cyan')}>
                      {item.feedId ? (
                        <Link
                          to={ROUTES.itemDetail(item.code)}
                          target="_blank"
                          title="Xem trang của con này trên web"
                          className="hover:underline"
                        >
                          {item.code}
                        </Link>
                      ) : (
                        item.code
                      )}
                    </td>
                    <td className={td}>
                      <p className="max-w-56 truncate font-medium">{item.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <AttributeBadge attribute={item.attribute} size="sm" />
                        {item.condition && (
                          <span className="max-w-40 truncate text-[11px] text-text-muted">
                            {item.condition}
                          </span>
                        )}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px]',
                            item.images.length > 0 ? 'text-text-muted' : 'text-warning',
                          )}
                          title={`${item.images.length}/3 ảnh${item.video ? ', có video' : ', chưa có video'}`}
                        >
                          <Camera size={11} aria-hidden="true" />
                          {item.images.length}/3
                          {item.video && <Film size={11} aria-label="có video" />}
                        </span>
                      </div>
                    </td>
                    <td className={cn(td, 'text-xs')}>
                      {item.feedId ? (
                        <Link
                          to={ADMIN_ROUTES.editFeed(item.feedId)}
                          className="text-text hover:text-accent-cyan"
                        >
                          #{item.feedNumber}
                        </Link>
                      ) : (
                        <span className="text-text-muted">
                          {item.feedNumber ? `#${item.feedNumber} (đã gỡ)` : '—'}
                        </span>
                      )}
                    </td>
                    <td className={cn(td, 'text-right font-semibold whitespace-nowrap')}>
                      {formatCurrency(item.price)}
                    </td>
                    <td className={cn(td, 'text-xs whitespace-nowrap')}>
                      {item.status === 'sold' ? (
                        <>
                          <span className="font-bold text-danger">SOLD</span>
                          <span className="block text-text-muted">
                            {item.soldAt && formatDateTime(item.soldAt)}
                          </span>
                        </>
                      ) : isLeftover ? (
                        <span className="font-semibold text-warning">Hàng tồn</span>
                      ) : (
                        <span className="font-semibold text-success">Đang bán</span>
                      )}
                    </td>
                    <td className={cn(td, 'text-xs')}>
                      {item.orderId ? (
                        <Link
                          to={ADMIN_ROUTES.orderDetail(item.orderId)}
                          className="text-accent-cyan hover:underline"
                        >
                          #{item.orderCode}
                          {item.buyerName && (
                            <span className="block text-text-muted">{item.buyerName}</span>
                          )}
                        </Link>
                      ) : item.status === 'sold' ? (
                        <span className="text-text-muted">
                          {item.buyerName ?? 'Bán ngoài web'}
                          {item.soldNote && <span className="block">{item.soldNote}</span>}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className={cn(td, 'text-right')}>
                      <div className="flex justify-end gap-1">
                        {item.status === 'available' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            leftIcon={<CircleCheck size={14} />}
                            onClick={() => setToSell(item)}
                          >
                            Đã bán
                          </Button>
                        )}
                        {item.status === 'sold' && item.soldVia === 'manual' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<RotateCcw size={14} />}
                            onClick={() =>
                              void act(`${item.code} đã mở bán lại`, () =>
                                markItemAvailable(item.id),
                              )
                            }
                          >
                            Bỏ SOLD
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => setToEdit(item)}
                          className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-text"
                          aria-label={`Sửa ${item.code}`}
                        >
                          <Pencil size={15} />
                        </button>
                        {isLeftover && (
                          <button
                            type="button"
                            onClick={() =>
                              void act(`Đã xoá ${item.code}`, () => deleteItem(item.id))
                            }
                            className="rounded-lg p-2 text-text-muted hover:bg-danger/10 hover:text-danger"
                            aria-label={`Xoá ${item.code}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
        {data && (
          <Pagination
            page={data.page.page}
            totalPages={data.page.totalPages}
            onChange={setPage}
            className="border-t border-white/6 py-4"
          />
        )}
      </Panel>

      <MarkSoldModal
        item={toSell}
        onClose={() => setToSell(null)}
        onDone={() => {
          setToSell(null);
          reload();
        }}
      />
      <EditItemModal
        item={toEdit}
        onClose={() => setToEdit(null)}
        onDone={() => {
          setToEdit(null);
          reload();
        }}
      />
    </>
  );
}
