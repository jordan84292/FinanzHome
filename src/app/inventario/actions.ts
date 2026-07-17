'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMembership } from '@/lib/household/require-membership';
import { createProduct, deactivateProduct, updateCurrentQuantity, updateProduct } from '@/lib/db/procedures/products';

export async function updateCurrentQuantityAction(productId: number, quantity: number): Promise<void> {
  const membership = await requireMembership();
  await updateCurrentQuantity(productId, membership.id, Math.max(0, quantity));
  revalidatePath('/inventario');
}

const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  categoryId: z.coerce.number().int().positive(),
  unitId: z.coerce.number().int().positive(),
  optimalQuantity: z.coerce.number().min(0),
  currentQuantity: z.coerce.number().min(0),
  defaultPrice: z.coerce.number().min(0).optional(),
  defaultPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface CreateProductState {
  error: string | null;
}

export async function createProductAction(
  _prevState: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const membership = await requireMembership();

  const parsed = createProductSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    unitId: formData.get('unitId'),
    optimalQuantity: formData.get('optimalQuantity'),
    currentQuantity: formData.get('currentQuantity') || 0,
    defaultPrice: formData.get('defaultPrice') || undefined,
    defaultPriceCurrencyId: formData.get('defaultPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await createProduct({
      householdId: membership.id,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      unitId: parsed.data.unitId,
      optimalQuantity: parsed.data.optimalQuantity,
      currentQuantity: parsed.data.currentQuantity,
      defaultPrice: parsed.data.defaultPrice ?? null,
      defaultPriceCurrencyId: parsed.data.defaultPriceCurrencyId ?? null,
      createdByMemberId: membership.member_id,
    });
  } catch {
    return { error: 'No se pudo guardar el producto. Verificá los datos e intentá de nuevo.' };
  }

  revalidatePath('/inventario');
  return { error: null };
}

const updateProductSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  categoryId: z.coerce.number().int().positive(),
  unitId: z.coerce.number().int().positive(),
  optimalQuantity: z.coerce.number().min(0),
  defaultPrice: z.coerce.number().min(0).optional(),
  defaultPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface UpdateProductState {
  error: string | null;
}

export async function updateProductAction(
  _prevState: UpdateProductState,
  formData: FormData,
): Promise<UpdateProductState> {
  const membership = await requireMembership();

  const parsed = updateProductSchema.safeParse({
    productId: formData.get('productId'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    unitId: formData.get('unitId'),
    optimalQuantity: formData.get('optimalQuantity'),
    defaultPrice: formData.get('defaultPrice') || undefined,
    defaultPriceCurrencyId: formData.get('defaultPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await updateProduct({
      productId: parsed.data.productId,
      householdId: membership.id,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      unitId: parsed.data.unitId,
      optimalQuantity: parsed.data.optimalQuantity,
      defaultPrice: parsed.data.defaultPrice ?? null,
      defaultPriceCurrencyId: parsed.data.defaultPriceCurrencyId ?? null,
    });
  } catch {
    return { error: 'No se pudo actualizar el producto. Es posible que ya no exista en tu hogar.' };
  }

  revalidatePath('/inventario');
  return { error: null };
}

export async function deactivateProductAction(productId: number): Promise<void> {
  const membership = await requireMembership();
  await deactivateProduct(productId, membership.id);
  revalidatePath('/inventario');
}
