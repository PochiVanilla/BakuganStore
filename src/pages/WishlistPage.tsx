import { Heart, Trash2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { fetchItemsByIds } from '@/services/api/feedService';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast } from '@/store/uiStore';
import { Button, ButtonLink, Container, EmptyState, ItemGridSkeleton, Seo } from '@/components/ui';
import { ItemCard } from '@/features/feed/ItemCard';

export default function WishlistPage() {
  const itemIds = useWishlistStore((state) => state.itemIds);
  const clearWishlist = useWishlistStore((state) => state.clear);
  const revision = useLiveRevision();

  const { data, isLoading } = useAsync(
    () => fetchItemsByIds(itemIds),
    [itemIds.join(','), revision],
    { enabled: itemIds.length > 0, keepPreviousData: true },
  );

  const items = data ?? [];
  const missing = itemIds.length - items.length;
  const available = items.filter((item) => item.status === 'available').length;

  return (
    <>
      <Seo
        title="Bakugan yêu thích"
        description="Những con Bakugan bạn đã đánh dấu yêu thích tại TD Bakugan."
        path={ROUTES.wishlist}
        noIndex
      />

      <Container className="py-8 sm:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">
              Bakugan yêu thích
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              {itemIds.length > 0
                ? `Bạn đang theo dõi ${itemIds.length} con — ${available} con còn bán. Mỗi mã chỉ có một con, chốt sớm kẻo lỡ!`
                : 'Danh sách yêu thích được lưu ngay trên trình duyệt của bạn.'}
            </p>
          </div>

          {itemIds.length > 0 && (
            <Button
              variant="danger"
              leftIcon={<Trash2 size={16} />}
              onClick={() => {
                clearWishlist();
                toast.info('Đã xoá danh sách yêu thích');
              }}
            >
              Xoá tất cả
            </Button>
          )}
        </header>

        {itemIds.length === 0 ? (
          <EmptyState
            icon={<Heart size={26} aria-hidden="true" />}
            title="Chưa có con nào"
            description="Bấm trái tim trên con Bakugan bất kỳ trong feed để lưu lại theo dõi."
            action={<ButtonLink to={ROUTES.feeds}>Xem feed đang bán</ButtonLink>}
          />
        ) : isLoading && !data ? (
          <ItemGridSkeleton count={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} showFeed />
              ))}
            </div>
            {missing > 0 && (
              <p className="mt-6 text-center text-xs text-text-muted">
                {missing} con không còn trên web (feed đã được shop gỡ).
              </p>
            )}
          </>
        )}
      </Container>
    </>
  );
}
