import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';
import { withTransaction } from '../transaction';

export interface ExpenseCategoryRecord extends RowDataPacket {
  id: number;
  name: string;
}

export interface RecurringExpenseRecord extends RowDataPacket {
  id: number;
  household_id: number;
  name: string;
  category_id: number;
  category_name: string;
  amount: number;
  currency_id: number;
  currency_code: 'CRC' | 'USD';
  currency_symbol: string;
  periodicity: 'weekly' | 'biweekly' | 'monthly' | 'one_time';
  due_day_config: number | null;
  withdrawal_day: number | null;
  first_due_date: string | null;
  monthly_due_day: number | null;
  funding_mode: 'full_payment' | 'installments' | null;
  installment_frequency: 'weekly' | 'biweekly' | null;
  responsible_member_id: number;
  responsible_display_name: string;
  is_active: number;
  created_at: string;
  /**
   * Only populated by sp_recurring_expense_list's correlated subquery.
   * sp_recurring_expense_create/update do not include these columns —
   * callers of createRecurringExpense/updateRecurringExpense must not read
   * them; re-fetch via listRecurringExpenses() for the full detail.
   */
  next_occurrence_id?: number | null;
  next_due_date?: string | null;
  status?: 'vencido' | 'vence_pronto' | 'al_dia' | 'sin_ocurrencia';
}

export interface ExpenseOccurrenceRecord extends RowDataPacket {
  id: number;
  recurring_expense_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  is_paid: number;
  paid_by_member_id: number | null;
  paid_at: string | null;
  created_at: string;
}

export async function listExpenseCategories(): Promise<ExpenseCategoryRecord[]> {
  return callProcedure<ExpenseCategoryRecord>('sp_expense_category_list');
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategoryRecord> {
  const rows = await callProcedure<ExpenseCategoryRecord>('sp_expense_category_create', [name]);
  return rows[0];
}

export async function listRecurringExpenses(
  householdId: number,
  includeInactive: boolean = false,
): Promise<RecurringExpenseRecord[]> {
  return callProcedure<RecurringExpenseRecord>('sp_recurring_expense_list', [
    householdId,
    includeInactive ? 1 : 0,
  ]);
}

export async function createRecurringExpense(params: {
  householdId: number;
  name: string;
  categoryId: number;
  amount: number;
  currencyId: number;
  periodicity: 'weekly' | 'biweekly' | 'monthly' | 'one_time';
  dueDayConfig: number | null;
  withdrawalDay: number | null;
  firstDueDate: string | null;
  monthlyDueDay?: number | null;
  fundingMode?: 'full_payment' | 'installments' | null;
  installmentFrequency?: 'weekly' | 'biweekly' | null;
  responsibleMemberId: number;
  createdByMemberId: number;
}): Promise<RecurringExpenseRecord> {
  return withTransaction(async (call) => {
    const rows = await call<RecurringExpenseRecord>('sp_recurring_expense_create', [
      params.householdId,
      params.name,
      params.categoryId,
      params.amount,
      params.currencyId,
      params.periodicity,
      params.dueDayConfig,
      params.withdrawalDay,
      params.firstDueDate,
      params.monthlyDueDay ?? null,
      params.fundingMode ?? null,
      params.installmentFrequency ?? null,
      params.responsibleMemberId,
      params.createdByMemberId,
    ]);
    const recurringExpense = rows[0];
    const occurrenceRows = await call<ExpenseOccurrenceRecord>('sp_expense_occurrence_generate_next', [
      recurringExpense.id,
      params.householdId,
    ]);
    await call('sp_expense_occurrence_shares_snapshot', [occurrenceRows[0].id, params.householdId]);
    return recurringExpense;
  });
}

export async function updateRecurringExpense(params: {
  recurringExpenseId: number;
  householdId: number;
  name: string;
  categoryId: number;
  amount: number;
  currencyId: number;
  responsibleMemberId: number;
}): Promise<RecurringExpenseRecord> {
  const rows = await callProcedure<RecurringExpenseRecord>('sp_recurring_expense_update', [
    params.recurringExpenseId,
    params.householdId,
    params.name,
    params.categoryId,
    params.amount,
    params.currencyId,
    params.responsibleMemberId,
  ]);
  return rows[0];
}

export async function deactivateRecurringExpense(
  recurringExpenseId: number,
  householdId: number,
): Promise<void> {
  await callProcedure('sp_recurring_expense_deactivate', [recurringExpenseId, householdId]);
}

export async function reactivateRecurringExpense(
  recurringExpenseId: number,
  householdId: number,
): Promise<void> {
  await callProcedure('sp_recurring_expense_reactivate', [recurringExpenseId, householdId]);
}

export async function generateNextOccurrence(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseOccurrenceRecord> {
  const rows = await callProcedure<ExpenseOccurrenceRecord>('sp_expense_occurrence_generate_next', [
    recurringExpenseId,
    householdId,
  ]);
  return rows[0];
}

export async function updateOccurrenceDueDate(params: {
  occurrenceId: number;
  householdId: number;
  dueDate: string;
}): Promise<ExpenseOccurrenceRecord> {
  const rows = await callProcedure<ExpenseOccurrenceRecord>('sp_expense_occurrence_update_due_date', [
    params.occurrenceId,
    params.householdId,
    params.dueDate,
  ]);
  return rows[0];
}

export async function listOccurrences(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseOccurrenceRecord[]> {
  return callProcedure<ExpenseOccurrenceRecord>('sp_expense_occurrence_list', [
    recurringExpenseId,
    householdId,
  ]);
}

export async function markOccurrencePaid(params: {
  occurrenceId: number;
  householdId: number;
  paidByMemberId: number;
}): Promise<ExpenseOccurrenceRecord[]> {
  return withTransaction(async (call) => {
    const rows = await call<ExpenseOccurrenceRecord>('sp_expense_occurrence_mark_paid', [
      params.occurrenceId,
      params.householdId,
      params.paidByMemberId,
    ]);
    const paidOccurrence = rows[0];
    const nextOccurrenceRows = await call<ExpenseOccurrenceRecord>('sp_expense_occurrence_generate_next', [
      paidOccurrence.recurring_expense_id,
      params.householdId,
    ]);
    await call('sp_expense_occurrence_shares_snapshot', [nextOccurrenceRows[0].id, params.householdId]);
    try {
      // Only meaningful for periodicity='monthly' + funding_mode='installments'
      // expenses; the SP itself SIGNALs for anything else, which we ignore here
      // exactly like confirmPurchaseAction ignores initSplit failing for a
      // shopping list nobody split — the occurrence/shares work above already
      // succeeded and must not be reported as a failure to the caller.
      await call('sp_expense_installment_generate_for_month', [
        paidOccurrence.recurring_expense_id,
        params.householdId,
        nextOccurrenceRows[0].period_start,
      ]);
    } catch {
      // not an installments-funded monthly expense — nothing to generate
    }
    return call<ExpenseOccurrenceRecord>('sp_expense_occurrence_list', [
      paidOccurrence.recurring_expense_id,
      params.householdId,
    ]);
  });
}
