import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { newId } from '../lib/ids';
import { hashPassword } from '../lib/password';
import { emailSchema, fullNameSchema, passwordSchema } from '../shared/authSchemas';
import { Prompter } from './prompt';

const MAX_TRIES = 3;

async function askValid(
  prompter: Prompter,
  question: string,
  schema: {
    safeParse(value: unknown): { success: boolean; error?: { issues: { message: string }[] } };
  },
  options: { hidden?: boolean } = {},
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    const value = await prompter.ask(question, options);
    const result = schema.safeParse(value);
    if (result.success) return value;
    process.stdout.write(`  ✗ ${result.error?.issues[0]?.message ?? 'Không hợp lệ'}\n`);
  }
  throw new Error('Nhập sai quá nhiều lần, dừng lại.');
}

/**
 * Tạo tài khoản quản trị. Không có tài khoản admin nào nằm sẵn trong code hay dữ liệu ban đầu:
 * chủ shop tự chạy lệnh này trên máy và tự gõ mật khẩu (không lưu vào lịch sử lệnh).
 */
export async function adminCreate(db: Db): Promise<number> {
  const prompter = new Prompter();
  try {
    process.stdout.write('Tạo tài khoản quản trị TD Bakugan\n\n');
    const email = (await askValid(prompter, 'Email: ', emailSchema)).toLowerCase();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) {
      process.stderr.write(
        'Email này đã có tài khoản. Dùng một email riêng cho tài khoản quản trị.\n',
      );
      return 1;
    }
    const fullName = await askValid(prompter, 'Họ và tên: ', fullNameSchema);
    process.stdout.write(
      'Mật khẩu: ít nhất 8 ký tự, có chữ hoa, chữ thường và số (không hiện khi gõ).\n',
    );
    const password = await askValid(prompter, 'Mật khẩu: ', passwordSchema, { hidden: true });
    const confirm = await prompter.ask('Nhập lại mật khẩu: ', { hidden: true });
    if (confirm !== password) {
      process.stderr.write('Mật khẩu nhập lại không khớp. Chưa tạo tài khoản.\n');
      return 1;
    }
    await db.insert(users).values({
      id: newId(),
      email,
      passwordHash: await hashPassword(password),
      fullName: fullName.trim(),
      role: 'admin',
      tags: [],
    });
    process.stdout.write(
      `\n✓ Đã tạo tài khoản quản trị ${email}. Đăng nhập trên web để vào trang quản trị.\n`,
    );
    return 0;
  } finally {
    prompter.close();
  }
}
