import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';
import { withTransaction } from '../transaction';
import type { ExpenseOccurrenceRecord } from './recurring-expenses';

export interface ExpenseShareRecord extends RowDataPacket {
  id: number;
  recurring_expense_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
}

/**
 * Snapshot of the default split copied onto a single expense occurrence at
 * generation time (sp_expense_occurrence_shares_snapshot). For a shared
 * one_time expense, is_paid/paid_at track that individual member's own
 * payment independently — the occurrence is only fully paid once every
 * share is (see sp_expense_occurrence_share_mark_paid).
 */
export interface ExpenseOccurrenceShareRecord extends RowDataPacket {
  id: number;
  occurrence_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
  amount_owed: number;
  is_paid: number;
  paid_at: string | null;
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
    const validated = await call<ExpenseShareRecord>('sp_recurring_expense_share_validate', [
      params.recurringExpenseId,
      params.householdId,
    ]);

    // The share config UI only appears in "Editar" (mode === 'edit'), i.e.
    // strictly after the expense (and its first occurrence) already exists —
    // createRecurringExpense snapshots shares onto that first occurrence in
    // the same transaction it's created in, before this can ever run. For a
    // one_time expense there is no future occurrence to pick up a split
    // configured afterward (it never regenerates), so without this the
    // per-member paid checklist would silently never appear. The snapshot SP
    // is idempotent — it only inserts when the occurrence currently has zero
    // share rows — so re-running it here is a no-op for anything already
    // snapshotted (recurring expenses' current cycle keeps its history).
    const occurrences = await call<ExpenseOccurrenceRecord>('sp_expense_occurrence_list', [
      params.recurringExpenseId,
      params.householdId,
    ]);
    const currentUnpaid = occurrences.find((o) => o.is_paid === 0);
    if (currentUnpaid) {
      await call('sp_expense_occurrence_shares_snapshot', [currentUnpaid.id, params.householdId]);
    }

    return validated;
  });
}

export async function listExpenseOccurrenceShares(
  occurrenceId: number,
  householdId: number,
): Promise<ExpenseOccurrenceShareRecord[]> {
  return callProcedure<ExpenseOccurrenceShareRecord>('sp_expense_occurrence_shares_list', [
    occurrenceId,
    householdId,
  ]);
}

export async function markExpenseOccurrenceSharePaid(params: {
  shareId: number;
  householdId: number;
  isPaid: boolean;
}): Promise<ExpenseOccurrenceShareRecord[]> {
  return callProcedure<ExpenseOccurrenceShareRecord>('sp_expense_occurrence_share_mark_paid', [
    params.shareId,
    params.householdId,
    params.isPaid ? 1 : 0,
  ]);
}
