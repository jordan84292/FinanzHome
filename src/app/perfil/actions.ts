'use server';

import { z } from 'zod';
import { auth, signOut } from '@/auth';
import { updatePaymentSchedule } from '@/lib/db/procedures/profile';

const paymentScheduleSchema = z.discriminatedUnion('paymentFrequency', [
  z.object({
    paymentFrequency: z.literal('weekly'),
    paymentWeekday: z.coerce.number().int().min(1).max(7),
  }),
  z.object({
    paymentFrequency: z.literal('monthly'),
    paymentDay: z.coerce.number().int().min(1).max(31),
  }),
  z.object({
    paymentFrequency: z.literal('semimonthly'),
  }),
]);

export interface UpdatePaymentScheduleState {
  error: string | null;
  success: boolean;
}

export async function updatePaymentScheduleAction(
  _prevState: UpdatePaymentScheduleState,
  formData: FormData,
): Promise<UpdatePaymentScheduleState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión', success: false };
  }

  const raw = {
    paymentFrequency: formData.get('paymentFrequency'),
    paymentWeekday: formData.get('paymentWeekday') || undefined,
    paymentDay: formData.get('paymentDay') || undefined,
  };
  const parsed = paymentScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Completá los datos correctamente', success: false };
  }

  try {
    await updatePaymentSchedule({
      userId: Number(session.user.id),
      paymentFrequency: parsed.data.paymentFrequency,
      paymentWeekday: parsed.data.paymentFrequency === 'weekly' ? parsed.data.paymentWeekday : null,
      paymentDay: parsed.data.paymentFrequency === 'monthly' ? parsed.data.paymentDay : null,
    });
  } catch {
    return { error: 'No se pudo guardar. Intentá de nuevo.', success: false };
  }

  return { error: null, success: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
