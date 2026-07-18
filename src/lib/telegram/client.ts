import type { PendingReminderRecord } from '@/lib/db/procedures/reminders';

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }
}

export function buildReminderMessage(reminder: PendingReminderRecord): string {
  const amount = `${reminder.currency_symbol}${reminder.amount}`;
  const templates: Record<PendingReminderRecord['reminder_type'], string> = {
    due_soon: `Recordatorio: "${reminder.expense_name}" (${amount}) vence mañana ${reminder.due_date}.`,
    overdue_daily: `"${reminder.expense_name}" (${amount}) está vencido desde el ${reminder.due_date}. Ya te tocó pago, ponete al día.`,
    withdrawal: `Hoy es día de retirar fondos para "${reminder.expense_name}" (${amount}).`,
  };
  return templates[reminder.reminder_type];
}

export async function sendReminderTelegramMessage(reminder: PendingReminderRecord): Promise<boolean> {
  if (reminder.telegram_chat_id === null) {
    return false;
  }
  await sendTelegramMessage(reminder.telegram_chat_id, buildReminderMessage(reminder));
  return true;
}
