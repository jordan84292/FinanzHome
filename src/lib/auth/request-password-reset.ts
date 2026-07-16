import { randomBytes } from 'node:crypto';
import { getUserByEmail } from '@/lib/db/procedures/auth';
import { createPasswordResetToken } from '@/lib/db/procedures/password-reset';
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset';

const RESET_TTL_HOURS = 1;

// Tiempo mínimo de respuesta constante para mitigar un canal lateral de
// temporización: la ruta "cuenta inexistente" solo hace una lectura rápida,
// mientras que la ruta "cuenta existente" además escribe un token y espera
// el envío del correo, lo que la haría medible como más lenta si no se
// igualara el tiempo total de ambas rutas.
const MIN_RESPONSE_TIME_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performPasswordResetRequest(params: { email: string; appUrl: string }): Promise<void> {
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

export async function requestPasswordReset(params: { email: string; appUrl: string }): Promise<void> {
  // Aseguramos un tiempo de respuesta mínimo constante, exista o no la
  // cuenta, para no filtrar por temporización cuánto trabajo real se hizo
  // (creación de token + envío de correo solo ocurre si la cuenta existe).
  await Promise.all([performPasswordResetRequest(params), delay(MIN_RESPONSE_TIME_MS)]);
}
