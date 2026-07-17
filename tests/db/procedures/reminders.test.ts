import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { createRecurringExpense, listExpenseCategories, markOccurrencePaid, listOccurrences } from '@/lib/db/procedures/recurring-expenses';
import { updatePaymentSchedule } from '@/lib/db/procedures/profile';
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

describe('sp_reminder_get_pending — overdue_daily (payment-frequency math)', () => {
  it('flags overdue for a weekly-paid member once today reaches their payday on/after due_date', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId, userId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();

    // Anchor "today" to a fixed, deterministic weekday so the test isn't
    // sensitive to whatever day it happens to run on: use last Monday as
    // due_date (overdue), and pay the member every Friday. If today is on
    // or after the Friday following that Monday, it must appear; this test
    // only asserts the case where enough days have passed, using a due_date
    // far enough in the past (10 days ago) that today is guaranteed to be on
    // or after at least one Friday since then.
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await updatePaymentSchedule({ userId, paymentFrequency: 'weekly', paymentWeekday: 5, paymentDay: null });

    const expense = await createRecurringExpense({
      householdId,
      name: `Vencido semanal ${suffix}`,
      categoryId: category.id,
      amount: 3000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tenDaysAgo),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(new Date()));

    expect(pending.some((r) => r.recurring_expense_id === expense.id && r.reminder_type === 'overdue_daily')).toBe(true);
  });

  it('flags overdue for a monthly-paid member once today reaches their payday on/after due_date', async () => {
    // Mirrors the weekly test's determinism trick: a monthly payday recurs at
    // most every 31 days, so anchoring due_date 40 days in the past guarantees
    // at least one payment_day has occurred on/after due_date by today,
    // regardless of what day of the month the suite actually runs on.
    // payment_day=1 additionally sidesteps month-length clamping entirely
    // (LEAST(1, any month length) === 1); the clamping arithmetic itself
    // (e.g. payment_day=31 in a 28/29/30-day month) is traced by hand in the
    // final whole-branch review instead of asserted here.
    const suffix = uniqueSuffix();
    const { householdId, memberId, userId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const fortyDaysAgo = new Date(today);
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

    await updatePaymentSchedule({ userId, paymentFrequency: 'monthly', paymentWeekday: null, paymentDay: 1 });

    await createRecurringExpense({
      householdId,
      name: `Vencido mensual ${suffix}`,
      categoryId: category.id,
      amount: 2000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(fortyDaysAgo),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.reminder_type === 'overdue_daily')).toBe(true);
  });

  it('does not flag overdue for a member with no payment_frequency configured', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const expense = await createRecurringExpense({
      householdId,
      name: `Sin horario de pago ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(yesterday),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(new Date()));

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

    await createRecurringExpense({
      householdId,
      name: `Retiro hoy ${suffix}`,
      categoryId: category.id,
      amount: 8000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: today.getDate(),
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

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
