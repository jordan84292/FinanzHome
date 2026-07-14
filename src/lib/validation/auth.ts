import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
});

export type RegisterInput = z.infer<typeof registerSchema>;
