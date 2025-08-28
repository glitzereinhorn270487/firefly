// app/api/positions/manager/route.ts
import { NextResponse } from 'next/server';
import { getOpenPositions, closePosition, updatePosition } from '@/lib/store/positions';

export const runtime = 'nodejs';

export async function GET() {
  const now = Date.now();
  const MAX_AGE_MS = 60 * 60 * 1000; // 1h Zeitfenster als Fallback in V1

  const toClose: string[] = [];
  for (const p of getOpenPositions()) {
    // Beispiel-Regeln V1: „Positionsmanager darf immer auslaufen“
    // 1) Fallback: zu alt -> zu
    if (p.openedAt && now - p.openedAt > MAX_AGE_MS) toClose.push(p.id);
    // 2) Optional: Stop-Loss based on price difference (z.B. -30%)
    if (typeof p.entryPrice === 'number' && typeof p.lastPrice === 'number') {
      const drawdown = (p.lastPrice - p.entryPrice) / p.entryPrice;
      // Example: close if drawdown is worse than -30%
      if (drawdown <= -0.30) toClose.push(p.id);
    }
  }

  for (const id of toClose) closePosition(id, 'manager');
  // leichte Markierung fürs UI
  for (const p of getOpenPositions()) updatePosition(p.id, {});

  return NextResponse.json({ ok: true, closed: toClose.length });
}
