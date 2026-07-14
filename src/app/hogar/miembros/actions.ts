'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { getHouseholdsForUser } from '@/lib/db/procedures/household';
import { inviteHouseholdMember } from '@/lib/household/invite-member';

const inviteSchema = z.object({ email: z.string().email() });

export interface InviteActionState {
  error: string | null;
  success: boolean;
}

export async function inviteMemberAction(
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión', success: false };
  }

  const parsed = inviteSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: 'Correo inválido', success: false };
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    return { error: 'No pertenecés a ningún hogar todavía', success: false };
  }

  await inviteHouseholdMember({
    householdId: membership.id,
    householdName: membership.name,
    email: parsed.data.email,
    invitedByMemberId: membership.member_id,
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  });

  return { error: null, success: true };
}
