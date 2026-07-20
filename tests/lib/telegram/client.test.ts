import { describe, expect, it } from 'vitest';
import { buildReminderMessage } from '@/lib/telegram/client';
import type { PendingReminderRecord } from '@/lib/db/procedures/reminders';

type ReminderFields = Omit<PendingReminderRecord, keyof import('mysql2').RowDataPacket>;

function makeReminder(overrides: Partial<ReminderFields>): PendingReminderRecord {
  const fields: ReminderFields = {
    reminder_type: 'due_soon',
    occurrence_id: 1,
    recurring_expense_id: 1,
    member_id: 1,
    expense_name: 'Alquiler',
    amount: 150000,
    currency_symbol: '₡',
    due_date: '2026-07-20',
    member_display_name: 'Jordan',
    telegram_chat_id: 123,
    ...overrides,
  };
  return fields as unknown as PendingReminderRecord;
}

describe('buildReminderMessage', () => {
  it('builds a due_soon message mentioning the expense name, amount, and due date', () => {
    const message = buildReminderMessage(makeReminder({ reminder_type: 'due_soon' }));
    expect(message).toContain('Alquiler');
    expect(message).toContain('₡150000');
    expect(message).toContain('2026-07-20');
  });

  it('builds a due_today message mentioning the expense name and amount', () => {
    const message = buildReminderMessage(makeReminder({ reminder_type: 'due_today' }));
    expect(message).toContain('Hoy');
    expect(message).toContain('Alquiler');
  });

  it('builds an overdue_daily message that reads as a nag, not a due-soon notice', () => {
    const message = buildReminderMessage(makeReminder({ reminder_type: 'overdue_daily' }));
    expect(message).toContain('vencido');
    expect(message).toContain('Alquiler');
  });

  it('builds a withdrawal message distinct from the other two types', () => {
    const message = buildReminderMessage(makeReminder({ reminder_type: 'withdrawal' }));
    expect(message).toContain('retirar fondos');
    expect(message).toContain('Alquiler');
  });
});
