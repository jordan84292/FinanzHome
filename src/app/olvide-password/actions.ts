'use server';

import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth/request-password-reset';

const emailSchema = z.string().email();

export interface RequestPasswordResetState {
  submitted: boolean;
}

export async function requestPasswordResetAction(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (parsed.success) {
    await requestPasswordReset({
      email: parsed.data,
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    });
  }
  return { submitted: true };
}
