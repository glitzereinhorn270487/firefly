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

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const level = String(body?.level ?? 'standard');
  const status = 'active';

  // Best-effort: in volatile Store setzen (beide Varianten abdecken)
  try { (KV as any).set?.('bot.active', true); } catch {}
  try { (KV as any).kvSet?.('bot.active', true); } catch {}
  try { (KV as any).kvSet?.('bot:status', { status, level }); } catch {}

  console.info('[bot][start]', { level });

  return NextResponse.json({ ok: true, status, level }, { headers: corsHeaders() });
}

export async function GET() {
  // alias: GET auf /start aktiviert ebenfalls
  return POST(new Request(''));
}
