import type { Address, BankAccount, User } from '../../shared/types';
import type { addresses, bankAccounts, users } from '../../db/schema';

type UserRow = typeof users.$inferSelect;
type AddressRow = typeof addresses.$inferSelect;
type BankRow = typeof bankAccounts.$inferSelect;

export function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    receiverName: row.receiverName,
    phone: row.phone,
    province: row.province,
    district: row.district,
    ward: row.ward,
    street: row.street,
    isDefault: row.isDefault,
  };
}

/** Số tài khoản không bao giờ trả đầy đủ, kể cả cho chính chủ: chỉ 4 số cuối. */
export function toMaskedBankAccount(row: BankRow): BankAccount {
  return {
    bankName: row.bankName,
    accountHolder: row.accountHolder,
    accountNumber: `•••• ${row.accountLast4}`,
  };
}

/**
 * Hồ sơ trả cho chính người dùng. Chọn từng trường được phép, nên ghi chú nội bộ,
 * thẻ phân loại, lý do khoá, mã băm mật khẩu… không bao giờ lọt ra ngoài.
 */
export function toSessionUser(row: UserRow, addressRows: AddressRow[], bank?: BankRow): User {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatarUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
    addresses: addressRows.map(toAddress),
    role: row.role,
    birthday: row.birthday ?? undefined,
    gender: row.gender ?? undefined,
    bankAccount: bank ? toMaskedBankAccount(bank) : undefined,
    memberLevel: row.memberLevel === 2 ? 2 : 1,
  };
}
