import { NextResponse } from 'next/server';
import * as KV from '@/lib/store/redisStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST() {
  const status = 'inactive';

  try { (KV as any).set?.('bot.active', false); } catch {}
  try { (KV as any).kvSet?.('bot.active', false); } catch {}
  try { (KV as any).kvSet?.('bot:status', { status }); } catch {}

  console.info('[bot][stop]');

  return NextResponse.json({ ok: true, status }, { headers: corsHeaders() });
}

export async function GET() {
  // alias: GET auf /stop stoppt ebenfalls
  return POST();
}
