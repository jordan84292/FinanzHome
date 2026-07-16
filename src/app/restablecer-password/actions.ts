'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/password';
import { completePasswordReset } from '@/lib/db/procedures/password-reset';

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export interface CompletePasswordResetState {
  error: string | null;
}

export async function completePasswordResetAction(
  _prevState: CompletePasswordResetState,
  formData: FormData,
): Promise<CompletePasswordResetState> {
  const parsed = resetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await completePasswordReset({ token: parsed.data.token, newPasswordHash: passwordHash });
  } catch {
    return { error: 'Este enlace no es válido o ya expiró. Pedí uno nuevo.' };
  }

  redirect('/login');
}
