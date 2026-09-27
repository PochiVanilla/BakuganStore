import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCheck,
  ExternalLink,
  ImagePlus,
  PackageOpen,
  Pencil,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { AdminFeed, FeedStatusFilter } from '@/types';
import { FEED_STATUS_FILTERS } from '@/types';
import { ADMIN_ROUTES, ROUTES } from '@/constants/routes';
import { FEED_FILTER_LABELS } from '@/constants/catalog';
import { deleteFeed, listAdminFeeds } from '@/services/api/admin';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/utils/format';
import { normalizeSearch } from '@/utils/slugify';
import { cn } from '@/utils/cn';
import { Button, ButtonLink, Modal, RefImage, Skeleton, StatusBadge } from '@/components/ui';
import {
  AdminPageHeader,
  ErrorBox,
  FilterTabs,
  Panel,
  SearchField,
} from '@/features/admin/adminUi';
import { FeedProgress } from '@/features/feed/FeedProgress';
import { FEED_BADGE } from '@/features/feed/feedUi';

function DeleteFeedModal({
  feed,
  onClose,
  onDeleted,
}: {
  feed: AdminFeed | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const leftovers = feed?.items.filter((item) => item.status === 'available') ?? [];

  const confirm = async (): Promise<void> => {
    if (!feed) return;
    setIsDeleting(true);
    try {
      const result = await deleteFeed(feed.id);
      toast.success(
        `Đã gỡ feed #${feed.number} khỏi web`,
        result.leftoverCount > 0
          ? `${result.leftoverCount} con chưa bán đã chuyển vào hàng tồn.`
          : 'Feed đã bán hết, không còn hàng tồn.',
      );
      onDeleted();
    } catch (error) {
      toast.error('Chưa xoá được feed', getApiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(feed)}
      onClose={onClose}
      title={feed ? `Gỡ feed #${feed.number} khỏi web?` : ''}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="danger" isLoading={isDeleting} onClick={() => void confirm()}>
            Gỡ feed
          </Button>
        </div>
      }
    >
      {feed && (
        <div className="space-y-3 text-sm text-text-muted">
          <p>
            <span className="font-semibold text-text">{feed.title}</span> — đã bán {feed.soldCount}/
            {feed.itemCount} con.
          </p>
          {leftovers.length > 0 ? (
            <div className="rounded-xl border border-warning/35 bg-warning/8 p-3">
              <p className="font-semibold text-warning">
                Còn {leftovers.length} con chưa bán — sẽ chuyển vào hàng tồn để đăng lại:
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {leftovers.map((item) => (
                  <li key={item.id}>
                    <span className="font-mono text-accent-cyan">{item.code}</span> {item.name} ·{' '}
                    {formatCurrency(item.price)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border border-success/35 bg-success/8 p-3 text-success">
              Feed đã bán hết, không còn hàng tồn.
            </p>
          )}
          <p className="text-xs">
            Lịch sử những con đã bán và đơn hàng vẫn được giữ trong mục Từng con Bakugan.
          </p>
        </div>
      )}
    </Modal>
  );
}

export default function FeedsAdminPage() {
  const revision = useLiveRevision();
  const { data, isLoading, error, reload } = useAsync(() => listAdminFeeds(), [revision], {
    keepPreviousData: true,
  });
  const [status, setStatus] = useState<FeedStatusFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [toDelete, setToDelete] = useState<AdminFeed | null>(null);

  const needle = normalizeSearch(keyword);
  const feeds = (data?.feeds ?? [])
    .filter((feed) => status === 'all' || feed.status === status)
    .filter((feed) =>
      needle
        ? normalizeSearch(
            `${feed.title} ${feed.number} ${feed.items.map((item) => `${item.code} ${item.name}`).join(' ')}`,
          ).includes(needle)
        : true,
    );
  const soldOut = (data?.feeds ?? []).filter((feed) => feed.status === 'sold-out');
  const count = data?.feeds.length ?? 0;
  const limit = data?.limit ?? 30;
  const isFull = count >= limit;
  const oldest = data?.feeds[data.feeds.length - 1];

  return (
    <>
      <AdminPageHeader
        title="Feed bán"
        description="Mỗi feed là một lô Bakugan: ảnh chụp cả lô và từng con có tên + mã riêng. Web giữ tối đa 30 feed."
        actions={
          <ButtonLink to={ADMIN_ROUTES.newFeed} leftIcon={<ImagePlus size={16} />}>
            Đăng feed mới
          </ButtonLink>
        }
      />

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1" bodyClassName="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-text">Feed trên web</p>
            <p
              className={cn(
                'font-display text-2xl font-black tabular-nums',
                isFull ? 'text-warning' : 'text-text',
              )}
            >
              {count}/{limit}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className={cn(
                'h-full rounded-full',
                isFull ? 'bg-warning' : 'bg-gradient-to-r from-accent-cyan to-primary',
              )}
              style={{ width: `${Math.min(100, (count / limit) * 100)}%` }}
            />
          </div>
          {isFull ? (
            <p className="flex items-start gap-2 text-xs text-warning">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Đã đủ {limit} feed. Đăng feed mới sẽ phải xác nhận xoá feed cũ nhất
              {oldest ? ` (#${oldest.number})` : ''}.
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              Còn chỗ cho {limit - count} feed nữa trước khi phải gỡ feed cũ.
            </p>
          )}
          {(data?.leftoverCount ?? 0) > 0 && (
            <Link
              to={`${ADMIN_ROUTES.items}?trang-thai=leftover`}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-2/60 px-3 py-2 text-xs text-text-muted transition hover:border-accent-cyan/40 hover:text-accent-cyan"
            >
              <PackageOpen size={15} aria-hidden="true" />
              {data?.leftoverCount} con hàng tồn chờ đăng lại
            </Link>
          )}
        </Panel>

        {/* Cách giám sát 1: feed đã bán hết toàn bộ */}
        <Panel
          className="lg:col-span-2"
          title={
            <span className="inline-flex items-center gap-2">
              <CheckCheck size={16} className="text-success" aria-hidden="true" />
              Feed đã bán hết ({soldOut.length})
            </span>
          }
          description="Toàn bộ Bakugan trong feed đã có người mua. Có thể gỡ khỏi web để nhường chỗ cho feed mới."
          bodyClassName="p-0"
        >
          {soldOut.length === 0 ? (
            <p className="px-5 py-6 text-sm text-text-muted">Chưa có feed nào bán hết.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-white/6 overflow-y-auto">
              {soldOut.map((feed) => (
                <li key={feed.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">
                      #{feed.number} · {feed.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      {feed.itemCount} con · thu {formatCurrency(feed.revenue)}
                      {feed.soldOutAt && ` · bán hết ${formatRelativeTime(feed.soldOutAt)}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(feed)}>
                    Gỡ khỏi web
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-white/6 p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            label="Lọc feed theo trạng thái"
            value={status}
            onChange={setStatus}
            tabs={FEED_STATUS_FILTERS.map((value) => ({
              value,
              label: FEED_FILTER_LABELS[value],
              count: data?.counts[value],
            }))}
          />
          <SearchField
            value={keyword}
            onChange={setKeyword}
            label="Tìm feed"
            placeholder="Số feed, tiêu đề, mã / tên Bakugan"
            className="lg:w-80"
          />
        </div>

        {isLoading && !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : feeds.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">
            Không có feed nào khớp bộ lọc.
          </p>
        ) : (
          <ul className="divide-y divide-white/6">
            {feeds.map((feed) => {
              const profit = feed.lotCost !== undefined ? feed.revenue - feed.lotCost : undefined;
              return (
                <li key={feed.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <Link
                    to={ADMIN_ROUTES.editFeed(feed.id)}
                    className="relative block shrink-0 overflow-hidden rounded-xl sm:w-44"
                  >
                    <RefImage
                      src={feed.images[0]}
                      alt={`Ảnh feed #${feed.number}`}
                      width={320}
                      height={180}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge type={FEED_BADGE[feed.status]} />
                      <span className="font-display text-xs font-bold text-text-muted">
                        #{feed.number}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-semibold text-text">{feed.title}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Đăng {formatDateTime(feed.publishedAt)}
                      {feed.status === 'upcoming' && ` · mở bán ${formatDateTime(feed.opensAt)}`}
                    </p>
                    <FeedProgress
                      sold={feed.soldCount}
                      total={feed.itemCount}
                      className="mt-2 max-w-md"
                    />
                  </div>
                  <dl className="grid shrink-0 grid-cols-3 gap-3 text-xs sm:w-72 sm:grid-cols-1 sm:text-right">
                    <div>
                      <dt className="text-text-muted">Đã thu</dt>
                      <dd className="font-semibold text-text">{formatCurrency(feed.revenue)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Giá nhập lô</dt>
                      <dd className="text-text">
                        {feed.lotCost !== undefined ? formatCurrency(feed.lotCost) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Lãi tạm tính</dt>
                      <dd
                        className={cn(
                          'font-semibold',
                          profit === undefined
                            ? 'text-text-muted'
                            : profit >= 0
                              ? 'text-success'
                              : 'text-danger',
                        )}
                      >
                        {profit !== undefined ? formatCurrency(profit) : '—'}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex shrink-0 gap-1.5 sm:flex-col">
                    <ButtonLink
                      to={ADMIN_ROUTES.editFeed(feed.id)}
                      size="sm"
                      variant="secondary"
                      leftIcon={<Pencil size={14} />}
                    >
                      Sửa
                    </ButtonLink>
                    <ButtonLink
                      to={ROUTES.feedDetail(feed.number)}
                      target="_blank"
                      size="sm"
                      variant="ghost"
                      leftIcon={<ExternalLink size={14} />}
                    >
                      Xem
                    </ButtonLink>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      leftIcon={<Trash2 size={14} />}
                      onClick={() => setToDelete(feed)}
                    >
                      Gỡ
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <DeleteFeedModal
        feed={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={() => {
          setToDelete(null);
          reload();
        }}
      />
    </>
  );
}
