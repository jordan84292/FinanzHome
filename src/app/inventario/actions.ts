'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getHouseholdsForUser, type HouseholdForUserRecord } from '@/lib/db/procedures/household';
import { updateCurrentQuantity } from '@/lib/db/procedures/products';

export async function requireMembership(): Promise<HouseholdForUserRecord> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No autenticado');
  }
  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    throw new Error('No pertenecés a ningún hogar todavía');
  }
  return membership;
}

export async function updateCurrentQuantityAction(productId: number, quantity: number): Promise<void> {
  const membership = await requireMembership();
  await updateCurrentQuantity(productId, membership.id, Math.max(0, quantity));
  revalidatePath('/inventario');
}
