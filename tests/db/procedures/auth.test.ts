import { describe, expect, it } from 'vitest';
import { getUserByEmail, registerUser } from '@/lib/db/procedures/auth';
import { uniqueSuffix } from '../../helpers/db';

describe('auth procedures', () => {
  it('registers a user and retrieves it by email', async () => {
    const suffix = uniqueSuffix();
    const email = `user_${suffix}@example.com`;

    const created = await registerUser({
      email,
      passwordHash: 'hashed-password',
      name: 'Test User',
    });

    expect(created.email).toBe(email);
    expect(created.id).toBeGreaterThan(0);

    const found = await getUserByEmail(email);
    expect(found?.id).toBe(created.id);
    expect(found?.password_hash).toBe('hashed-password');
  });

  it('returns null for an email that does not exist', async () => {
    const found = await getUserByEmail(`missing_${uniqueSuffix()}@example.com`);
    expect(found).toBeNull();
  });
});
