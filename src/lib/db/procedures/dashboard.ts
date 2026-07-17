import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface ExpenseByCategoryRecord extends RowDataPacket {
  category_id: number;
  category_name: string;
  total_amount: number;
}

export interface MonthlyTrendRecord extends RowDataPacket {
  period_month: string;
  total_amount: number;
}

export interface MemberBalanceRecord extends RowDataPacket {
  member_id: number;
  display_name: string;
  shopping_share_amount: number;
  expense_owed_to_others: number;
  expense_fronted_by_them: number;
  net_balance: number;
}

export async function getExpenseByCategory(
  householdId: number,
  month: string,
  displayCurrencyId: number,
): Promise<ExpenseByCategoryRecord[]> {
  return callProcedure<ExpenseByCategoryRecord>('sp_dashboard_expense_by_category', [
    householdId,
    month,
    displayCurrencyId,
  ]);
}

export async function getMonthlyTrend(
  householdId: number,
  monthsBack: number,
  displayCurrencyId: number,
): Promise<MonthlyTrendRecord[]> {
  return callProcedure<MonthlyTrendRecord>('sp_dashboard_monthly_trend', [
    householdId,
    monthsBack,
    displayCurrencyId,
  ]);
}

export async function getMemberBalances(
  householdId: number,
  displayCurrencyId: number,
): Promise<MemberBalanceRecord[]> {
  return callProcedure<MemberBalanceRecord>('sp_dashboard_member_balances', [
    householdId,
    displayCurrencyId,
  ]);
}
