import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { USER_ROLES } from '../../shared/types';
import { createdAtColumn, idColumn, timeColumn, updatedAtColumn, uuidColumn } from './columns';

/** Tài khoản khách và admin. Email lưu chữ thường. */
export const users = mysqlTable(
  'users',
  {
    id: idColumn(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull().default(''),
    avatarUrl: varchar('avatar_url', { length: 512 }),
    role: mysqlEnum('role', USER_ROLES).notNull().default('customer'),
    status: mysqlEnum('status', ['active', 'locked']).notNull().default('active'),
    lockedReason: varchar('locked_reason', { length: 255 }),
    birthday: date('birthday', { mode: 'string' }),
    gender: mysqlEnum('gender', ['male', 'female', 'other']),
    memberLevel: tinyint('member_level').notNull().default(1),
    levelSource: mysqlEnum('level_source', ['purchases', 'deposit', 'admin']),
    levelUpAt: timeColumn('level_up_at'),
    depositBalance: bigint('deposit_balance', { mode: 'number' }).notNull().default(0),
    tags: json('tags')
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    adminNote: text('admin_note'),
    failedLogins: int('failed_logins').notNull().default(0),
    loginLockedUntil: timeColumn('login_locked_until'),
    lastLoginAt: timeColumn('last_login_at'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    uniqueIndex('users_email_uq').on(t.email),
    index('users_role_created_idx').on(t.role, t.createdAt),
    check('users_member_level_chk', sql`${t.memberLevel} in (1, 2)`),
    check('users_deposit_chk', sql`${t.depositBalance} >= 0`),
  ],
);

/** Sổ địa chỉ. Mỗi khách tối đa một địa chỉ mặc định (cột sinh + UNIQUE). */
export const addresses = mysqlTable(
  'addresses',
  {
    id: idColumn(),
    userId: uuidColumn('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 50 }).notNull().default(''),
    receiverName: varchar('receiver_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    province: varchar('province', { length: 100 }).notNull(),
    district: varchar('district', { length: 100 }).notNull(),
    ward: varchar('ward', { length: 100 }).notNull(),
    street: varchar('street', { length: 255 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    // NULL với địa chỉ thường, = user_id với địa chỉ mặc định → UNIQUE chặn hai địa chỉ mặc định.
    defaultOwner: char('default_owner', { length: 36 }).generatedAlwaysAs(
      sql`if(\`is_default\`, \`user_id\`, null)`,
      { mode: 'virtual' },
    ),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    index('addresses_user_idx').on(t.userId),
    uniqueIndex('addresses_one_default_uq').on(t.defaultOwner),
  ],
);

/**
 * Tài khoản nhận hoàn tiền của khách. Số tài khoản mã hoá AES-256-GCM; chỉ lưu riêng
 * 4 số cuối để hiển thị. Không API nào trả số đầy đủ cho admin.
 */
export const bankAccounts = mysqlTable('bank_accounts', {
  userId: uuidColumn('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  accountHolder: varchar('account_holder', { length: 100 }).notNull(),
  accountNumberEnc: varchar('account_number_enc', { length: 512 }).notNull(),
  accountLast4: char('account_last4', { length: 4 }).notNull(),
  keyVersion: tinyint('key_version').notNull().default(1),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

/** Phiên đăng nhập (refresh token). Chỉ lưu mã băm SHA-256 của token. */
export const sessions = mysqlTable(
  'sessions',
  {
    id: idColumn(),
    userId: uuidColumn('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuidColumn('family_id').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: timeColumn('expires_at').notNull(),
    revokedAt: timeColumn('revoked_at'),
    replacedBy: uuidColumn('replaced_by'),
    remember: boolean('remember').notNull().default(false),
    userAgent: varchar('user_agent', { length: 255 }).notNull().default(''),
    ip: varchar('ip', { length: 45 }).notNull().default(''),
    createdAt: createdAtColumn(),
    lastUsedAt: timeColumn('last_used_at'),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_uq').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
    index('sessions_family_idx').on(t.familyId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
);

/** Mã đặt lại mật khẩu: dùng một lần, sống 30 phút. Chỉ lưu mã băm. */
export const passwordResets = mysqlTable(
  'password_resets',
  {
    id: idColumn(),
    userId: uuidColumn('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: timeColumn('expires_at').notNull(),
    usedAt: timeColumn('used_at'),
    createdAt: createdAtColumn(),
  },
  (t) => [
    uniqueIndex('password_resets_token_hash_uq').on(t.tokenHash),
    index('password_resets_user_idx').on(t.userId),
  ],
);
