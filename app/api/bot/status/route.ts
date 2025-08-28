import { NextResponse } from 'next/server';
import * as KV from '@/lib/store/redisStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  let active = false;
  try {
    // getBoolean bevorzugen, sonst fallback auf get/kvGet
    if (typeof (KV as any).getBoolean === 'function') {
      active = !!(KV as any).getBoolean('bot.active', false);
    } else if (typeof (KV as any).get === 'function') {
      active = !!(KV as any).get('bot.active');
    } else if (typeof (KV as any).kvGet === 'function') {
      active = !!(KV as any).kvGet('bot.active');
    }
  } catch {}

  const status = active ? 'active' : 'inactive';
  console.info('[bot][status]', { active });

  return NextResponse.json({ ok: true, status, active }, { headers: corsHeaders() });
}
