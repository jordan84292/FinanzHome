import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  getTelegramStatus,
  linkTelegramChat,
  setTelegramLinkToken,
} from '@/lib/db/procedures/telegram';
import { uniqueSuffix } from '../../helpers/db';

describe('setTelegramLinkToken / getTelegramStatus / linkTelegramChat', () => {
  it('reports not linked before any token is set', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `telegram_status_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });

    const status = await getTelegramStatus(user.id);

    expect(status.is_linked).toBe(0);
    expect(status.telegram_chat_id).toBeNull();
  });

  it('links a chat id when the token matches, and clears the token afterward', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `telegram_link_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const token = `token-${suffix}`;
    await setTelegramLinkToken(user.id, token);

    const linkedUserId = await linkTelegramChat(token, 999888777);

    expect(linkedUserId).toBe(user.id);
    const status = await getTelegramStatus(user.id);
    expect(status.is_linked).toBe(1);
    expect(status.telegram_chat_id).toBe(999888777);

    // Re-using the same (now-cleared) token must not link a second time.
    const secondAttempt = await linkTelegramChat(token, 111222333);
    expect(secondAttempt).toBeNull();
    const statusAfter = await getTelegramStatus(user.id);
    expect(statusAfter.telegram_chat_id).toBe(999888777);
  });

  it('returns null for a token that does not exist (e.g. a stranger messaging the bot)', async () => {
    const linkedUserId = await linkTelegramChat('this-token-was-never-issued', 123456789);
    expect(linkedUserId).toBeNull();
  });

  it('setting a new link token overwrites a previous one for the same user', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `telegram_overwrite_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    await setTelegramLinkToken(user.id, `old-token-${suffix}`);
    await setTelegramLinkToken(user.id, `new-token-${suffix}`);

    const oldAttempt = await linkTelegramChat(`old-token-${suffix}`, 1);
    expect(oldAttempt).toBeNull();

    const newAttempt = await linkTelegramChat(`new-token-${suffix}`, 2);
    expect(newAttempt).toBe(user.id);
  });
});
