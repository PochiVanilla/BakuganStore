import { v7 as uuidv7 } from 'uuid';

/**
 * Id mới cho mọi bảng: UUID v7 (xếp được theo thời gian tạo nên chỉ mục gọn hơn v4).
 * Tạo ở backend, không chờ CSDL trả về (MySQL không có RETURNING).
 */
export function newId(): string {
  return uuidv7();
}
