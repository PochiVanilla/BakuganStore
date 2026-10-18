import type { Request } from 'express';
import type { Db } from '../db/client';
import { auditLogs } from '../db/schema';
import type { Tx } from '../db/tx';
import { newId } from './ids';

export interface AuditEntry {
  /** Việc đã làm, VD "feed.create", "item.mark-sold" */
  action: string;
  targetType: string;
  targetId?: string;
  /** Vài thông tin để đọc lại sau (số feed, mã con…); không ghi dữ liệu nhạy cảm */
  detail?: Record<string, unknown>;
}

/**
 * Ghi nhật ký thao tác của admin. Gọi trong cùng transaction với thao tác,
 * để thao tác thành công thì luôn có dòng nhật ký (và ngược lại).
 */
export async function writeAudit(
  executor: Db | Tx,
  req: Request,
  entry: AuditEntry,
): Promise<void> {
  const actor = req.auth?.user;
  await executor.insert(auditLogs).values({
    id: newId(),
    actorId: actor?.id ?? null,
    actorName: actor?.fullName ?? 'Hệ thống',
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    detail: entry.detail ?? null,
    ip: req.ip ?? null,
  });
}
