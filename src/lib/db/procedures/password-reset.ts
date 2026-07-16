import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface PasswordResetTokenRecord extends RowDataPacket {
  id: number;
  user_id: number;
  token: string;
  status: 'pending' | 'used' | 'expired';
  expires_at: string;
  created_at: string;
}

export async function createPasswordResetToken(params: {
  userId: number;
  token: string;
  expiresAt: Date;
}): Promise<PasswordResetTokenRecord> {
  const rows = await callProcedure<PasswordResetTokenRecord>('sp_password_reset_token_create', [
    params.userId,
    params.token,
    params.expiresAt,
  ]);
  return rows[0];
}

export async function checkPasswordResetToken(token: string): Promise<PasswordResetTokenRecord> {
  const rows = await callProcedure<PasswordResetTokenRecord>('sp_password_reset_token_check', [token]);
  return rows[0];
}

export interface PasswordResetCompletedUserRecord extends RowDataPacket {
  id: number;
  email: string;
  name: string;
}

export async function completePasswordReset(params: {
  token: string;
  newPasswordHash: string;
}): Promise<PasswordResetCompletedUserRecord> {
  const rows = await callProcedure<PasswordResetCompletedUserRecord>('sp_password_reset_complete', [
    params.token,
    params.newPasswordHash,
  ]);
  return rows[0];
}
