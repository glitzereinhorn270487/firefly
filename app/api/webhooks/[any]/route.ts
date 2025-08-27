// T0_STREAMS_CATCHALL_V8.ts
import { NextResponse } from 'next/server';
import { readLimitedText, PayloadTooLarge } from '@/lib/webhook/readLimited';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params?: { any?: string[] } };

// ---------- helpers ----------
const norm = (s: any) => String(s ?? '');
const stripQuotes = (s: string) => s.replace(/^['"]|['"]$/g, '');
const stripCtl = (s: string) =>
  s.replace(/[
\u0000-\u001F\u007F]/g, '').replace(/[
\u200B-\u200D\u2060\uFEFF]/g, '');
const hardClean = (s: any) => stripCtl(stripQuotes(norm(s).trim()));
const mask = (s: any) => {
  const v = hardClean(s);
  if (!v) return '';
  return v.length <= 8 ? '*'.repeat(v.length) : v.slice(0,4)+'…'+v.slice(-4);
};
const maskBearer = (v: any) => {
  const x = hardClean(v);
  const m = x.match(/^\s*(Bearer)\s+(.+)$/i);
  return m ? `${m[1]} ${mask(m[2])}` : mask(x);
};

const eq = (a: string, b: string) => a === b;

function allowUnsigned() {
  const v = hardClean(process.env.QN_ALLOW_UNSIGNED);
  return v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
}

function expectedFor(endpoint: string) {
  const e = (endpoint || '').toLowerCase();
  if (e === 'pumpfun') return hardClean(process.env.QN_PUMPFUN_TOKEN) || hardClean(process.env.QN_STREAMS_TOKEN);
  if (e === 'quicknode') return hardClean(process.env.QN_STREAMS_TOKEN) || hardClean(process.env.QN_PUMPFUN_TOKEN);
  return hardClean(process.env.QN_STREAMS_TOKEN) || hardClean(process.env.QN_PUMPFUN_TOKEN);
}

function segsFromCtxOrUrl(req: Request, ctx?: Ctx): string[] {
  const any = (ctx as any)?.params?.any;
  if (Array.isArray(any)) return any;
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const i = parts.indexOf('streams');
  return i >= 0 ? parts.slice(i + 1) : [];
}

function extractCandidates(req: Request): { list: string[], rawAuth: string, bearer: string } {
  const url = new URL(req.url);
  const h = req.headers;

  const rawAuth = hardClean(h.get('authorization'));
  let bearer = '';
  const m = rawAuth.match(/^\s*Bearer\s+(.+)$/i);
  if (m) bearer = hardClean(m[1]);

  const list = [
    bearer,
    rawAuth, // ganzer Authorization-Wert als Kandidat
    hardClean(h.get('x-qn-token')),
    hardClean(h.get('x-quicknode-token')),
    hardClean(h.get('x-security-token')),
    hardClean(h.get('x-webhook-token')),
    hardClean(h.get('x-verify-token')),
    hardClean(h.get('x-token')),
    hardClean(h.get('x-auth-token')),
    hardClean(h.get('x-api-key')),
    hardClean(h.get('quicknode-token')),
    hardClean(url.searchParams.get('token')),
  ].filter(Boolean);

  return { list, rawAuth, bearer };
}

function tokenOkAndWhy(req: Request, endpoint: string) {
  const want = expectedFor(endpoint);
  const { list, rawAuth, bearer } = extractCandidates(req);

  const result = {
    ok: false,
    want,
    wantLen: want.length,
    bearerLen: bearer.length,
    rawAuthLen: rawAuth.length,
    matched: {
      exact: false,
      bearerExact: false,
      rawAuthExact: false,
    }
  };

  if (!want) {
    result.ok = true; // kein Secret gesetzt -> durchlassen
    return result;
  }

  // 1) Kandidaten exakt
  if (list.includes(want)) {
    result.ok = true;
    result.matched.exact = true;
    return result;
  }

  // 2) "Bearer <want>" exakt
  if (list.includes(`Bearer ${want}`)) {
    result.ok = true;
    result.matched.bearerExact = true;
    return result;
  }

  // 3) letzter Rettungsring (Dev)
  if (allowUnsigned()) {
    result.ok = true;
    return result;
  }

  // 4) rawAuth exakt? (zur Diagnose)
  if (eq(rawAuth, want)) result.matched.rawAuthExact = true;

  return result;
}

// ---------- handlers ----------
export async function GET(req: Request, ctx: Ctx) {
  const segs = segsFromCtxOrUrl(req, ctx);
  const endpoint = (segs[0] || '(root)').toLowerCase();
  const url = new URL(req.url);
  const inspect = url.searchParams.get('inspect') === '1';

  if (inspect) {
    const names = ['authorization','x-qn-token','x-quicknode-token','x-security-token','x-webhook-token','x-verify-token','x-token','x-auth-token','x-api-key','quicknode-token'];
    const seen: Record<string,string> = {};
    for (const n of names) {
      const v = req.headers.get(n);
      if (v) seen[n] = n === 'authorization' ? maskBearer(v) : mask(v);
    }
    const want = expectedFor(endpoint);
    return NextResponse.json({
      ok: true,
      mode: 'inspect',
      endpoint,
      expectedSet: !!want,
      expectedPreview: mask(want),
      allowUnsigned: allowUnsigned(),
      seenHeaders: seen,
    });
  }
  return NextResponse.json({ ok: true, endpoint, ready: true });
}

export async function POST(req: Request, ctx: Ctx) {
  const segs = segsFromCtxOrUrl(req, ctx);
  const endpoint = (segs[0] || '(root)').toLowerCase();

  // Header-Vorschau in Logs
  try {
    const names = ['authorization','x-qn-token','x-quicknode-token','x-security-token','x-webhook-token','x-verify-token','x-token','x-auth-token','x-api-key','quicknode-token'];
    const preview: Record<string,string> = {};
    for (const n of names) preview[n] = n==='authorization' ? maskBearer(req.headers.get(n)) : mask(req.headers.get(n));
    console.log('[streams][hdr]', endpoint, preview);
  } catch {}

  const check = tokenOkAndWhy(req, endpoint);

  // roher Body mit Limit lesen (-> verhindert OOM / zu große Payloads)
  let raw = '';
  try {
    raw = await readLimitedText(req, 1_000_000); // 1 MB Limit - anpassen falls nötig
  } catch (err) {
    if (err instanceof PayloadTooLarge) {
      return new NextResponse(JSON.stringify({ ok:false, reason:'PAYLOAD_TOO_LARGE' }), {
        status: 413,
        headers: { 'content-type': 'application/json' }
      });
    }
    // falls anderes Problem beim Lesen, logge und setze raw leer
    console.warn('[streams] error reading body', err);
    raw = '';
  }

  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch (e) {
    // falls kein JSON: preserve as raw
    payload = { raw };
  }

  if (check.ok) {
    try {
      const mod: any = await import('@/lib/paper/engine');
      const wh = mod.onWebhook || mod.handleWebhook || mod.webhook;
      if (typeof wh === 'function') await wh({ source: endpoint, path: segs.join('/'), payload });
      const tickFn = mod.onTick || mod.tick || mod.default;
      if (typeof tickFn === 'function') {
        await tickFn({
          mint: payload?.mint || payload?.tokenMint || payload?.symbol || 'UNKNOWN',
          symbol: payload?.symbol || payload?.mint || 'UNK',
          priceUsd: Number(payload?.priceUsd ?? payload?.usd ?? payload?.amountUsd) || undefined,
          volumeUsd1m: Number(payload?.vol1m || payload?.volumeUsd1m || 0) || 0,
          volumeUsd5m: Number(payload?.vol5m || payload?.volumeUsd5m || 0) || 0,
          txBuys1m: Number(payload?.buys1m || 0) || 0,
          txSells1m: Number(payload?.sells1m || 0) || 0,
        });
      }
    } catch (err) {
      // Fehler in Engine sollten geloggt werden, damit CI/Prod nicht silent failt
      console.error('[streams] engine error', err);
    }
    return NextResponse.json({ ok:true, endpoint });
  }

  // Diagnose-Log (maskiert)
  try {
    console.log('[streams][cmp]', endpoint, {
      want: mask(check.want),
      wantLen: check.wantLen,
      matched: check.matched,
    });
  } catch {}

  return new NextResponse(JSON.stringify({
    ok:false, reason:'BAD_TOKEN',
    expectedPreview: mask(check.want),
    allowUnsigned: allowUnsigned(),
  }), { status: 401, headers: {'content-type':'application/json'} });
}