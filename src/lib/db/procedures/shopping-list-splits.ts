import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';
import { withTransaction } from '../transaction';

export interface ShoppingListSplitRecord extends RowDataPacket {
  id: number;
  shopping_list_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
  amount_owed: number;
  is_paid: number;
  paid_at: string | null;
}

export interface ShoppingListPaymentRecord extends RowDataPacket {
  shopping_list_id: number;
  confirmed_at: string;
  total_actual: number;
  total_estimated_currency_id: number;
  currency_symbol: string;
  split_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
  amount_owed: number;
  is_paid: number;
  paid_at: string | null;
}

export async function initSplit(
  shoppingListId: number,
  householdId: number,
): Promise<ShoppingListSplitRecord[]> {
  return callProcedure<ShoppingListSplitRecord>('sp_shopping_list_split_init', [
    shoppingListId,
    householdId,
  ]);
}

export async function getSplit(
  shoppingListId: number,
  householdId: number,
): Promise<ShoppingListSplitRecord[]> {
  return callProcedure<ShoppingListSplitRecord>('sp_shopping_list_split_get', [
    shoppingListId,
    householdId,
  ]);
}

export async function updateSplit(params: {
  shoppingListId: number;
  householdId: number;
  updates: Array<{ memberId: number; percentage: number }>;
}): Promise<ShoppingListSplitRecord[]> {
  return withTransaction(async (call) => {
    for (const update of params.updates) {
      await call('sp_shopping_list_split_update', [
        params.shoppingListId,
        params.householdId,
        update.memberId,
        update.percentage,
      ]);
    }
    return call<ShoppingListSplitRecord>('sp_shopping_list_split_validate', [
      params.shoppingListId,
      params.householdId,
    ]);
  });
}

export async function markSplitPaid(params: {
  splitId: number;
  householdId: number;
  isPaid: boolean;
}): Promise<ShoppingListSplitRecord> {
  const rows = await callProcedure<ShoppingListSplitRecord>('sp_shopping_list_split_mark_paid', [
    params.splitId,
    params.householdId,
    params.isPaid ? 1 : 0,
  ]);
  return rows[0];
}

export async function listPendingPayments(householdId: number): Promise<ShoppingListPaymentRecord[]> {
  return callProcedure<ShoppingListPaymentRecord>('sp_shopping_list_payments_list', [householdId]);
}
