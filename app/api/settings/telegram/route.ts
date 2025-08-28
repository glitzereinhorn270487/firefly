import { NextResponse } from 'next/server';
import { kvGet, kvSet } from '@/lib/store/redisStore';

const KEY = 'settings:telegram';
export const runtime = 'nodejs';

export async function GET() {
  const defaults = {
    global: true,
    categories: { signals: true, buy: true, sell: true, startstop: true, risk: true, pnl: true },
    events: { newSignal: true, entry: true, exit: true, stopLoss: true, warning: true, dailyPnl: true },
  };
  const settings = (await kvGet<typeof defaults>(KEY)) ?? defaults;
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const next = {
    global: !!body.global,
    categories: { signals: true, buy: true, sell: true, startstop: true, risk: true, pnl: true, ...(body.categories || {}) },
    events: { newSignal: true, entry: true, exit: true, stopLoss: true, warning: true, dailyPnl: true, ...(body.events || {}) },
  };
  await kvSet(KEY, next);
  return NextResponse.json({ ok: true });
}