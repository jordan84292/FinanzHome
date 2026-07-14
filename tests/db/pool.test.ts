import { describe, expect, it } from 'vitest';
import { pool } from '@/lib/db/pool';

describe('database pool', () => {
  it('connects and runs a trivial query', async () => {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    expect((rows as { result: number }[])[0].result).toBe(2);
  });
});
