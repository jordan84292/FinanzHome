import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { createRecurringExpense, listExpenseCategories } from '@/lib/db/procedures/recurring-expenses';
import { linkTelegramChat, setTelegramLinkToken } from '@/lib/db/procedures/telegram';
import { sendPendingReminders } from '@/lib/reminders/send-pending-reminders';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

const sendReminderTelegramMessageMock = vi.fn();
vi.mock('@/lib/telegram/client', () => ({
  sendReminderTelegramMessage: (...args: unknown[]) => sendReminderTelegramMessageMock(...args),
}));

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function createOwner(suffix: string): Promise<{ householdId: number; memberId: number; userId: number }> {
  const user = await registerUser({
    email: `send_pending_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Send ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id, userId: user.id };
}

describe('sendPendingReminders', () => {
  beforeEach(() => {
    sendReminderTelegramMessageMock.mockReset();
  });

  it('sends and logs a due_soon reminder for a linked member, then finds nothing pending on a second call', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId, userId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const token = `token_${suffix}_a`;
    await setTelegramLinkToken(userId, token);
    await linkTelegramChat(token, 999);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await createRecurringExpense({
      householdId,
      name: `Enviar ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    sendReminderTelegramMessageMock.mockResolvedValue(true);

    const result = await sendPendingReminders(isoDate(today));
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(sendReminderTelegramMessageMock).toHaveBeenCalled();

    const second = await sendPendingReminders(isoDate(today));
    expect(second.sent).toBe(0);
  });

  it('does not log a reminder for an unlinked member, so it is still pending on a second call', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expenseName = `Sin vincular ${suffix}`;
    await createRecurringExpense({
      householdId,
      name: expenseName,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    sendReminderTelegramMessageMock.mockResolvedValue(false);

    await sendPendingReminders(isoDate(today));
    expect(sendReminderTelegramMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ expense_name: expenseName }),
    );
    sendReminderTelegramMessageMock.mockClear();

    await sendPendingReminders(isoDate(today));
    expect(sendReminderTelegramMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ expense_name: expenseName }),
    );
  });

  it('does not let one failed send block the rest of the batch', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId, userId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const token = `token_${suffix}_b`;
    await setTelegramLinkToken(userId, token);
    await linkTelegramChat(token, 888);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await createRecurringExpense({
      householdId,
      name: `Falla envio ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    sendReminderTelegramMessageMock.mockRejectedValueOnce(new Error('Telegram API down'));

    await expect(sendPendingReminders(isoDate(today))).resolves.toEqual(
      expect.objectContaining({ sent: 0 }),
    );
  });
});
