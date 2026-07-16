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
