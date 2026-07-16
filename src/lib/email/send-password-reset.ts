import { resend } from './resend-client';

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'FinanzHome <onboarding@resend.dev>',
    to: params.to,
    subject: 'Restablecé tu contraseña en FinanzHome',
    html: `<p>Pediste restablecer tu contraseña en FinanzHome.</p><p><a href="${params.resetUrl}">Elegir nueva contraseña</a></p><p>Si no fuiste vos, ignorá este correo.</p>`,
  });

  if (error) {
    throw new Error(`Resend no pudo enviar el correo de restablecimiento: ${error.name} - ${error.message}`);
  }
}
