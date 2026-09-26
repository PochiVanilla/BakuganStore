import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Headset, MessageCircle, SendHorizontal, X } from 'lucide-react';
import type { ChatConversation, ChatMessage } from '@/types';
import {
  fetchConversation,
  fetchWidgetConfig,
  findConversationOf,
  markReadByCustomer,
  requestBotReply,
  requestHuman,
  sendCustomerMessage,
  startConversation,
} from '@/services/api/chatService';
import { getApiErrorMessage } from '@/services/api/client';
import { useAsync } from '@/hooks/useAsync';
import { useLiveRevision } from '@/hooks/useLiveRevision';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { DragonMark } from '@/components/layout/DragonMark';
import { ChatMessageList } from './ChatMessageList';

const GUEST_KEY = 'td-bakugan:chat-conversation';
const MAX_LENGTH = 1_000;

const QUICK_QUESTIONS = [
  'Đơn hàng của mình tới đâu rồi?',
  'Phí ship bao nhiêu?',
  'Luật chống bắn tỉa là gì?',
  'Đổi trả thế nào?',
] as const;

const STATUS_TEXT: Record<ChatConversation['status'], string> = {
  bot: 'Trợ lý AI đang hỗ trợ',
  waiting: 'Đang chờ nhân viên (09:00 – 21:00)',
  admin: 'Nhân viên đang hỗ trợ',
  resolved: 'Đã xong — nhắn tiếp bất cứ lúc nào',
};

function readGuestConversation(): string {
  try {
    return window.localStorage.getItem(GUEST_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeGuestConversation(id: string): void {
  try {
    window.localStorage.setItem(GUEST_KEY, id);
  } catch {
    // Không lưu được thì lần sau khách bắt đầu cuộc mới — không sao.
  }
}

/**
 * Nút chat nổi ở góc phải. Khách hỏi → trợ lý AI trả lời những việc admin
 * đã cho phép; việc khác tự chuyển nhân viên. Khách vãng lai cũng chat được.
 */
export function ChatWidget() {
  const user = useAuthStore((state) => state.user);
  const revision = useLiveRevision();
  const [isOpen, setIsOpen] = useState(false);
  const [guestId, setGuestId] = useState(readGuestConversation);
  const [draft, setDraft] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);

  const config = useAsync(() => fetchWidgetConfig(), [isOpen, revision], {
    keepPreviousData: true,
  });
  const conversation = useAsync(
    () =>
      user
        ? findConversationOf(user.id)
        : guestId
          ? fetchConversation(guestId)
          : Promise.resolve(null),
    [user?.id, guestId, revision],
    { keepPreviousData: true },
  );
  const current = conversation.data ?? null;
  const unread = current?.unreadByCustomer ?? 0;

  // Đang mở khung chat thì coi như đã đọc tin mới.
  useEffect(() => {
    if (isOpen && current && current.unreadByCustomer > 0) {
      void markReadByCustomer(current.id);
    }
  }, [isOpen, current]);

  const isAdmin = user?.role === 'admin';
  if (isAdmin) return null;

  const greeting: ChatMessage = {
    id: 'greeting',
    sender: 'bot',
    text:
      config.data?.botEnabled === false
        ? 'Chào bạn! Nhân viên TD Bakugan sẽ trả lời trong giờ làm việc 09:00 – 21:00.'
        : (config.data?.greeting ?? 'Chào bạn! Mình có thể giúp gì cho bạn?'),
    createdAt: new Date().toISOString(),
  };
  const messages = current?.messages ?? [greeting];
  const needsGuestInfo = !user && !current;

  const ensureConversation = async (): Promise<string> => {
    if (current) return current.id;
    const created = await startConversation({
      customerId: user?.id,
      customerName: user?.fullName ?? guestName,
      customerContact: user?.email ?? guestContact,
    });
    if (!user) {
      writeGuestConversation(created.id);
      setGuestId(created.id);
    }
    return created.id;
  };

  const send = async (text: string): Promise<void> => {
    const body = text.trim();
    if (!body || isSending) return;
    if (needsGuestInfo && guestName.trim().length < 2) {
      toast.info('Cho shop xin tên của bạn', 'Để nhân viên xưng hô và liên hệ lại khi cần.');
      return;
    }
    setIsSending(true);
    try {
      const id = await ensureConversation();
      const result = await sendCustomerMessage(id, body);
      setDraft('');
      if (result.awaitingBot) {
        setIsBotTyping(true);
        try {
          await requestBotReply(id);
        } finally {
          setIsBotTyping(false);
        }
      }
    } catch (error) {
      toast.error('Chưa gửi được tin nhắn', getApiErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  const askHuman = async (): Promise<void> => {
    if (needsGuestInfo && guestName.trim().length < 2) {
      toast.info('Cho shop xin tên của bạn', 'Để nhân viên xưng hô và liên hệ lại khi cần.');
      return;
    }
    try {
      const id = await ensureConversation();
      await requestHuman(id);
    } catch (error) {
      toast.error('Chưa chuyển được cho nhân viên', getApiErrorMessage(error));
    }
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void send(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  };

  const status = current?.status ?? (config.data?.botEnabled === false ? 'waiting' : 'bot');
  const lastSender = messages[messages.length - 1]?.sender;
  const showQuickQuestions = status === 'bot' && lastSender !== 'customer' && !isBotTyping;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.section
            key="chat-panel"
            role="dialog"
            aria-label="Trò chuyện với TD Bakugan"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed right-3 bottom-24 z-[80] flex h-[min(580px,calc(100dvh-8rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] sm:right-6"
          >
            <header className="flex items-center gap-3 border-b border-white/8 bg-surface-2/60 px-4 py-3">
              <DragonMark size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">TD Bakugan hỗ trợ</p>
                <p className="flex items-center gap-1.5 truncate text-[11px] text-text-muted">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      status === 'bot'
                        ? 'bg-accent-cyan'
                        : status === 'admin'
                          ? 'bg-success'
                          : 'bg-warning',
                    )}
                    aria-hidden="true"
                  />
                  {STATUS_TEXT[status]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng khung chat"
                className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-text"
              >
                <X size={18} />
              </button>
            </header>

            <ChatMessageList
              messages={messages}
              viewer="customer"
              isTyping={isBotTyping}
              className="flex-1"
            />

            {showQuickQuestions && (
              <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-3 pb-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={isSending}
                    onClick={() => void send(question)}
                    className="shrink-0 rounded-full border border-accent-cyan/30 px-3 py-1 text-xs text-accent-cyan transition hover:bg-accent-cyan/10 disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={onSubmit} className="border-t border-white/8 p-3">
              {needsGuestInfo && (
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <label>
                    <span className="sr-only">Tên của bạn</span>
                    <input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Tên của bạn *"
                      maxLength={60}
                      autoComplete="name"
                      className="h-9 w-full rounded-lg border border-white/10 bg-surface-2 px-2.5 text-sm text-text outline-none focus:border-accent-cyan"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Số điện thoại hoặc email</span>
                    <input
                      value={guestContact}
                      onChange={(event) => setGuestContact(event.target.value)}
                      placeholder="SĐT / email"
                      maxLength={80}
                      className="h-9 w-full rounded-lg border border-white/10 bg-surface-2 px-2.5 text-sm text-text outline-none focus:border-accent-cyan"
                    />
                  </label>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="sr-only">Nội dung tin nhắn</span>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    maxLength={MAX_LENGTH}
                    placeholder="Nhập tin nhắn…"
                    className="max-h-28 min-h-10 w-full resize-none rounded-xl border border-white/10 bg-surface-2 px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-muted/60 focus:border-accent-cyan"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!draft.trim() || isSending}
                  aria-label="Gửi tin nhắn"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-cta text-white transition disabled:opacity-40"
                >
                  <SendHorizontal size={17} />
                </button>
              </div>
              {status === 'bot' && (
                <button
                  type="button"
                  onClick={() => void askHuman()}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-gold"
                >
                  <Headset size={13} aria-hidden="true" />
                  Gặp nhân viên
                </button>
              )}
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? 'Đóng khung chat'
            : `Chat với TD Bakugan${unread > 0 ? ` (${unread} tin mới)` : ''}`
        }
        className="fixed right-4 bottom-5 z-[80] flex h-14 w-14 items-center justify-center rounded-full gradient-cta text-white shadow-[0_10px_30px_-6px_rgba(233,64,210,0.7)] transition hover:scale-105 sm:right-6"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={24} />}
        {!isOpen && unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-background"
          >
            {unread}
          </span>
        )}
      </button>
    </>
  );
}
