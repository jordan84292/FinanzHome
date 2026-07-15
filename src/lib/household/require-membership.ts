import { auth } from '@/auth';
import { getHouseholdsForUser, type HouseholdForUserRecord } from '@/lib/db/procedures/household';

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
