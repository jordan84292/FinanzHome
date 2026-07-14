import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface UserRecord extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface UserWithPasswordRecord extends UserRecord {
  password_hash: string;
}

export async function registerUser(params: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<UserRecord> {
  const rows = await callProcedure<UserRecord>('sp_user_register', [
    params.email,
    params.passwordHash,
    params.name,
  ]);
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<UserWithPasswordRecord | null> {
  const rows = await callProcedure<UserWithPasswordRecord>('sp_user_get_by_email', [email]);
  return rows[0] ?? null;
}
