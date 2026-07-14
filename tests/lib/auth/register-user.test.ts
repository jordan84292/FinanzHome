import { describe, expect, it } from 'vitest';
import { registerNewUser, EmailAlreadyRegisteredError } from '@/lib/auth/register-user';
import { verifyPassword } from '@/lib/auth/password';
import { getUserByEmail } from '@/lib/db/procedures/auth';
import { uniqueSuffix } from '../../helpers/db';

describe('registerNewUser', () => {
  it('creates a user with a hashed password', async () => {
    const suffix = uniqueSuffix();
    const email = `newuser_${suffix}@example.com`;

    const created = await registerNewUser({ email, password: 'my-secret-pw', name: 'New User' });

    expect(created.email).toBe(email);
    const stored = await getUserByEmail(email);
    expect(stored?.password_hash).not.toBe('my-secret-pw');
    await expect(verifyPassword('my-secret-pw', stored!.password_hash)).resolves.toBe(true);
  });

  it('rejects registering the same email twice', async () => {
    const suffix = uniqueSuffix();
    const email = `dup_${suffix}@example.com`;
    await registerNewUser({ email, password: 'pw-one', name: 'First' });

    await expect(
      registerNewUser({ email, password: 'pw-two', name: 'Second' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });
});
