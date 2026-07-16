import { randomBytes } from 'node:crypto';
import { getUserByEmail } from '@/lib/db/procedures/auth';
import { createPasswordResetToken } from '@/lib/db/procedures/password-reset';
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset';

const RESET_TTL_HOURS = 1;

export async function requestPasswordReset(params: { email: string; appUrl: string }): Promise<void> {
  const user = await getUserByEmail(params.email);
  if (!user) {
    // No revelamos si el correo existe o no (evita enumeración de cuentas).
    return;
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);

  await createPasswordResetToken({ userId: user.id, token, expiresAt });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: `${params.appUrl}/restablecer-password?token=${token}`,
    });
  } catch (error) {
    console.error('Error al enviar el correo de restablecimiento:', error);
  }
}
