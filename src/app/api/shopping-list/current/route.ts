import { NextResponse } from 'next/server';
import { requireMembership } from '@/lib/household/require-membership';
import {
  generateOrGetShoppingList,
  getShoppingList,
  getShoppingListItems,
} from '@/lib/db/procedures/shopping-list';

const DISPLAY_CURRENCY_ID = 1; // CRC — coincide con /compras/page.tsx

export async function GET() {
  try {
    const membership = await requireMembership();
    const generated = await generateOrGetShoppingList(membership.id, membership.member_id);

    const [list, items] = await Promise.all([
      getShoppingList(generated.id, membership.id, DISPLAY_CURRENCY_ID),
      getShoppingListItems(generated.id, membership.id, DISPLAY_CURRENCY_ID),
    ]);

    return NextResponse.json({ list, items });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la lista de compras' }, { status: 401 });
  }
}
