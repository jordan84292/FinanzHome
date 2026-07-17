import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface TelegramStatusRecord extends RowDataPacket {
  is_linked: number;
  telegram_chat_id: number | null;
}

export async function setTelegramLinkToken(userId: number, token: string): Promise<void> {
  await callProcedure('sp_user_set_telegram_link_token', [userId, token]);
}

export async function linkTelegramChat(token: string, chatId: number): Promise<number | null> {
  const rows = await callProcedure<{ user_id: number | null } & RowDataPacket>(
    'sp_user_link_telegram_chat',
    [token, chatId],
  );
  return rows[0]?.user_id ?? null;
}

export async function getTelegramStatus(userId: number): Promise<TelegramStatusRecord> {
  const rows = await callProcedure<TelegramStatusRecord>('sp_user_get_telegram_status', [userId]);
  return rows[0];
}
