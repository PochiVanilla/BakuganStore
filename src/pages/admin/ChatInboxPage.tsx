import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  MessagesSquare,
  SendHorizontal,
  Settings,
  UserRound,
} from 'lucide-react';
import type { ChatConversation, ConversationStatus } from '@/types';
import { ADMIN_ROUTES } from '@/constants/routes';
import {
  fetchWidgetConfig,
  listConversations,
  markReadByAdmin,
  resolveConversation,
  sendAdminMessage,
  setConversationBot,
  type ConversationFilter,
} from '@/services/api/chatService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { toast } from '@/store/uiStore';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button, EmptyState, Seo, Skeleton } from '@/components/ui';
import { AdminPageHeader, ErrorBox, FilterTabs } from '@/features/admin/adminUi';
import { ChatMessageList } from '@/features/chat/ChatMessageList';

const STATUS_LABELS: Record<ConversationStatus, string> = {
  bot: 'Bot đang trả lời',
  waiting: 'Chờ nhân viên',
  admin: 'Nhân viên đang hỗ trợ',
  resolved: 'Đã xong',
};

const STATUS_STYLES: Record<ConversationStatus, string> = {
  bot: 'bg-accent-cyan/12 text-accent-cyan',
  waiting: 'bg-accent-pink/15 text-accent-pink',
  admin: 'bg-gold/12 text-gold',
  resolved: 'bg-white/6 text-text-muted',
};

/** Câu trả lời mẫu cho các tình huống hay gặp. */
const CANNED_REPLIES = [
  'Dạ shop kiểm tra và báo lại bạn trong ít phút nhé!',
  'Bạn gửi giúp shop ảnh sản phẩm qua Zalo 0912 345 678 để shop xem kỹ hơn nhé.',
  'Shop đã cập nhật đơn cho bạn rồi ạ. Cảm ơn bạn đã ủng hộ TD Bakugan!',
] as const;

function preview(conversation: ChatConversation): string {
  const last = [...conversation.messages].reverse().find((message) => message.sender !== 'system');
  if (!last) return '';
  const prefix = last.sender === 'customer' ? '' : last.sender === 'bot' ? 'Bot: ' : 'Bạn: ';
  return `${prefix}${last.text}`;
}

function Thread({ conversation, onBack }: { conversation: ChatConversation; onBack: () => void }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (conversation.unreadByAdmin > 0) void markReadByAdmin(conversation.id);
  }, [conversation.id, conversation.unreadByAdmin]);

  const run = async (key: string, action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(key);
    try {
      await action();
      return true;
    } catch (error) {
      toast.error('Không thực hiện được', getApiErrorMessage(error));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const send = async (): Promise<void> => {
    const text = draft.trim();
    if (!text) return;
    if (await run('send', () => sendAdminMessage(conversation.id, text))) setDraft('');
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  const botOn = conversation.botEnabled && conversation.status === 'bot';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại danh sách"
          className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 lg:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold text-text">
            {conversation.customerName}
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-semibold',
                STATUS_STYLES[conversation.status],
              )}
            >
              {STATUS_LABELS[conversation.status]}
            </span>
          </p>
          <p className="truncate text-xs text-text-muted">
            {conversation.customerContact ?? 'Không để lại liên hệ'}
            {conversation.customerId && (
              <>
                {' · '}
                <Link
                  to={ADMIN_ROUTES.customerDetail(conversation.customerId)}
                  className="text-accent-cyan hover:underline"
                >
                  <UserRound size={11} className="mr-0.5 inline" aria-hidden="true" />
                  Hồ sơ khách
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={botOn ? 'secondary' : 'outline'}
            isLoading={busy === 'bot'}
            leftIcon={<Bot size={14} aria-hidden="true" />}
            onClick={() => void run('bot', () => setConversationBot(conversation.id, !botOn))}
          >
            {botOn ? 'Tắt bot, tự trả lời' : 'Giao lại cho bot'}
          </Button>
          {conversation.status !== 'resolved' && (
            <Button
              size="sm"
              variant="ghost"
              isLoading={busy === 'resolve'}
              leftIcon={<CheckCheck size={14} aria-hidden="true" />}
              onClick={() => void run('resolve', () => resolveConversation(conversation.id))}
            >
              Đánh dấu xong
            </Button>
          )}
        </div>
      </header>

      <ChatMessageList messages={conversation.messages} viewer="admin" className="min-h-0 flex-1" />

      <form onSubmit={onSubmit} className="border-t border-white/8 p-3">
        <div className="mb-2 scrollbar-none flex gap-1.5 overflow-x-auto">
          {CANNED_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => setDraft(reply)}
              className="max-w-64 shrink-0 truncate rounded-full border border-white/10 px-3 py-1 text-xs text-text-muted hover:border-gold/40 hover:text-gold"
            >
              {reply}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="sr-only">Trả lời khách</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              maxLength={1_000}
              placeholder={
                botOn
                  ? 'Gửi tin sẽ tạm dừng bot cho cuộc trò chuyện này…'
                  : 'Nhập câu trả lời (Enter để gửi)'
              }
              className="max-h-36 min-h-12 w-full resize-y rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-muted/60 focus:border-accent-cyan"
            />
          </label>
          <Button
            type="submit"
            isLoading={busy === 'send'}
            disabled={!draft.trim()}
            aria-label="Gửi trả lời"
          >
            <SendHorizontal size={16} aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ChatInboxPage() {
  const revision = useLiveRevision();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');
  const [filter, setFilter] = useState<ConversationFilter>('needs-reply');

  const list = useAsync(() => listConversations('all'), [revision], { keepPreviousData: true });
  const config = useAsync(() => fetchWidgetConfig(), [revision], { keepPreviousData: true });
  const all = list.data ?? [];

  const matches = (item: ChatConversation): boolean => {
    if (filter === 'all') return true;
    if (filter === 'needs-reply') {
      return item.status === 'waiting' || (item.status === 'admin' && item.unreadByAdmin > 0);
    }
    return item.status === filter;
  };
  const visible = all.filter(matches);
  const selected = all.find((item) => item.id === selectedId);
  const needsReply = all.filter(
    (item) => item.status === 'waiting' || (item.status === 'admin' && item.unreadByAdmin > 0),
  ).length;

  const select = (id: string | null): void => {
    const next = new URLSearchParams(params);
    if (id) next.set('c', id);
    else next.delete('c');
    setParams(next, { replace: true });
  };

  return (
    <>
      <Seo title="Tin nhắn" description="Hộp thư chat với khách" path={ADMIN_ROUTES.chat} noIndex />
      <AdminPageHeader
        title="Tin nhắn"
        description="Trợ lý AI tự trả lời các câu đơn giản bạn đã cho phép; câu khó được chuyển vào mục “Cần trả lời”."
        actions={
          <Link
            to={ADMIN_ROUTES.settings}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3.5 text-sm text-text-muted hover:border-white/20 hover:text-text"
          >
            <Settings size={15} aria-hidden="true" />
            Cài đặt trợ lý AI
          </Link>
        }
      />

      {config.data?.botEnabled === false && (
        <p className="mb-4 rounded-2xl border border-warning/30 bg-warning/8 p-3 text-sm text-warning">
          Trợ lý AI đang tắt — mọi tin nhắn mới chuyển thẳng cho nhân viên.
        </p>
      )}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}

      <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] overflow-hidden rounded-2xl border border-white/8 bg-surface/80 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Danh sách */}
        <div
          className={cn(
            'flex min-h-0 flex-col border-white/8 lg:border-r',
            selected && 'hidden lg:flex',
          )}
        >
          <div className="border-b border-white/8 p-3">
            <FilterTabs
              label="Lọc cuộc trò chuyện"
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: 'needs-reply', label: 'Cần trả lời', count: needsReply },
                { value: 'bot', label: 'Bot đang xử lý' },
                { value: 'resolved', label: 'Đã xong' },
                { value: 'all', label: 'Tất cả', count: all.length },
              ]}
            />
          </div>
          {!list.data ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              Không có cuộc trò chuyện nào ở mục này.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => select(item.id)}
                    aria-current={item.id === selectedId ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-white/4',
                      item.id === selectedId && 'bg-accent-cyan/8',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                        {item.customerName}
                      </span>
                      <span className="shrink-0 text-[10px] text-text-muted">
                        {formatRelativeTime(item.updatedAt)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs text-text-muted">{preview(item)}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-px text-[10px] font-semibold',
                          STATUS_STYLES[item.status],
                        )}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                      {item.unreadByAdmin > 0 && (
                        <span className="rounded-full bg-accent-pink px-1.5 text-[10px] font-bold text-white">
                          {item.unreadByAdmin} mới
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Nội dung */}
        <div className={cn('min-h-0', !selected && 'hidden lg:block')}>
          {selected ? (
            <Thread key={selected.id} conversation={selected} onBack={() => select(null)} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={<MessagesSquare size={26} aria-hidden="true" />}
                title="Chọn một cuộc trò chuyện"
                description="Tin nhắn chờ nhân viên hiện ở mục “Cần trả lời”. Bạn có thể tự trả lời hoặc giao lại cho bot bất cứ lúc nào."
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
