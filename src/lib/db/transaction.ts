import type { RowDataPacket } from 'mysql2';
import { pool } from './pool';
import { callProcedureOn } from './call';

export type ProcedureCaller = <T extends RowDataPacket = RowDataPacket>(
  name: string,
  params?: unknown[],
) => Promise<T[]>;

export async function withTransaction<T>(fn: (call: ProcedureCaller) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const call: ProcedureCaller = (name, params = []) => callProcedureOn(conn, name, params);
    const result = await fn(call);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
