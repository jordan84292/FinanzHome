import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';
import { withTransaction } from '../transaction';

export interface ExpenseShareRecord extends RowDataPacket {
  id: number;
  recurring_expense_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
}

/**
 * Read-only snapshot of the default split copied onto a single expense
 * occurrence at generation time (sp_expense_occurrence_shares_snapshot).
 * No wrapper function reads this yet — deferred to a future phase's
 * dashboard (Fase 8), which will query expense_occurrence_shares directly.
 */
export interface ExpenseOccurrenceShareRecord extends RowDataPacket {
  id: number;
  occurrence_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
  amount_owed: number;
}

export async function listRecurringExpenseShares(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseShareRecord[]> {
  return callProcedure<ExpenseShareRecord>('sp_recurring_expense_share_list', [
    recurringExpenseId,
    householdId,
  ]);
}

export async function setRecurringExpenseShares(params: {
  recurringExpenseId: number;
  householdId: number;
  shares: Array<{ memberId: number; percentage: number }>;
}): Promise<ExpenseShareRecord[]> {
  return withTransaction(async (call) => {
    await call('sp_recurring_expense_share_clear', [params.recurringExpenseId, params.householdId]);
    for (const share of params.shares) {
      await call('sp_recurring_expense_share_set', [
        params.recurringExpenseId,
        params.householdId,
        share.memberId,
        share.percentage,
      ]);
    }
    return call<ExpenseShareRecord>('sp_recurring_expense_share_validate', [
      params.recurringExpenseId,
      params.householdId,
    ]);
  });
}
