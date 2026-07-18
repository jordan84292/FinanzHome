import { resend } from './resend-client';
import { renderEmailHtml, renderEmailButton } from './template';

export async function sendInvitationEmail(params: {
  to: string;
  householdName: string;
  inviteUrl: string;
}): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'FinanzHome <onboarding@resend.dev>',
    to: params.to,
    subject: `Te invitaron a ${params.householdName} en FinanzHome`,
    html: renderEmailHtml({
      heading: `Te invitaron a ${params.householdName}`,
      bodyHtml: `
        <p style="color: #A9A3C9; margin: 0 0 16px;">Sumate para llevar juntos las finanzas del hogar.</p>
        ${renderEmailButton(params.inviteUrl, 'Aceptar invitación')}
      `,
    }),
  });

  if (error) {
    throw new Error(`Resend no pudo enviar el correo de invitación: ${error.name} - ${error.message}`);
  }
}
