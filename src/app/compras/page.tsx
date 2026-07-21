import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHouseholdsForUser, listHouseholdMembers } from '@/lib/db/procedures/household';
import { listCurrencies } from '@/lib/db/procedures/currency';
import { listProducts } from '@/lib/db/procedures/products';
import {
  generateOrGetShoppingList,
  getShoppingList,
  getShoppingListItems,
} from '@/lib/db/procedures/shopping-list';
import { ShoppingListClient } from './shopping-list-client';

const DISPLAY_CURRENCY_ID = 1; // CRC — see Global Constraints for the fixed-ID rationale

export default async function ComprasPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    redirect('/onboarding');
  }

  const generated = await generateOrGetShoppingList(membership.id, membership.member_id);

  const [list, items, products, currencies, members] = await Promise.all([
    getShoppingList(generated.id, membership.id, DISPLAY_CURRENCY_ID),
    getShoppingListItems(generated.id, membership.id, DISPLAY_CURRENCY_ID),
    listProducts(membership.id),
    listCurrencies(),
    listHouseholdMembers(membership.id),
  ]);

  const displayCurrency = currencies.find((c) => c.id === DISPLAY_CURRENCY_ID);

  return (
    <ShoppingListClient
      list={list}
      items={items}
      products={products}
      currencies={currencies}
      displayCurrencySymbol={displayCurrency?.symbol ?? ''}
      members={members}
      currentMemberId={membership.member_id}
    />
  );
}
