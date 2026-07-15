'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMembership } from '@/lib/household/require-membership';
import {
  addShoppingListItem,
  deleteShoppingListItem,
  updateShoppingListItem,
} from '@/lib/db/procedures/shopping-list';

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
