import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql, { type Pool } from 'mysql2/promise';
import type { Env } from '../config/env';
import * as schema from './schema';

export type Db = MySql2Database<typeof schema>;

export interface Database {
  pool: Pool;
  db: Db;
  close(): Promise<void>;
}

type DbEnv = Pick<
  Env,
  'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME' | 'DB_POOL_SIZE'
>;

/**
 * Kết nối MySQL. Mọi kết nối đều đặt time_zone = '+00:00' nên CURRENT_TIMESTAMP, NOW()
 * và cột DATETIME luôn là giờ UTC; đổi sang giờ Việt Nam chỉ làm khi gom số liệu theo ngày.
 */
export function createDatabase(env: DbEnv): Database {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_POOL_SIZE,
    waitForConnections: true,
    queueLimit: 0,
    charset: 'UTF8MB4_0900_AI_CI',
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    connectTimeout: 10_000,
  });
  pool.pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  const db = drizzle(pool, { schema, mode: 'default' });
  return {
    pool,
    db,
    close: () => pool.end(),
  };
}

/** Hỏi CSDL một câu thật ngắn, quá `timeoutMs` coi như không trả lời. */
export async function pingDatabase(pool: Pool, timeoutMs = 2_000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('DB ping timeout')), timeoutMs);
    });
    await Promise.race([pool.query('SELECT 1'), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
