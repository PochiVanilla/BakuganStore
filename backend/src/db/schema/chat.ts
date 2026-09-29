import {
  boolean,
  char,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import type { ChatLink, ConsultState, PendingBotAction } from '../../shared/types';
import { users } from './accounts';
import { createdAtColumn, idColumn, updatedAtColumn, uuidColumn } from './columns';

/**
 * Cuộc trò chuyện khách – shop. Khách vãng lai giữ một mã bí mật (guest token);
 * CSDL chỉ lưu mã băm của nó.
 */
export const conversations = mysqlTable(
  'conversations',
  {
    id: idColumn(),
    customerId: uuidColumn('customer_id').references(() => users.id, { onDelete: 'set null' }),
    guestTokenHash: char('guest_token_hash', { length: 64 }),
    customerName: varchar('customer_name', { length: 100 }).notNull(),
    customerContact: varchar('customer_contact', { length: 150 }),
    status: mysqlEnum('status', ['bot', 'waiting', 'admin', 'resolved']).notNull().default('bot'),
    botEnabled: boolean('bot_enabled').notNull().default(true),
    unreadByAdmin: int('unread_by_admin').notNull().default(0),
    unreadByCustomer: int('unread_by_customer').notNull().default(0),
    pendingAction: json('pending_action').$type<PendingBotAction>(),
    consult: json('consult').$type<ConsultState>(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    uniqueIndex('conversations_guest_token_uq').on(t.guestTokenHash),
    index('conversations_status_updated_idx').on(t.status, t.updatedAt),
    index('conversations_customer_idx').on(t.customerId),
  ],
);

export const messages = mysqlTable(
  'messages',
  {
    id: idColumn(),
    conversationId: uuidColumn('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    sender: mysqlEnum('sender', ['customer', 'bot', 'admin', 'system']).notNull(),
    text: text('text').notNull(),
    authorId: uuidColumn('author_id'),
    authorName: varchar('author_name', { length: 100 }),
    quickReplies: json('quick_replies').$type<string[]>(),
    links: json('links').$type<ChatLink[]>(),
    createdAt: createdAtColumn(),
  },
  (t) => [index('messages_conversation_created_idx').on(t.conversationId, t.createdAt)],
);
