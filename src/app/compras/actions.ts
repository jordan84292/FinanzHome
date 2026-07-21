'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMembership } from '@/lib/household/require-membership';
import {
  addShoppingListItem,
  confirmShoppingList,
  deleteShoppingListItem,
  getShoppingList,
  getShoppingListItems,
  updateShoppingListItem,
} from '@/lib/db/procedures/shopping-list';
import {
  getSplit,
  initSplit,
  markSplitPaid,
  updateSplit,
  type ShoppingListSplitRecord,
} from '@/lib/db/procedures/shopping-list-splits';

const addItemSchema = z.object({
  shoppingListId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  quantityNeeded: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
  unitPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface AddItemState {
  error: string | null;
}

export async function addItemAction(
  _prevState: AddItemState,
  formData: FormData,
): Promise<AddItemState> {
  const membership = await requireMembership();

  const parsed = addItemSchema.safeParse({
    shoppingListId: formData.get('shoppingListId'),
    productId: formData.get('productId'),
    quantityNeeded: formData.get('quantityNeeded'),
    unitPrice: formData.get('unitPrice') || undefined,
    unitPriceCurrencyId: formData.get('unitPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await addShoppingListItem({
      shoppingListId: parsed.data.shoppingListId,
      householdId: membership.id,
      productId: parsed.data.productId,
      quantityNeeded: parsed.data.quantityNeeded,
      unitPrice: parsed.data.unitPrice ?? null,
      unitPriceCurrencyId: parsed.data.unitPriceCurrencyId ?? null,
      isExtra: true,
    });
  } catch {
    return { error: 'No se pudo agregar el producto. Intentá de nuevo.' };
  }

  revalidatePath('/compras');
  return { error: null };
}

const updateItemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  quantityNeeded: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
  unitPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface UpdateItemState {
  error: string | null;
}

export async function updateItemAction(
  _prevState: UpdateItemState,
  formData: FormData,
): Promise<UpdateItemState> {
  const membership = await requireMembership();

  const parsed = updateItemSchema.safeParse({
    itemId: formData.get('itemId'),
    quantityNeeded: formData.get('quantityNeeded'),
    unitPrice: formData.get('unitPrice') || undefined,
    unitPriceCurrencyId: formData.get('unitPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await updateShoppingListItem({
      itemId: parsed.data.itemId,
      householdId: membership.id,
      quantityNeeded: parsed.data.quantityNeeded,
      unitPrice: parsed.data.unitPrice ?? null,
      unitPriceCurrencyId: parsed.data.unitPriceCurrencyId ?? null,
    });
  } catch {
    return { error: 'No se pudo actualizar el producto. Intentá de nuevo.' };
  }

  revalidatePath('/compras');
  return { error: null };
}

export async function deleteItemAction(itemId: number): Promise<void> {
  const membership = await requireMembership();
  await deleteShoppingListItem(itemId, membership.id);
  revalidatePath('/compras');
}

const DISPLAY_CURRENCY_ID = 1; // CRC — matches page.tsx's constant; see Global Constraints

export interface ConfirmPurchaseState {
  error: string | null;
}

export async function confirmPurchaseAction(
  shoppingListId: number,
  isShared: boolean,
  actualTotal: number,
): Promise<ConfirmPurchaseState> {
  const membership = await requireMembership();

  const parsedTotal = z.coerce.number().min(0, 'El monto gastado no puede ser negativo').safeParse(actualTotal);
  if (!parsedTotal.success) {
    return { error: parsedTotal.error.issues[0]?.message ?? 'Ingresá el monto gastado' };
  }

  const items = await getShoppingListItems(shoppingListId, membership.id, DISPLAY_CURRENCY_ID);
  if (items.length === 0) {
    return { error: 'La lista está vacía' };
  }

  try {
    await confirmShoppingList({
      shoppingListId,
      householdId: membership.id,
      items: items.map((item) => ({
        itemId: item.id,
        quantity: item.quantity_needed,
        unitPrice: item.unit_price,
        unitPriceCurrencyId: item.unit_price_currency_id,
      })),
      displayCurrencyId: DISPLAY_CURRENCY_ID,
      isShared,
      actualTotal: parsedTotal.data,
    });
  } catch {
    return { error: 'No se pudo confirmar la compra. Intentá de nuevo.' };
  }

  if (isShared) {
    try {
      await initSplit(shoppingListId, membership.id);
    } catch {
      // La compra ya se confirmó (inventario actualizado); solo falló la
      // inicialización de la división del gasto. No hay que decirle al usuario
      // que la compra falló ni pedirle que reintente confirmar.
    }
  }

  revalidatePath('/compras');
  return { error: null };
}

export interface GetSplitState {
  splits: ShoppingListSplitRecord[];
  error: string | null;
}

export async function getSplitAction(shoppingListId: number): Promise<GetSplitState> {
  const membership = await requireMembership();
  try {
    let splits = await getSplit(shoppingListId, membership.id);
    if (splits.length === 0) {
      const list = await getShoppingList(shoppingListId, membership.id, DISPLAY_CURRENCY_ID);
      if (list.status === 'confirmed' && list.is_shared === 1) {
        splits = await initSplit(shoppingListId, membership.id);
      }
    }
    return { splits, error: null };
  } catch {
    return { splits: [], error: 'No se pudo cargar la división del gasto.' };
  }
}

export interface UpdateSplitState {
  splits: ShoppingListSplitRecord[];
  error: string | null;
}

export async function updateSplitAction(
  shoppingListId: number,
  updates: Array<{ memberId: number; percentage: number }>,
): Promise<UpdateSplitState> {
  const membership = await requireMembership();

  if (updates.length === 0) {
    return { splits: [], error: 'Datos inválidos' };
  }

  try {
    const splits = await updateSplit({
      shoppingListId,
      householdId: membership.id,
      updates,
    });
    revalidatePath('/compras');
    return { splits, error: null };
  } catch {
    return { splits: [], error: 'Los porcentajes deben sumar 100%.' };
  }
}

export interface MarkSplitPaidState {
  split: ShoppingListSplitRecord | null;
  error: string | null;
}

export async function markSplitPaidAction(splitId: number, isPaid: boolean): Promise<MarkSplitPaidState> {
  const membership = await requireMembership();
  try {
    const split = await markSplitPaid({ splitId, householdId: membership.id, isPaid });
    revalidatePath('/compras/pagos');
    return { split, error: null };
  } catch {
    return { split: null, error: 'No se pudo actualizar el pago.' };
  }
}
