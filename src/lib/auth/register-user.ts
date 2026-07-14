import { getUserByEmail, registerUser, type UserRecord } from '@/lib/db/procedures/auth';
import { hashPassword } from './password';

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Ya existe una cuenta con ese correo');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export async function registerNewUser(params: {
  email: string;
  password: string;
  name: string;
}): Promise<UserRecord> {
  const existing = await getUserByEmail(params.email);
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }
  const passwordHash = await hashPassword(params.password);
  return registerUser({ email: params.email, passwordHash, name: params.name });
}
