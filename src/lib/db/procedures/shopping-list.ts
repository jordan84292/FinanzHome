import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface ShoppingListRecord extends RowDataPacket {
  id: number;
  household_id: number;
  status: 'open' | 'confirmed' | 'cancelled';
  created_by_member_id: number;
  total_estimated: number | null;
  total_estimated_currency_id: number | null;
  created_at: string;
  confirmed_at: string | null;
  /**
   * Only populated by sp_shopping_list_get's correlated subquery.
   * sp_shopping_list_generate's result does not include this column —
   * callers of generateOrGetShoppingList must not read it; fetch the
   * full detail via getShoppingList() instead.
   */
  total_estimated_live?: number | null;
}

export interface ShoppingListItemRecord extends RowDataPacket {
  id: number;
  shopping_list_id: number;
  product_id: number;
  product_name: string;
  unit_code: string;
  quantity_needed: number;
  unit_price: number | null;
  unit_price_currency_id: number | null;
  unit_price_currency_code: string | null;
  unit_price_currency_symbol: string | null;
  is_extra: number;
  is_purchased: number;
  subtotal_in_display_currency: number | null;
}

export async function generateOrGetShoppingList(
  householdId: number,
  createdByMemberId: number,
): Promise<ShoppingListRecord> {
  const rows = await callProcedure<ShoppingListRecord>('sp_shopping_list_generate', [
    householdId,
    createdByMemberId,
  ]);
  return rows[0];
}

export async function getShoppingList(
  shoppingListId: number,
  householdId: number,
  displayCurrencyId: number,
): Promise<ShoppingListRecord> {
  const rows = await callProcedure<ShoppingListRecord>('sp_shopping_list_get', [
    shoppingListId,
    householdId,
    displayCurrencyId,
  ]);
  return rows[0];
}

export async function getShoppingListItems(
  shoppingListId: number,
  householdId: number,
  displayCurrencyId: number,
): Promise<ShoppingListItemRecord[]> {
  return callProcedure<ShoppingListItemRecord>('sp_shopping_list_items_get', [
    shoppingListId,
    householdId,
    displayCurrencyId,
  ]);
}
