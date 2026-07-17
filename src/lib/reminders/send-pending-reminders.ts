import { getPendingReminders, logReminderSent } from '@/lib/db/procedures/reminders';
import { sendReminderTelegramMessage } from '@/lib/telegram/client';

export async function sendPendingReminders(today: string): Promise<{ total: number; sent: number }> {
  const pending = await getPendingReminders(today);
  let sent = 0;

  for (const reminder of pending) {
    try {
      const wasSent = await sendReminderTelegramMessage(reminder);
      if (wasSent) {
        await logReminderSent({
          occurrenceId: reminder.occurrence_id,
          memberId: reminder.member_id,
          reminderType: reminder.reminder_type,
          sentDate: today,
        });
        sent += 1;
      }
    } catch (error) {
      console.error(`Error al enviar recordatorio ${reminder.reminder_type} (occurrence ${reminder.occurrence_id}):`, error);
    }
  }

  return { total: pending.length, sent };
}
