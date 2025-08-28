// app/api/settings/rules/route.ts
import { NextResponse } from 'next/server';
import * as Vol from '@/lib/store/redisStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  // globale MM-Parameter
  investUsd: 20,
  minInvestUsd: 15,
  maxPositions: 3,

  // Kategorie: LP-Burn Momentum (watch-only)
  lpBurn: {
    enabled: true,
    watchOnly: true,

    // Momentum-Gates
    windowSec: 70,
    uniqueBuyers: 5,     // Hinweis: aktuell nur als Platzhalter – wird serverseitig (watch-only) geloggt
    buysToSells: 2.0,
    minNetFlowUsd: 0,

    // Basis-Gates
    minVolUsd: 1000,
    minLiquidityUsd: 7500,
    priceMinChange: 0.03,
    priceMaxChange: 0.25,
    requireRevoke: true,

    // Exits
    tp1: 0.50,       // +50%
    tp1Size: 0.5,    // 50% realisieren
    trailPct: 0.10,  // 10% unter High-Water-Mark
    tp2: 1.50,       // +150% Close
    sl: 0.08,        // Fallback Stop-Loss
    maxHoldMin: 15,
  },

  // Beobachter (Raydium Pool / Revoke) – nur Logging
  watchers: {
    raydiumPoolCreate: { enabled: true },
    contractRevoke: { enabled: true },
    liquidityBurn: { enabled: true },
  },
};

function deepMerge(a: any, b: any): any {
  if (Array.isArray(a) && Array.isArray(b)) return b.slice();
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out: Record<string, any> = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  return b ?? a;
}

function currentRules() {
  const cur = Vol.get<any>('rules', {});
  return deepMerge(DEFAULTS, cur || {});
}

export async function GET() {
  const rules = currentRules();
  Vol.set('rules', rules); // ensure stored
  const active = Vol.getBoolean('bot.active', true);
  return NextResponse.json({ ok: true, active, rules });
}

export async function POST(req: Request) {
  let patch: any = {};
  try { patch = await req.json(); } catch {}

  const merged = deepMerge(currentRules(), patch || {});
  Vol.set('rules', merged);

  const active = Vol.getBoolean('bot.active', true);
  return NextResponse.json({ ok: true, active, rules: merged });
}
