import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { fetchProductsByIds } from '@/services/api/productService';
import { useAsync } from '@/hooks/useAsync';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/uiStore';
import {
  Button,
  ButtonLink,
  Container,
  EmptyState,
  ProductGridSkeleton,
  Seo,
} from '@/components/ui';
import { ProductCard } from '@/features/products/ProductCard';

export default function WishlistPage() {
  const productIds = useWishlistStore((state) => state.productIds);
  const clearWishlist = useWishlistStore((state) => state.clear);
  const addItem = useCartStore((state) => state.addItem);
  const openCartDrawer = useCartStore((state) => state.openDrawer);

  const { data, isLoading } = useAsync(
    () => fetchProductsByIds(productIds),
    [productIds.join(',')],
    { enabled: productIds.length > 0 },
  );

  const products = data ?? [];
  const availableProducts = products.filter((product) => product.stock > 0);

  const handleAddAllToCart = (): void => {
    availableProducts.forEach((product) => addItem(product, 1));
    openCartDrawer();
    toast.success(
      'Đã thêm vào giỏ hàng',
      `${availableProducts.length} sản phẩm còn hàng đã được chuyển vào giỏ.`,
    );
  };

  return (
    <>
      <Seo
        title="Sản phẩm yêu thích"
        description="Danh sách Bakugan bạn đã đánh dấu yêu thích tại TD Bakugan."
        path={ROUTES.wishlist}
        noIndex
      />

      <Container className="py-8 sm:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-text sm:text-4xl">
              Sản phẩm yêu thích
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              {productIds.length > 0
                ? `Bạn đang theo dõi ${productIds.length} sản phẩm.`
                : 'Danh sách yêu thích được lưu ngay trên trình duyệt của bạn.'}
            </p>
          </div>

          {productIds.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="secondary"
                leftIcon={<ShoppingCart size={16} />}
                onClick={handleAddAllToCart}
                disabled={availableProducts.length === 0}
              >
                Thêm tất cả vào giỏ
              </Button>
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
            </div>
          )}
        </header>

        {productIds.length === 0 ? (
          <EmptyState
            icon={<Heart size={26} aria-hidden="true" />}
            title="Chưa có sản phẩm yêu thích"
            description="Bấm biểu tượng trái tim trên sản phẩm bất kỳ để lưu lại và theo dõi giá."
            action={<ButtonLink to={ROUTES.products}>Khám phá sản phẩm</ButtonLink>}
          />
        ) : isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
