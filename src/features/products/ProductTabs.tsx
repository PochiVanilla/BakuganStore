import { useState } from 'react';
import type { Product, Review } from '@/types';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Rating } from '@/components/ui';

type TabKey = 'description' | 'specs' | 'reviews';

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'description', label: 'Mô tả' },
  { key: 'specs', label: 'Thông số' },
  { key: 'reviews', label: 'Đánh giá' },
];

export function ProductTabs({ product, reviews }: { product: Product; reviews: Review[] }) {
  const [active, setActive] = useState<TabKey>('description');

  return (
    <section className="mt-12">
      <div className="flex gap-1 overflow-x-auto border-b border-white/8" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => setActive(tab.key)}
            className={cn(
              'relative px-5 py-3 font-display text-sm font-bold whitespace-nowrap transition-colors',
              active === tab.key
                ? 'text-accent-cyan after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-accent-cyan after:to-accent-pink'
                : 'text-text-muted hover:text-text',
            )}
          >
            {tab.label}
            {tab.key === 'reviews' && ` (${reviews.length})`}
          </button>
        ))}
      </div>

      <div className="rounded-b-2xl border border-t-0 border-white/8 bg-surface/60 p-6">
        {active === 'description' && (
          <div id="panel-description" role="tabpanel" aria-labelledby="tab-description">
            {product.description.split('\n\n').map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="mb-4 text-sm leading-relaxed text-text-muted last:mb-0"
              >
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {active === 'specs' && (
          <div id="panel-specs" role="tabpanel" aria-labelledby="tab-specs">
            <dl className="divide-y divide-white/6">
              {product.specs.map((spec) => (
                <div key={spec.label} className="flex flex-wrap gap-2 py-3 first:pt-0 last:pb-0">
                  <dt className="w-48 shrink-0 text-sm text-text-muted">{spec.label}</dt>
                  <dd className="text-sm font-medium text-text">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {active === 'reviews' && (
          <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews">
            <div className="mb-6 flex flex-wrap items-center gap-6 rounded-xl border border-white/8 bg-surface-2/60 p-5">
              <div className="text-center">
                <p className="font-display text-4xl font-extrabold text-gold">
                  {product.rating.toFixed(1)}
                </p>
                <Rating value={product.rating} size={14} className="mt-1.5 justify-center" />
                <p className="mt-1 text-xs text-text-muted">{product.reviewCount} đánh giá</p>
              </div>
              <p className="min-w-48 flex-1 text-sm leading-relaxed text-text-muted">
                Đánh giá được thu thập từ khách đã mua hàng tại TD Bakugan. Shop không xoá đánh giá
                tiêu cực, chỉ ẩn bình luận vi phạm thuần phong mỹ tục.
              </p>
            </div>

            {reviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                Sản phẩm này chưa có đánh giá chi tiết.
              </p>
            ) : (
              <ul className="divide-y divide-white/6">
                {reviews.map((review) => (
                  <li key={review.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-semibold text-text">{review.authorName}</span>
                      {review.verifiedPurchase && (
                        <span className="rounded-md border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                          ĐÃ MUA HÀNG
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <Rating value={review.rating} size={13} className="mt-2" />
                    <p className="mt-2 font-medium text-text">{review.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">{review.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
