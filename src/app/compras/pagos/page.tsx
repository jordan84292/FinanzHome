import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHouseholdsForUser } from '@/lib/db/procedures/household';
import { listPendingPayments } from '@/lib/db/procedures/shopping-list-splits';
import { PagosPendientesClient } from './pagos-client';

export default async function PagosPendientesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    redirect('/onboarding');
  }

  const payments = await listPendingPayments(membership.id);

  return <PagosPendientesClient payments={payments} />;
}
