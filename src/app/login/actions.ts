'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

export interface LoginActionState {
  error: string | null;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: 'Ingresá tu correo y contraseña' };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Correo o contraseña incorrectos' };
    }
    throw error;
  }

  redirect('/onboarding');
}
