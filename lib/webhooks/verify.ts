import crypto from 'crypto';
import zlib from 'zlib';

export type QnVerifyResult = { ok: boolean; reason?: string; payloadText?: string };

function pickSecret() {
  // Akzeptiere getrennte Tokens pro Stream ODER gemeinsamen Token
  return (
    process.env.QN_PUMPFUN_TOKEN ||
    process.env.QN_RAYDIUM_TOKEN ||
    process.env.QN_WEBHOOK_TOKEN ||
  
    ''
  );
}

export async function verifyQuickNode(req: Request): Promise<QnVerifyResult> {
  const secret = pickSecret();
  const devBypass = process.env.QN_ALLOW_UNSIGNED === '1';

  const h = req.headers;
  // Manche UIs senden QuickNode-Header mit anderem Präfix – mach es tolerant
  const nonce = h.get('x-qn-nonce') || h.get('x-quicknode-nonce') || h.get('x-nonce');
  const ts    = h.get('x-qn-timestamp') || h.get('x-quicknode-timestamp') || h.get('x-timestamp');
  const sig   = h.get('x-qn-signature') || h.get('x-quicknode-signature') || h.get('x-signature');

  if (!secret) return { ok: devBypass, reason: 'NO_SECRET' };
  if (!nonce || !ts || !sig) return { ok: devBypass, reason: 'MISSING_HEADERS' };

  try {
    const encoding = (h.get('content-encoding') || '').toLowerCase();
    let buf = Buffer.from(await req.arrayBuffer());
    if (encoding.includes('gzip')) {
      try { buf = zlib.gunzipSync(buf); } catch { return { ok: false, reason: 'GZIP_DECODE_FAILED' }; }
    }
    const payload = buf.toString('utf8');
    const data = `${nonce}${ts}${payload}`;

    const mac = crypto.createHmac('sha256', Buffer.from(secret));
    mac.update(Buffer.from(data));
    const expected = mac.digest('hex');

    // timing-safe Vergleich (hex)
    const ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(sig), 'hex'));
    return ok ? { ok: true, payloadText: payload } : { ok: false, reason: 'BAD_SIGNATURE', payloadText: payload };
  } catch {
    return { ok: devBypass, reason: 'VERIFY_ERROR' };
  }
}
