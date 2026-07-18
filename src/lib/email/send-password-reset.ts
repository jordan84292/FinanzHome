import { resend } from './resend-client';
import { renderEmailHtml, renderEmailButton } from './template';

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'FinanzHome <onboarding@resend.dev>',
    to: params.to,
    subject: 'Restablecé tu contraseña en FinanzHome',
    html: renderEmailHtml({
      heading: 'Restablecé tu contraseña',
      bodyHtml: `
        <p style="color: #A9A3C9; margin: 0 0 16px;">
          Pediste restablecer tu contraseña en FinanzHome. Si no fuiste vos, ignorá este correo.
        </p>
        ${renderEmailButton(params.resetUrl, 'Elegir nueva contraseña')}
      `,
    }),
  });

  if (error) {
    throw new Error(`Resend no pudo enviar el correo de restablecimiento: ${error.name} - ${error.message}`);
  }
}
