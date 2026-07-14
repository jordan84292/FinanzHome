import type { RowDataPacket } from 'mysql2';
import { pool } from './pool';

const PROCEDURE_NAME_PATTERN = /^[a-z0-9_]+$/i;

export async function callProcedure<T extends RowDataPacket = RowDataPacket>(
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!PROCEDURE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid stored procedure name: ${name}`);
  }
  const placeholders = params.map(() => '?').join(', ');
  // mysql2 devuelve CALL como [[rows, OkPacket], fields] — solo nos interesa el primer result set.
  const [results] = await pool.query(`CALL ${name}(${placeholders})`, params);
  const rows = (results as unknown as [T[], ...unknown[]])[0];
  return Array.isArray(rows) ? rows : [];
}
