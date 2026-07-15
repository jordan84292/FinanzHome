import { z } from 'zod';

export const createHouseholdSchema = z.object({
  name: z.string().min(1, 'El nombre del hogar es obligatorio').max(150),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  displayName: z.string().min(1, 'El nombre es obligatorio').max(150),
});
