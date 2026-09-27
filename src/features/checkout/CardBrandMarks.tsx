import { cn } from '@/utils/cn';

/**
 * Tên các hãng thẻ nhận được, dạng chữ. Khi ký với cổng thanh toán, thay bằng logo chấp
 * nhận thẻ chính thức trong bộ nhận diện cổng gửi cho shop.
 */
export function CardBrandMarks({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {['VISA', 'Mastercard', 'JCB'].map((brand) => (
        <span
          key={brand}
          className="rounded-md bg-white px-1.5 py-0.5 font-display text-[10px] leading-4 font-black tracking-wide text-slate-800"
        >
          {brand}
        </span>
      ))}
    </span>
  );
}
