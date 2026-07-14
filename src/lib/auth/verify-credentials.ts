import { getUserByEmail } from '@/lib/db/procedures/auth';
import { verifyPassword } from './password';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) return null;

  return { id: String(user.id), email: user.email, name: user.name };
}
