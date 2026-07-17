import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';
import { withTransaction } from '../transaction';

export interface ExpenseInstallmentShareRecord extends RowDataPacket {
  id: number;
  recurring_expense_id: number;
  period_index: number;
  percentage: number;
}

export interface ExpenseInstallmentRecord extends RowDataPacket {
  id: number;
  recurring_expense_id: number;
  month_start: string;
  period_index: number;
  due_date: string;
  percentage: number;
  amount: number;
  is_paid: number;
  paid_by_member_id: number | null;
  paid_at: string | null;
}

export async function listInstallmentShares(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseInstallmentShareRecord[]> {
  return callProcedure<ExpenseInstallmentShareRecord>('sp_expense_installment_share_list', [
    recurringExpenseId,
    householdId,
  ]);
}

export async function setInstallmentShares(params: {
  recurringExpenseId: number;
  householdId: number;
  shares: Array<{ periodIndex: number; percentage: number }>;
}): Promise<ExpenseInstallmentShareRecord[]> {
  return withTransaction(async (call) => {
    await call('sp_expense_installment_share_clear', [params.recurringExpenseId, params.householdId]);
    for (const share of params.shares) {
      await call('sp_expense_installment_share_set', [
        params.recurringExpenseId,
        params.householdId,
        share.periodIndex,
        share.percentage,
      ]);
    }
    return call<ExpenseInstallmentShareRecord>('sp_expense_installment_share_validate', [
      params.recurringExpenseId,
      params.householdId,
    ]);
  });
}

export async function generateInstallmentsForMonth(params: {
  recurringExpenseId: number;
  householdId: number;
  monthStart: string;
}): Promise<ExpenseInstallmentRecord[]> {
  return callProcedure<ExpenseInstallmentRecord>('sp_expense_installment_generate_for_month', [
    params.recurringExpenseId,
    params.householdId,
    params.monthStart,
  ]);
}

export async function listInstallments(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseInstallmentRecord[]> {
  return callProcedure<ExpenseInstallmentRecord>('sp_expense_installment_list', [
    recurringExpenseId,
    householdId,
  ]);
}

export async function markInstallmentPaid(params: {
  installmentId: number;
  householdId: number;
  paidByMemberId: number;
}): Promise<ExpenseInstallmentRecord> {
  const rows = await callProcedure<ExpenseInstallmentRecord>('sp_expense_installment_mark_paid', [
    params.installmentId,
    params.householdId,
    params.paidByMemberId,
  ]);
  return rows[0];
}
