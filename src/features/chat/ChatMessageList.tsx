import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bot, Headset } from 'lucide-react';
import type { ChatLink, ChatMessage } from '@/types';
import { cn } from '@/utils/cn';

const LINK_CLASS =
  'flex items-center justify-between gap-2 rounded-xl border border-accent-cyan/30 bg-surface-2 px-3 py-2 text-left text-xs font-medium text-accent-cyan transition hover:border-accent-cyan/60 hover:bg-accent-cyan/10';

/** Nút mở trang trong web mà bot gợi ý (VD một con Bakugan trong feed). */
function MessageLinks({
  links,
  viewer,
  onLinkClick,
}: {
  links: readonly ChatLink[];
  viewer: 'customer' | 'admin';
  onLinkClick?: () => void;
}) {
  return (
    <div className="flex w-full min-w-56 flex-col gap-1.5">
      {links.map((link, index) =>
        viewer === 'customer' ? (
          <Link
            key={`${link.to}-${index}`}
            to={link.to}
            onClick={onLinkClick}
            className={LINK_CLASS}
          >
            <span className="min-w-0 truncate">{link.label}</span>
            <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          // Trong hộp thư admin: mở trang khách ở tab mới để không rời cuộc trò chuyện.
          <a
            key={`${link.to}-${index}`}
            href={link.to}
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            <span className="min-w-0 truncate">{link.label}</span>
            <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
          </a>
        ),
      )}
    </div>
  );
}

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

/**
 * Danh sách tin nhắn dùng chung cho khung chat của khách và hộp thư admin.
 * `viewer` quyết định bên nào là "của mình" (nằm bên phải).
 */
export function ChatMessageList({
  messages,
  viewer,
  isTyping = false,
  className,
  onLinkClick,
}: {
  messages: readonly ChatMessage[];
  viewer: 'customer' | 'admin';
  isTyping?: boolean;
  className?: string;
  /** Khách bấm một nút gợi ý của bot (khung chat đóng lại trên điện thoại) */
  onLinkClick?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;

  // Có tin mới (hoặc bot bắt đầu soạn) thì cuộn xuống cuối.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lastId, isTyping]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Nội dung trò chuyện"
      className={cn('flex flex-col gap-2.5 overflow-y-auto px-4 py-4', className)}
    >
      {messages.map((message) => {
        if (message.sender === 'system') {
          return (
            <p
              key={message.id}
              className="mx-auto max-w-[90%] rounded-lg bg-white/4 px-3 py-1.5 text-center text-[11px] leading-relaxed text-text-muted"
            >
              {message.text}
            </p>
          );
        }

        const mine =
          viewer === 'customer' ? message.sender === 'customer' : message.sender !== 'customer';
        const isBot = message.sender === 'bot';
        const isStaff = message.sender === 'admin';

        return (
          <div
            key={message.id}
            className={cn(
              'flex max-w-[85%] flex-col gap-1',
              mine ? 'items-end self-end' : 'items-start self-start',
            )}
          >
            {(isBot || isStaff) && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-text-muted">
                {isBot ? (
                  <>
                    <Bot size={11} className="text-accent-cyan" aria-hidden="true" /> Trợ lý AI
                  </>
                ) : (
                  <>
                    <Headset size={11} className="text-gold" aria-hidden="true" />{' '}
                    {message.authorName ?? 'Nhân viên'}
                  </>
                )}
              </span>
            )}
            <div
              className={cn(
                'rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-line',
                mine ? 'rounded-br-md' : 'rounded-bl-md',
                message.sender === 'customer' &&
                  (viewer === 'customer' ? 'bg-primary text-white' : 'bg-surface-2 text-text'),
                isBot && 'border border-accent-cyan/25 bg-accent-cyan/8 text-text',
                isStaff && 'border border-gold/30 bg-gold/8 text-text',
              )}
            >
              {message.text}
            </div>
            {message.links && message.links.length > 0 && (
              <MessageLinks links={message.links} viewer={viewer} onLinkClick={onLinkClick} />
            )}
            <time dateTime={message.createdAt} className="text-[10px] text-text-muted/70">
              {timeOf(message.createdAt)}
            </time>
          </div>
        );
      })}

      {isTyping && (
        <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-accent-cyan/25 bg-accent-cyan/8 px-3.5 py-2.5">
          <span className="sr-only">Trợ lý đang soạn câu trả lời</span>
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-cyan"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
