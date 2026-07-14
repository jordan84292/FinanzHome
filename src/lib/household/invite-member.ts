import { randomBytes } from 'node:crypto';
import { createInvitation } from '@/lib/db/procedures/household';
import { sendInvitationEmail } from '@/lib/email/send-invitation';

const INVITATION_TTL_DAYS = 7;

export async function inviteHouseholdMember(params: {
  householdId: number;
  householdName: string;
  email: string;
  invitedByMemberId: number;
  appUrl: string;
}): Promise<{ emailSent: boolean }> {
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await createInvitation({
    householdId: params.householdId,
    email: params.email,
    token,
    invitedByMemberId: params.invitedByMemberId,
    expiresAt,
  });

  try {
    await sendInvitationEmail({
      to: params.email,
      householdName: params.householdName,
      inviteUrl: `${params.appUrl}/onboarding?invite=${token}`,
    });
    return { emailSent: true };
  } catch (error) {
    console.error('Error al enviar el correo de invitación:', error);
    return { emailSent: false };
  }
}
