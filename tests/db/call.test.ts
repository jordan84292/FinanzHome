import { describe, expect, it } from 'vitest';
import { callProcedure } from '@/lib/db/call';

describe('callProcedure', () => {
  it('rejects a procedure name that is not a plain identifier', async () => {
    await expect(callProcedure('sp_x; DROP TABLE users; --')).rejects.toThrow(
      'Invalid stored procedure name',
    );
  });
});
