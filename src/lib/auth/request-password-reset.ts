import { randomBytes } from 'node:crypto';
import { after } from 'next/server';
import { getUserByEmail } from '@/lib/db/procedures/auth';
import { createPasswordResetToken } from '@/lib/db/procedures/password-reset';
import { getTelegramStatus } from '@/lib/db/procedures/telegram';
import { sendTelegramMessage } from '@/lib/telegram/client';

const RESET_TTL_HOURS = 1;

// Tiempo mínimo de respuesta constante para mitigar un canal lateral de
// temporización: la ruta "cuenta inexistente" solo hace una lectura rápida,
// mientras que la ruta "cuenta existente" además escribe un token y espera
// el envío del mensaje, lo que la haría medible como más lenta si no se
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

  const telegramStatus = await getTelegramStatus(user.id);
  if (!telegramStatus.is_linked || telegramStatus.telegram_chat_id === null) {
    // Tampoco revelamos si la cuenta tiene Telegram vinculado o no — el
    // llamador siempre ve la misma respuesta genérica sin importar esta rama.
    return;
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);

  await createPasswordResetToken({ userId: user.id, token, expiresAt });

  // No se espera (`await`) el envío acá: hacerlo bloquearía la respuesta hasta
  // que la API de Telegram responda, haciendo que la ruta "cuenta existente y
  // vinculada" tarde según esa latencia y reabriendo el canal lateral de
  // temporización que el `Promise.all([..., delay(500)])` de abajo existe
  // para cerrar. Se programa con `after()` para que corra tras enviar la
  // respuesta, sin arriesgar que quede colgando en un entorno serverless.
  after(async () => {
    try {
      await sendTelegramMessage(
        telegramStatus.telegram_chat_id!,
        `Pediste restablecer tu contraseña en FinanzHome. Elegí una nueva acá: ${params.appUrl}/restablecer-password?token=${token}\n\nSi no fuiste vos, ignorá este mensaje.`,
      );
    } catch (error) {
      console.error('Error al enviar el mensaje de restablecimiento por Telegram:', error);
    }
  });
}

export async function requestPasswordReset(params: { email: string; appUrl: string }): Promise<void> {
  // Aseguramos un tiempo de respuesta mínimo constante, exista o no la cuenta
  // y esté o no vinculada a Telegram, para no filtrar por temporización
  // cuánto trabajo real se hizo (creación de token + envío solo ocurre si la
  // cuenta existe Y tiene Telegram vinculado).
  await Promise.all([performPasswordResetRequest(params), delay(MIN_RESPONSE_TIME_MS)]);
}
