import { randomBytes } from 'node:crypto';
import { createInvitation } from '@/lib/db/procedures/household';

const INVITATION_TTL_DAYS = 7;

export async function inviteHouseholdMember(params: {
  householdId: number;
  email: string;
  invitedByMemberId: number;
  appUrl: string;
}): Promise<{ inviteUrl: string }> {
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await createInvitation({
    householdId: params.householdId,
    email: params.email,
    token,
    invitedByMemberId: params.invitedByMemberId,
    expiresAt,
  });

  return { inviteUrl: `${params.appUrl}/onboarding?invite=${token}` };
}
