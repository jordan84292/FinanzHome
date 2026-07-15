import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export type PaymentFrequency = 'weekly' | 'semimonthly' | 'monthly';

export interface UserProfileRecord extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  payment_frequency: PaymentFrequency | null;
  payment_weekday: number | null;
  payment_day: number | null;
}

export async function getUserProfile(userId: number): Promise<UserProfileRecord | null> {
  const rows = await callProcedure<UserProfileRecord>('sp_user_get_profile', [userId]);
  return rows[0] ?? null;
}

export async function updatePaymentSchedule(params: {
  userId: number;
  paymentFrequency: PaymentFrequency;
  paymentWeekday: number | null;
  paymentDay: number | null;
}): Promise<UserProfileRecord> {
  const rows = await callProcedure<UserProfileRecord>('sp_user_update_payment_schedule', [
    params.userId,
    params.paymentFrequency,
    params.paymentWeekday,
    params.paymentDay,
  ]);
  return rows[0];
}
