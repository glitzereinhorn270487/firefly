import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mask = (s: any) => {
  if (!s) return '';
  const v = String(s);
  return v.length <= 8 ? '*'.repeat(v.length) : v.slice(0, 4) + '…' + v.slice(-4);
};

function allowUnsigned() {
  const v = String(process.env.QN_ALLOW_UNSIGNED ?? '');
  return v === '1' || v.toLowerCase() === 'true';
}

function expectedSecret() {
  return String(process.env.WEBHOOK_SECRET ?? '') || String(process.env.QN_STREAMS_TOKEN ?? '');
}

export async function POST(req: Request) {
  const auth = String(req.headers.get('authorization') ?? '');
  const secret = expectedSecret();

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: 'BAD_TOKEN', expectedPreview: mask(secret), allowUnsigned: allowUnsigned() }, { status: 401 });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (err) {
    // falls kein JSON -> roher Text
    try {
      const text = await req.text();
      payload = text ? { raw: text } : {};
    } catch {
      payload = {};
    }
  }

  const eventType = payload?.eventType ?? payload?.type ?? 'unknown';
  const signature = payload?.signature ?? null;
  const slot = payload?.slot ?? null;

  if (!signature) {
    // akzeptiere auch papier‑Runs ohne signature, aber logge
    console.warn('[webhook] missing signature on payload', { eventType });
  }

  if ((process.env.MODE ?? 'paper') === 'paper') {
    console.log(`[PAPER] ${eventType} - ${signature} slot:${slot}`, payload?.txSummary ? { fee: payload.txSummary.fee } : null);
  } else {
    console.log(`[LIVE] ${eventType} - queued for execution`, signature);
    // Live‑Handling kann hier später implementiert werden
  }

  return NextResponse.json({ ok: true, eventType, signature, slot });
}