import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHouseholdsForUser } from '@/lib/db/procedures/household';
import { listCategories, listProducts, listUnits } from '@/lib/db/procedures/products';
import { listCurrencies } from '@/lib/db/procedures/currency';
import { InventoryClient } from './inventory-client';

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    redirect('/onboarding');
  }

  const [products, categories, units, currencies] = await Promise.all([
    listProducts(membership.id),
    listCategories(),
    listUnits(),
    listCurrencies(),
  ]);

  return (
    <InventoryClient products={products} categories={categories} units={units} currencies={currencies} />
  );
}
