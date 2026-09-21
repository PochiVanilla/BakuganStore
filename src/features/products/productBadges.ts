import type { Product, ProductBadge } from '@/types';
import { isNewArrival } from '@/services/api/productService';

/** Thứ tự ưu tiên hiển thị nhãn trên thẻ sản phẩm. */
export function getProductBadges(product: Product, now: number = Date.now()): ProductBadge[] {
  const badges: ProductBadge[] = [];
  if (product.stock <= 0) badges.push('OUT_OF_STOCK');
  if (product.isRare) badges.push('RARE');
  if (product.originalPrice && product.originalPrice > product.price) badges.push('SALE');
  if (isNewArrival(product, now)) badges.push('NEW');
  if (product.isBestSeller || product.soldCount >= 150) badges.push('HOT');
  return badges.slice(0, 3);
}
