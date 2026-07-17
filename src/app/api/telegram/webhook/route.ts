import { NextResponse } from 'next/server';
import { linkTelegramChat } from '@/lib/db/procedures/telegram';

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id: number };
  };
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const text = update.message?.text;
  const chatId = update.message?.chat?.id;

  if (text?.startsWith('/start ') && chatId !== undefined) {
    const token = text.slice('/start '.length).trim();
    await linkTelegramChat(token, chatId);
  }

  return NextResponse.json({ ok: true });
}
