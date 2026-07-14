'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { registerSchema } from '@/lib/validation/auth';
import { registerNewUser, EmailAlreadyRegisteredError } from '@/lib/auth/register-user';

export interface RegisterActionState {
  error: string | null;
}

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await registerNewUser(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return { error: error.message };
    }
    throw error;
  }

  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect('/onboarding');
}
