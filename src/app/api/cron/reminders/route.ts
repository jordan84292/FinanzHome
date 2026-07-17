import { NextResponse } from 'next/server';
import { sendPendingReminders } from '@/lib/reminders/send-pending-reminders';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const result = await sendPendingReminders(today);
  return NextResponse.json(result);
}
