import { Container, Skeleton } from '@/components/ui';

/** Skeleton hiển thị trong lúc chunk của route đang tải. */
export function RouteFallback() {
  return (
    <Container className="py-12">
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
