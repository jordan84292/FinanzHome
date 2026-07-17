import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import {
  createExpenseCategory,
  createRecurringExpense,
  deactivateRecurringExpense,
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

  it('lists active recurring expenses with status sin_ocurrencia before any occurrence exists', async () => {
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
    expect(list[0].status).toBe('sin_ocurrencia');
    expect(list[0].next_occurrence_id).toBeNull();
  });
});
