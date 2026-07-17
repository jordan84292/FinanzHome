import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from './pool';

const PROCEDURE_NAME_PATTERN = /^[a-z0-9_]+$/i;

type Queryable = Pool | PoolConnection;

const DEADLOCK_MAX_ATTEMPTS = 3;

function isDeadlockError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: string }).code === 'ER_LOCK_DEADLOCK';
}

export async function callProcedureOn<T extends RowDataPacket = RowDataPacket>(
  conn: Queryable,
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!PROCEDURE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid stored procedure name: ${name}`);
  }
  const placeholders = params.map(() => '?').join(', ');

  for (let attempt = 1; attempt <= DEADLOCK_MAX_ATTEMPTS; attempt++) {
    try {
      const [results] = await conn.query(`CALL ${name}(${placeholders})`, params);
      const rows = (results as unknown as [T[], ...unknown[]])[0];
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      // InnoDB deadlocks are transient by nature (MySQL's own docs recommend
      // retrying the whole statement) — each attempt here is a fresh single-
      // statement CALL with no state carried over, so a plain retry is safe.
      if (!isDeadlockError(error) || attempt === DEADLOCK_MAX_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw new Error('unreachable');
}

export async function callProcedure<T extends RowDataPacket = RowDataPacket>(
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  return callProcedureOn<T>(pool, name, params);
}
