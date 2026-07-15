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
  is_extra: number;
  is_purchased: number;
  /**
   * Only populated by sp_shopping_list_items_get (needs the exchange-rate
   * lookup + currencies join). sp_shopping_list_add_item and
   * sp_shopping_list_item_update return the row without these — callers
   * of addShoppingListItem/updateShoppingListItem must not read them;
   * re-fetch via getShoppingListItems() for the full detail.
   */
  unit_price_currency_code?: string | null;
  unit_price_currency_symbol?: string | null;
  subtotal_in_display_currency?: number | null;
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

export async function addShoppingListItem(params: {
  shoppingListId: number;
  householdId: number;
  productId: number;
  quantityNeeded: number;
  unitPrice: number | null;
  unitPriceCurrencyId: number | null;
  isExtra: boolean;
}): Promise<ShoppingListItemRecord> {
  const rows = await callProcedure<ShoppingListItemRecord>('sp_shopping_list_add_item', [
    params.shoppingListId,
    params.householdId,
    params.productId,
    params.quantityNeeded,
    params.unitPrice,
    params.unitPriceCurrencyId,
    params.isExtra ? 1 : 0,
  ]);
  return rows[0];
}

export async function updateShoppingListItem(params: {
  itemId: number;
  householdId: number;
  quantityNeeded: number;
  unitPrice: number | null;
  unitPriceCurrencyId: number | null;
}): Promise<ShoppingListItemRecord> {
  const rows = await callProcedure<ShoppingListItemRecord>('sp_shopping_list_item_update', [
    params.itemId,
    params.householdId,
    params.quantityNeeded,
    params.unitPrice,
    params.unitPriceCurrencyId,
  ]);
  return rows[0];
}

export async function deleteShoppingListItem(itemId: number, householdId: number): Promise<void> {
  await callProcedure('sp_shopping_list_item_delete', [itemId, householdId]);
}
