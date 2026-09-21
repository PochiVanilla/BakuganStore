import { cn } from '@/utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-lg', className)}
      aria-hidden="true"
      data-testid="skeleton"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-surface/80 p-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="mt-4 space-y-2.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function AuctionCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-surface/80 p-4">
      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function BlogCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-surface/80">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
