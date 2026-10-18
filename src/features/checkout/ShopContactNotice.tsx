import { MessageCircle, TriangleAlert } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

/**
 * Shop đã nhận tiền nhưng đơn cần kiểm tra lại (VD khách trả trễ khi con Bakugan đã bán cho
 * người khác). Hệ thống không tự hoàn tiền — mời khách nhắn shop để được hỗ trợ.
 */
export function ShopContactNotice({ className }: { className?: string }) {
  const openChat = useUIStore((state) => state.openChat);
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-left text-sm text-warning sm:flex-row sm:items-center',
        className,
      )}
    >
      <TriangleAlert size={18} className="shrink-0" aria-hidden="true" />
      <p className="flex-1 leading-relaxed">
        Shop đã nhận khoản thanh toán của bạn nhưng đơn cần kiểm tra lại. Bạn nhắn shop để được hỗ
        trợ nhé.
      </p>
      <button
        type="button"
        onClick={() => openChat()}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-warning/50 px-3 py-1.5 text-xs font-bold transition hover:bg-warning/15"
      >
        <MessageCircle size={14} aria-hidden="true" />
        Nhắn shop
      </button>
    </div>
  );
}
