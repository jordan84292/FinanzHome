import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { createRecurringExpense, listExpenseCategories, listOccurrences } from '@/lib/db/procedures/recurring-expenses';
import { getPendingReminders, logReminderSent } from '@/lib/db/procedures/reminders';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createOwner(suffix: string): Promise<{ householdId: number; memberId: number; userId: number }> {
  const user = await registerUser({
    email: `reminders_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Reminders ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id, userId: user.id };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe('sp_reminder_get_pending — due_week', () => {
  it('flags a one_time expense due in 7 days as due_week', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const inAWeek = new Date(today);
    inAWeek.setDate(inAWeek.getDate() + 7);

    await createRecurringExpense({
      householdId,
      name: `Vence en una semana ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(inAWeek),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    const match = pending.find((r) => r.reminder_type === 'due_week' && r.expense_name === `Vence en una semana ${suffix}`);
    expect(match).toBeDefined();
    expect(match?.member_id).toBe(memberId);
  });

  it('does not flag an expense due in 6 days as due_week', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const inSixDays = new Date(today);
    inSixDays.setDate(inSixDays.getDate() + 6);

    const expense = await createRecurringExpense({
      householdId,
      name: `Vence en seis dias ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(inSixDays),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(
      pending.some((r) => r.recurring_expense_id === expense.id && r.reminder_type === 'due_week'),
    ).toBe(false);
  });
});

describe('sp_reminder_get_pending — due_soon', () => {
  it('flags a one_time expense due tomorrow as due_soon', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await createRecurringExpense({
      householdId,
      name: `Vence manana ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    const match = pending.find((r) => r.reminder_type === 'due_soon' && r.expense_name === `Vence manana ${suffix}`);
    expect(match).toBeDefined();
    expect(match?.member_id).toBe(memberId);
  });

  it('does not re-flag due_soon once it has already been logged sent today', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expense = await createRecurringExpense({
      householdId,
      name: `Ya avisado ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [occurrence] = await listOccurrences(expense.id, householdId);

    await logReminderSent({
      occurrenceId: occurrence.id,
      memberId,
      reminderType: 'due_soon',
      sentDate: isoDate(today),
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.occurrence_id === occurrence.id && r.reminder_type === 'due_soon')).toBe(false);
  });
});

describe('sp_reminder_get_pending — due_today', () => {
  it('flags a one_time expense due today as due_today', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();

    await createRecurringExpense({
      householdId,
      name: `Vence hoy ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(today),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    const match = pending.find((r) => r.reminder_type === 'due_today' && r.expense_name === `Vence hoy ${suffix}`);
    expect(match).toBeDefined();
    expect(match?.member_id).toBe(memberId);
  });

  it('does not re-flag due_today once it has already been logged sent today', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();

    const expense = await createRecurringExpense({
      householdId,
      name: `Ya avisado hoy ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(today),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [occurrence] = await listOccurrences(expense.id, householdId);

    await logReminderSent({
      occurrenceId: occurrence.id,
      memberId,
      reminderType: 'due_today',
      sentDate: isoDate(today),
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.occurrence_id === occurrence.id && r.reminder_type === 'due_today')).toBe(false);
  });
});

describe('sp_reminder_get_pending — overdue_daily', () => {
  it('flags any unpaid occurrence past its due date, no payment schedule needed', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const expense = await createRecurringExpense({
      householdId,
      name: `Vencido ${suffix}`,
      categoryId: category.id,
      amount: 3000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(yesterday),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(new Date()));

    expect(pending.some((r) => r.recurring_expense_id === expense.id && r.reminder_type === 'overdue_daily')).toBe(true);
  });

  it('does not re-flag overdue_daily once it has already been logged sent today', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const expense = await createRecurringExpense({
      householdId,
      name: `Vencido ya avisado ${suffix}`,
      categoryId: category.id,
      amount: 3000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(yesterday),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [occurrence] = await listOccurrences(expense.id, householdId);

    await logReminderSent({
      occurrenceId: occurrence.id,
      memberId,
      reminderType: 'overdue_daily',
      sentDate: isoDate(today),
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.occurrence_id === occurrence.id && r.reminder_type === 'overdue_daily')).toBe(false);
  });

  it('does not flag an occurrence due today (not yet overdue)', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();

    const expense = await createRecurringExpense({
      householdId,
      name: `Vence hoy no vencido ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(today),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(
      pending.some((r) => r.recurring_expense_id === expense.id && r.reminder_type === 'overdue_daily'),
    ).toBe(false);
  });
});

describe('sp_reminder_get_pending — withdrawal', () => {
  it('flags withdrawal for an active biweekly expense on its withdrawal_day', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const todayIso = isoDate(today);
    // Derive withdrawalDay from the same ISO string passed as p_today, not from
    // today.getDate() (local time) — toISOString() is always UTC, so the two
    // can disagree on "what day is today" for hours each day (e.g. after 6pm
    // in Costa Rica, UTC has already rolled to the next calendar day).
    const withdrawalDay = Number(todayIso.slice(8, 10));

    await createRecurringExpense({
      householdId,
      name: `Retiro hoy ${suffix}`,
      categoryId: category.id,
      amount: 8000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(todayIso);

    expect(pending.some((r) => r.reminder_type === 'withdrawal')).toBe(true);
  });

  it('does not flag withdrawal for a one_time expense', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();

    const expense = await createRecurringExpense({
      householdId,
      name: `Pago unico ${suffix}`,
      categoryId: category.id,
      amount: 8000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(today),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(
      pending.some((r) => r.recurring_expense_id === expense.id && r.reminder_type === 'withdrawal'),
    ).toBe(false);
  });
});

describe('logReminderSent idempotency', () => {
  it('is safe to call twice for the same occurrence/member/type/day', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expense = await createRecurringExpense({
      householdId,
      name: `Doble log ${suffix}`,
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
    const [occurrence] = await listOccurrences(expense.id, householdId);
    const today = isoDate(new Date());

    await logReminderSent({ occurrenceId: occurrence.id, memberId, reminderType: 'due_soon', sentDate: today });
    await expect(
      logReminderSent({ occurrenceId: occurrence.id, memberId, reminderType: 'due_soon', sentDate: today }),
    ).resolves.not.toThrow();
  });
});
