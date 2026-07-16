import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

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
