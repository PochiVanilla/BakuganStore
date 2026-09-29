import type { Pool, RowDataPacket } from 'mysql2/promise';

/**
 * Khoá tên của MySQL (GET_LOCK). Dùng cho việc chạy nền và migration: nếu sau này chạy
 * hai server thì cũng chỉ một cái làm. Khoá gắn với một kết nối riêng, giữ tới khi xong.
 * Trả về `undefined` nếu không lấy được khoá trong `waitSeconds`.
 */
export async function withNamedLock<T>(
  pool: Pool,
  name: string,
  waitSeconds: number,
  work: () => Promise<T>,
): Promise<{ acquired: true; result: T } | { acquired: false }> {
  const lockName = `tdb:${name}`.slice(0, 64);
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT GET_LOCK(?, ?) AS got', [
      lockName,
      waitSeconds,
    ]);
    if (rows[0]?.got !== 1) return { acquired: false };
    try {
      return { acquired: true, result: await work() };
    } finally {
      await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } finally {
    connection.release();
  }
}
