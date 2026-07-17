import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHouseholdsForUser, listHouseholdMembers } from '@/lib/db/procedures/household';
import { listExpenseCategories, listRecurringExpenses } from '@/lib/db/procedures/recurring-expenses';
import { listCurrencies } from '@/lib/db/procedures/currency';
import { GastosClient } from './gastos-client';

export default async function GastosPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    redirect('/onboarding');
  }

  const [expenses, categories, members, currencies] = await Promise.all([
    listRecurringExpenses(membership.id, true),
    listExpenseCategories(),
    listHouseholdMembers(membership.id),
    listCurrencies(),
  ]);

  return (
    <GastosClient expenses={expenses} categories={categories} members={members} currencies={currencies} />
  );
}
