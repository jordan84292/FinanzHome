'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createHousehold, acceptInvitation } from '@/lib/db/procedures/household';
import { createHouseholdSchema, acceptInvitationSchema } from '@/lib/validation/onboarding';

export interface OnboardingActionState {
  error: string | null;
}

export async function createHouseholdAction(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión' };
  }

  const parsed = createHouseholdSchema.safeParse({
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  await createHousehold({
    name: parsed.data.name,
    creatorUserId: Number(session.user.id),
    creatorDisplayName: session.user.name ?? 'Miembro',
  });

  redirect('/');
}

export async function acceptInvitationAction(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión' };
  }

  const parsed = acceptInvitationSchema.safeParse({
    token: formData.get('token'),
    displayName: formData.get('displayName'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await acceptInvitation({
      token: parsed.data.token,
      userId: Number(session.user.id),
      displayName: parsed.data.displayName,
    });
  } catch {
    return { error: 'La invitación no es válida o ya expiró' };
  }

  redirect('/');
}
