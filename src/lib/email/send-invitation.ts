import { resend } from './resend-client';

export async function sendInvitationEmail(params: {
  to: string;
  householdName: string;
  inviteUrl: string;
}): Promise<void> {
  await resend.emails.send({
    from: 'FinanzHome <onboarding@resend.dev>',
    to: params.to,
    subject: `Te invitaron a ${params.householdName} en FinanzHome`,
    html: `<p>Te invitaron a unirte a <strong>${params.householdName}</strong> en FinanzHome.</p><p><a href="${params.inviteUrl}">Aceptar invitación</a></p>`,
  });
}
