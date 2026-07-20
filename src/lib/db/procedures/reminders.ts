import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export type ReminderType = 'due_soon' | 'due_today' | 'overdue_daily' | 'withdrawal';

export interface PendingReminderRecord extends RowDataPacket {
  reminder_type: ReminderType;
  occurrence_id: number;
  recurring_expense_id: number;
  member_id: number;
  expense_name: string;
  amount: number;
  currency_symbol: string;
  due_date: string;
  member_display_name: string;
  telegram_chat_id: number | null;
}

export async function getPendingReminders(today: string): Promise<PendingReminderRecord[]> {
  return callProcedure<PendingReminderRecord>('sp_reminder_get_pending', [today]);
}

export async function logReminderSent(params: {
  occurrenceId: number;
  memberId: number;
  reminderType: ReminderType;
  sentDate: string;
}): Promise<void> {
  await callProcedure('sp_reminder_log_sent', [
    params.occurrenceId,
    params.memberId,
    params.reminderType,
    params.sentDate,
  ]);
}
