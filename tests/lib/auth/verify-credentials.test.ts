import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { hashPassword } from '@/lib/auth/password';
import { verifyCredentials } from '@/lib/auth/verify-credentials';
import { uniqueSuffix } from '../../helpers/db';

describe('verifyCredentials', () => {
  it('returns the user when email and password match', async () => {
    const suffix = uniqueSuffix();
    const email = `login_${suffix}@example.com`;
    const passwordHash = await hashPassword('s3cret-pass');
    await registerUser({ email, passwordHash, name: 'Login Test' });

    const result = await verifyCredentials(email, 's3cret-pass');
    expect(result?.email).toBe(email);
    expect(result?.name).toBe('Login Test');
  });

  it('returns null when the password is wrong', async () => {
    const suffix = uniqueSuffix();
    const email = `login2_${suffix}@example.com`;
    const passwordHash = await hashPassword('correct-pass');
    await registerUser({ email, passwordHash, name: 'Login Test 2' });

    const result = await verifyCredentials(email, 'wrong-pass');
    expect(result).toBeNull();
  });

  it('returns null when the email does not exist', async () => {
    const result = await verifyCredentials(`missing_${uniqueSuffix()}@example.com`, 'whatever');
    expect(result).toBeNull();
  });
});
