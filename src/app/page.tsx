import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHouseholdsForUser } from '@/lib/db/procedures/household';
import { getExpenseByCategory, getMemberBalances, getMonthlyTrend } from '@/lib/db/procedures/dashboard';
import { DashboardClient } from './dashboard-client';

const DISPLAY_CURRENCY_ID = 1; // CRC — mismo default que /compras y /gastos
const MONTHS_BACK = 5;

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    redirect('/onboarding');
  }

  const today = new Date().toISOString().slice(0, 10);

  const [byCategory, monthlyTrend, memberBalances] = await Promise.all([
    getExpenseByCategory(membership.id, today, DISPLAY_CURRENCY_ID),
    getMonthlyTrend(membership.id, MONTHS_BACK, DISPLAY_CURRENCY_ID),
    getMemberBalances(membership.id, DISPLAY_CURRENCY_ID),
  ]);

  return (
    <DashboardClient byCategory={byCategory} monthlyTrend={monthlyTrend} memberBalances={memberBalances} />
  );
}
