import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from './pool';

const PROCEDURE_NAME_PATTERN = /^[a-z0-9_]+$/i;

type Queryable = Pool | PoolConnection;

export async function callProcedureOn<T extends RowDataPacket = RowDataPacket>(
  conn: Queryable,
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!PROCEDURE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid stored procedure name: ${name}`);
  }
  const placeholders = params.map(() => '?').join(', ');
  const [results] = await conn.query(`CALL ${name}(${placeholders})`, params);
  const rows = (results as unknown as [T[], ...unknown[]])[0];
  return Array.isArray(rows) ? rows : [];
}

export async function callProcedure<T extends RowDataPacket = RowDataPacket>(
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  return callProcedureOn<T>(pool, name, params);
}
