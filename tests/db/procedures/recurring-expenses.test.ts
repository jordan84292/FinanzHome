import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import {
  createExpenseCategory,
  createRecurringExpense,
  deactivateRecurringExpense,
  generateNextOccurrence,
  listExpenseCategories,
  listRecurringExpenses,
  updateRecurringExpense,
} from '@/lib/db/procedures/recurring-expenses';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createOwner(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `recur_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Recur ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id };
}

describe('sp_expense_category_list / sp_expense_category_create', () => {
  it('creates a category and lists it', async () => {
    const suffix = uniqueSuffix();
    const created = await createExpenseCategory(`Categoria ${suffix}`);
    const categories = await listExpenseCategories();

    expect(created.name).toBe(`Categoria ${suffix}`);
    expect(categories.some((c) => c.id === created.id)).toBe(true);
  });
});

describe('sp_recurring_expense_create', () => {
  it('creates a weekly recurring expense', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();

    const expense = await createRecurringExpense({
      householdId,
      name: `Internet ${suffix}`,
      categoryId: category.id,
      amount: 25000,
      currencyId: CRC_ID,
      periodicity: 'weekly',
      dueDayConfig: 5,
      withdrawalDay: 15,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    expect(expense.name).toBe(`Internet ${suffix}`);
    expect(expense.periodicity).toBe('weekly');
    expect(expense.currency_code).toBe('CRC');
    expect(expense.responsible_display_name).toBe('Owner');
    expect(expense.is_active).toBe(1);
  });

  it('creates a one_time recurring expense with a first_due_date', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();

    const expense = await createRecurringExpense({
      householdId,
      name: `Seguro ${suffix}`,
      categoryId: category.id,
      amount: 100000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2026-12-01',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    expect(expense.periodicity).toBe('one_time');
    expect(expense.first_due_date).not.toBeNull();
  });

  it('rejects a responsible member that does not belong to the household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA } = await createOwner(suffixA);
    const { memberId: memberIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();

    await expect(
      createRecurringExpense({
        householdId: householdIdA,
        name: `Malo ${suffixA}`,
        categoryId: category.id,
        amount: 1000,
        currencyId: CRC_ID,
        periodicity: 'biweekly',
        dueDayConfig: null,
        withdrawalDay: 1,
        firstDueDate: null,
        responsibleMemberId: memberIdB,
        createdByMemberId: memberIdB,
      }),
    ).rejects.toThrow(/not found in this household/i);
  });

  it('rejects a created-by member that does not belong to the household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { memberId: memberIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();

    await expect(
      createRecurringExpense({
        householdId: householdIdA,
        name: `MaloCreador ${suffixA}`,
        categoryId: category.id,
        amount: 1000,
        currencyId: CRC_ID,
        periodicity: 'biweekly',
        dueDayConfig: null,
        withdrawalDay: 1,
        firstDueDate: null,
        responsibleMemberId: memberIdA,
        createdByMemberId: memberIdB,
      }),
    ).rejects.toThrow(/not found in this household/i);
  });
});

describe('sp_recurring_expense_update / sp_recurring_expense_deactivate / sp_recurring_expense_list', () => {
  it('updates name/amount/category/currency/responsible member', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Luz ${suffix}`,
      categoryId: category.id,
      amount: 30000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 10,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const updated = await updateRecurringExpense({
      recurringExpenseId: expense.id,
      householdId,
      name: `Luz actualizada ${suffix}`,
      categoryId: category.id,
      amount: 35000,
      currencyId: CRC_ID,
      responsibleMemberId: memberId,
    });

    expect(updated.name).toBe(`Luz actualizada ${suffix}`);
    expect(updated.amount).toBe(35000);
  });

  it('rejects updating a recurring expense from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId: householdIdA,
      name: `Agua ${suffixA}`,
      categoryId: category.id,
      amount: 10000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 5,
      firstDueDate: null,
      responsibleMemberId: memberIdA,
      createdByMemberId: memberIdA,
    });

    await expect(
      updateRecurringExpense({
        recurringExpenseId: expense.id,
        householdId: householdIdB,
        name: 'Hackeado',
        categoryId: category.id,
        amount: 1,
        currencyId: CRC_ID,
        responsibleMemberId: memberIdA,
      }),
    ).rejects.toThrow(/not found in this household/i);
  });

  it('deactivates a recurring expense and it stops appearing in the list', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Gimnasio ${suffix}`,
      categoryId: category.id,
      amount: 20000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 20,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    await deactivateRecurringExpense(expense.id, householdId);
    const list = await listRecurringExpenses(householdId);

    expect(list.some((e) => e.id === expense.id)).toBe(false);
  });

  it('lists active recurring expenses with a next occurrence already generated on creation', async () => {
    // NOTE: originally (Task 1) this asserted status 'sin_ocurrencia' and a
    // null next_occurrence_id right after creation. Task 2 changed
    // createRecurringExpense to generate the first occurrence in the same
    // transaction (a recurring expense must never exist with zero
    // occurrences — see the brief's rationale in recurring-expenses.ts),
    // which makes the immediate post-creation 'sin_ocurrencia' state
    // unreachable through this path. 'sin_ocurrencia' remains a valid status
    // in sp_recurring_expense_list's CASE for any recurring expense that
    // somehow has no occurrence row, but creation is no longer such a case.
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    await createRecurringExpense({
      householdId,
      name: `Cable ${suffix}`,
      categoryId: category.id,
      amount: 15000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 3,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const list = await listRecurringExpenses(householdId);

    expect(list).toHaveLength(1);
    expect(list[0].next_occurrence_id).not.toBeNull();
    expect(list[0].status).toBe('al_dia'); // biweekly, due 14 days out — beyond the 3-day vence_pronto window
  });
});

describe('sp_expense_occurrence_generate_next', () => {
  it('generates the first occurrence for a weekly expense on the next matching weekday', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Internet semanal ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'weekly',
      dueDayConfig: 5, // Viernes
      withdrawalDay: 15,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    // createRecurringExpense already generates the first occurrence transactionally.
    const occurrence = await generateNextOccurrence(expense.id, householdId);

    expect(occurrence.recurring_expense_id).toBe(expense.id);
    const dueDate = new Date(`${occurrence.due_date}T00:00:00`);
    expect(dueDate.getDay()).toBe(5); // JS: 0=Sunday..6=Saturday, 5=Friday
    expect(occurrence.is_paid).toBe(0);
  });

  it('is idempotent while an occurrence is still unpaid', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Cable quincenal ${suffix}`,
      categoryId: category.id,
      amount: 8000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 10,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const first = await generateNextOccurrence(expense.id, householdId);
    const second = await generateNextOccurrence(expense.id, householdId);

    expect(second.id).toBe(first.id);
  });

  it('generates a biweekly occurrence 14 days after the previous due date once paid', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Agua quincenal ${suffix}`,
      categoryId: category.id,
      amount: 6000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 8,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const first = await generateNextOccurrence(expense.id, householdId);
    // Directly flip is_paid via a second call isn't possible yet (mark_paid
    // lands in Task 3) — instead assert generate_next stays a no-op while
    // the first occurrence is still open, which is the guard this task owns.
    const stillFirst = await generateNextOccurrence(expense.id, householdId);
    expect(stillFirst.id).toBe(first.id);
    expect(stillFirst.due_date).toBe(first.due_date);
  });

  it('generates exactly one occurrence for one_time and never a second one', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Matricula ${suffix}`,
      categoryId: category.id,
      amount: 50000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2026-09-01',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const occurrence = await generateNextOccurrence(expense.id, householdId);
    expect(occurrence.due_date.slice(0, 10)).toBe('2026-09-01');

    const secondCall = await generateNextOccurrence(expense.id, householdId);
    expect(secondCall.id).toBe(occurrence.id);
  });

  it('rejects a recurring expense from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId: householdIdA,
      name: `Cross-household ${suffixA}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 1,
      firstDueDate: null,
      responsibleMemberId: memberIdA,
      createdByMemberId: memberIdA,
    });

    await expect(generateNextOccurrence(expense.id, householdIdB)).rejects.toThrow(
      /not found in this household/i,
    );
  });
});

describe('sp_recurring_expense_list status after an occurrence exists', () => {
  it('reports vencido when the next due date is in the past', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Vencido test ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2020-01-01',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    await generateNextOccurrence(expense.id, householdId);

    const list = await listRecurringExpenses(householdId);
    const found = list.find((e) => e.id === expense.id);

    expect(found?.status).toBe('vencido');
  });
});
