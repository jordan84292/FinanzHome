import { describe, expect, it } from 'vitest';
import { registerUser, getUserByEmail } from '@/lib/db/procedures/auth';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import {
  checkPasswordResetToken,
  completePasswordReset,
  createPasswordResetToken,
} from '@/lib/db/procedures/password-reset';
import { uniqueSuffix } from '../../helpers/db';
import { randomBytes } from 'node:crypto';

async function createTestUser(suffix: string): Promise<{ userId: number; email: string }> {
  const passwordHash = await hashPassword('OldPassword123!');
  const user = await registerUser({
    email: `reset_user_${suffix}@example.com`,
    passwordHash,
    name: 'Reset User',
  });
  return { userId: user.id, email: user.email };
}

describe('password reset token lifecycle', () => {
  it('creates a pending token, checks it as valid, and completes the reset', async () => {
    const suffix = uniqueSuffix();
    const { userId, email } = await createTestUser(suffix);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const created = await createPasswordResetToken({ userId, token, expiresAt });
    expect(created.status).toBe('pending');

    const checked = await checkPasswordResetToken(token);
    expect(checked.user_id).toBe(userId);
    expect(checked.status).toBe('pending');

    const newHash = await hashPassword('NewPassword456!');
    const completedUser = await completePasswordReset({ token, newPasswordHash: newHash });
    expect(completedUser.email).toBe(email);

    const userRow = await getUserByEmail(email);
    expect(userRow).not.toBeNull();
    expect(await verifyPassword('NewPassword456!', userRow!.password_hash)).toBe(true);
    expect(await verifyPassword('OldPassword123!', userRow!.password_hash)).toBe(false);
  });

  it('rejects checking a token that does not exist', async () => {
    await expect(checkPasswordResetToken('nonexistent-token')).rejects.toThrow(/not found/i);
  });

  it('rejects completing a reset with an already-used token', async () => {
    const suffix = uniqueSuffix();
    const { userId } = await createTestUser(suffix);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ userId, token, expiresAt });

    const newHash = await hashPassword('NewPassword456!');
    await completePasswordReset({ token, newPasswordHash: newHash });

    await expect(
      completePasswordReset({ token, newPasswordHash: await hashPassword('AnotherPassword789!') }),
    ).rejects.toThrow(/not pending/i);
  });

  it('rejects an expired token and marks it expired', async () => {
    const suffix = uniqueSuffix();
    const { userId } = await createTestUser(suffix);
    const token = randomBytes(24).toString('hex');
    const pastExpiry = new Date(Date.now() - 60 * 60 * 1000);
    await createPasswordResetToken({ userId, token, expiresAt: pastExpiry });

    await expect(checkPasswordResetToken(token)).rejects.toThrow(/expired/i);
  });

  it('invalidates a previous pending token when a new one is created for the same user', async () => {
    const suffix = uniqueSuffix();
    const { userId } = await createTestUser(suffix);
    const firstToken = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ userId, token: firstToken, expiresAt });

    const secondToken = randomBytes(24).toString('hex');
    await createPasswordResetToken({ userId, token: secondToken, expiresAt });

    await expect(checkPasswordResetToken(firstToken)).rejects.toThrow(/not pending/i);
    const secondChecked = await checkPasswordResetToken(secondToken);
    expect(secondChecked.status).toBe('pending');
  });
});
