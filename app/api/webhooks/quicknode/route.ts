// app/api/webhooks/quicknode/route.ts
import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { 
  parseEnvList, 
  verifyHmacSignature, 
  getRedisClient, 
  isAlreadySeen, 
  markAsSeen,
  probePoolLiquidityUsd,
  extractPoolAddress 
} from '@/lib/webhooks/quicknode-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment configuration
const RAYDIUM_PROGRAM_IDS = parseEnvList(process.env.RAYDIUM_PROGRAM_IDS);
const RAYDIUM_FACTORY_ADDRESSES = parseEnvList(process.env.RAYDIUM_FACTORY_ADDRESSES);
const TOKEN_WHITELIST_MINTS = parseEnvList(process.env.TOKEN_WHITELIST_MINTS);
const QUICKNODE_WEBHOOK_SECRET = process.env.QUICKNODE_WEBHOOK_SECRET;

// Default program ID and factory address if not configured
const DEFAULT_RAYDIUM_AMM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const allowedProgramIds = RAYDIUM_PROGRAM_IDS.length > 0 ? RAYDIUM_PROGRAM_IDS : [DEFAULT_RAYDIUM_AMM];
const allowedFactoryAddresses = RAYDIUM_FACTORY_ADDRESSES.length > 0 ? RAYDIUM_FACTORY_ADDRESSES : [DEFAULT_RAYDIUM_AMM];

// Solana connection for on-chain probes (optional)
let solanaConnection: Connection | undefined;
try {
  if (process.env.QUICKNODE_RPC_URL) {
    solanaConnection = new Connection(process.env.QUICKNODE_RPC_URL, 'confirmed');
  }
} catch {
  // Connection optional for webhook processing
}

function getQueryToken(req: Request): string {
  try { return new URL(req.url).searchParams.get('token') || ''; }
  catch { return ''; }
}

function getHeaderToken(req: Request): string {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const candidates = [
    getQueryToken(req),
    bearer,
    req.headers.get('x-qn-token') || '',
    req.headers.get('x-quicknode-token') || '',
    req.headers.get('x-security-token') || '',
    req.headers.get('x-webhook-token') || '',
    req.headers.get('x-verify-token') || '',
    req.headers.get('x-token') || '',
    req.headers.get('x-auth-token') || '',
    req.headers.get('x-api-key') || '',
    req.headers.get('quicknode-token') || '',
  ].filter(Boolean);
  return candidates[0] || '';
}

function authorize(req: Request, envVarName = 'QN_WEBHOOK_TOKEN') {
  const allowUnsigned = process.env.QN_ALLOW_UNSIGNED === '1';
  const want = (process.env[envVarName] as string) || '';
  const got = getHeaderToken(req);
  const ok = allowUnsigned || (!!want && got === want);
  return { ok, wantLen: (want || '').length, gotLen: (got || '').length, reason: ok ? 'ok' : (allowUnsigned ? 'unsigned-allowed' : 'token-mismatch') };
}

function toArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function normalizeKeys(arr: any): string[] {
  const a = toArray(arr);
  return a.map(k => (typeof k === 'string' ? k : (k?.pubkey || ''))).filter(Boolean);
}

function collectField(obj: any, keys: string[] = ['mint', 'tokenMint', 'baseMint', 'quoteMint']): string | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (typeof obj[k] === 'string') return obj[k] as string;
  }
  return null;
}

function extractLogs(node: any): string[] {
  const cands = [
    node?.meta?.logMessages,
    node?.transaction?.meta?.logMessages,
    node?.value?.transaction?.meta?.logMessages,
    node?.message?.logs, // falls QuickNode so nennt
  ];
  for (const c of cands) {
    const arr = toArray<string>(c);
    if (arr.length) return arr.filter(x => typeof x === 'string');
  }
  return [];
}

function extractAccountKeys(node: any): string[] {
  const cands = [
    node?.transaction?.message?.accountKeys,
    node?.value?.transaction?.message?.accountKeys,
    node?.message?.accountKeys,
  ];
  for (const c of cands) {
    const arr = normalizeKeys(c);
    if (arr.length) return arr;
  }
  return [];
}

function* iterTransactions(body: any) {
  // QuickNode liefert i.d.R. { transactions: [ ... ] }
  for (const t of toArray(body?.transactions)) yield t;

  // Fallbacks: manchmal steckt das Ding eine Ebene tiefer/anders
  if (body?.transaction || body?.value?.transaction) yield body;
  if (body?.result?.transaction) yield body.result; // RPC-ähnlich
}

/**
 * Check if transaction touches allowed program IDs
 */
function isAllowedProgram(node: any): boolean {
  const keys = extractAccountKeys(node);
  return allowedProgramIds.some(programId => keys.includes(programId));
}

/**
 * Check if transaction touches allowed factory addresses
 */
function isAllowedFactory(node: any): boolean {
  const keys = extractAccountKeys(node);
  return allowedFactoryAddresses.some(factory => keys.includes(factory));
}

/**
 * Check if transaction involves whitelisted tokens (if configured)
 */
function isWhitelistedToken(node: any): boolean {
  if (TOKEN_WHITELIST_MINTS.length === 0) return true; // No whitelist = allow all
  
  const tokenMint = collectField(node, ['mint', 'tokenMint', 'baseMint', 'quoteMint']);
  if (!tokenMint) return false;
  
  return TOKEN_WHITELIST_MINTS.includes(tokenMint);
}

function isRaydiumInit2(node: any): boolean {
  const logs = extractLogs(node);
  const hasInit2 = logs.some((l) => typeof l === 'string' && /Initialize2/i.test(l));
  const touchesAllowedProgram = isAllowedProgram(node);
  return hasInit2 && touchesAllowedProgram;
}

async function parseBody(req: Request) {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  let text = '';
  try { text = await req.text(); } catch {}
  if (!text) return { ok: false as const, body: null, hasRaw: false, ct, text: '' };
  try {
    const body = JSON.parse(text);
    return { ok: true as const, body, hasRaw: true, ct, text };
  } catch (e) {
    console.warn('[webhook:quicknode][bad-json]', { ct, preview: text.slice(0, 200) });
    return { ok: false as const, body: null, hasRaw: true, ct, text };
  }
}

/**
 * Process accepted event in background (non-blocking)
 */
async function processEventAsync(event: any): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies and improve cold start performance
    const { processAcceptedEvent } = await import('@/lib/paper/engine');
    
    // Process in background - don't await to keep webhook response fast
    processAcceptedEvent({
      source: 'quicknode',
      path: '/api/webhooks/quicknode',
      payload: event,
      poolAddress: extractPoolAddress(event) || undefined,
      txHash: event?.signature || event?.transaction?.signatures?.[0],
      timestamp: Date.now()
    }).catch(error => {
      console.error('[webhook:quicknode][background-error]', { 
        error: error instanceof Error ? error.message : String(error),
        event: event?.signature || 'unknown'
      });
    });
  } catch (error) {
    console.error('[webhook:quicknode][import-error]', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const url = req.url;
  
  console.info('[webhook:quicknode][hit]', {
    method: req.method,
    url,
    tokenLen: getHeaderToken(req).length,
    ct: req.headers.get('content-type'),
    clen: req.headers.get('content-length'),
    ua: req.headers.get('user-agent')
  });

  // Parse request body first for signature verification
  const parsed = await parseBody(req);
  if (!parsed.ok || !parsed.body) {
    console.warn('[webhook:quicknode][bad-body]', { hasRaw: parsed.hasRaw });
    return NextResponse.json({ ok: false, error: 'bad-body' }, { status: 400 });
  }

  // HMAC signature verification if secret is configured
  if (QUICKNODE_WEBHOOK_SECRET) {
    const signature = req.headers.get('x-quicknode-signature') || req.headers.get('x-qn-signature') || '';
    const nonce = req.headers.get('x-quicknode-nonce') || req.headers.get('x-qn-nonce') || '';
    const timestamp = req.headers.get('x-quicknode-timestamp') || req.headers.get('x-qn-timestamp') || '';
    
    if (!verifyHmacSignature(parsed.text, signature, QUICKNODE_WEBHOOK_SECRET, nonce, timestamp)) {
      console.warn('[webhook:quicknode][invalid-signature]', { 
        hasSignature: !!signature,
        hasNonce: !!nonce,
        hasTimestamp: !!timestamp
      });
      return NextResponse.json({ ok: false, error: 'invalid-signature' }, { status: 401 });
    }
  }

  // Token-based authorization (legacy support)
  const auth = authorize(req, 'QN_WEBHOOK_TOKEN');
  if (!auth.ok && !QUICKNODE_WEBHOOK_SECRET) {
    // Only require token auth if no HMAC secret is configured
    console.warn('[webhook:quicknode][unauthorized]', { 
      wantLen: auth.wantLen, 
      gotLen: auth.gotLen, 
      reason: auth.reason 
    });
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let txs = 0;
  let matches = 0;
  let accepted = 0;
  let ignored = 0;
  let duplicates = 0;
  
  for (const node of iterTransactions(parsed.body)) {
    txs++;
    
    if (!isRaydiumInit2(node)) continue;
    matches++;
    
    // Apply server-side whitelist filters
    if (!isAllowedFactory(node)) {
      ignored++;
      continue;
    }
    
    if (!isWhitelistedToken(node)) {
      ignored++;
      continue;
    }
    
    const poolAddress = extractPoolAddress(node);
    if (!poolAddress) {
      ignored++;
      continue;
    }
    
    // Deduplication check
    try {
      if (await isAlreadySeen(poolAddress)) {
        duplicates++;
        ignored++;
        continue;
      }
      
      // Mark as seen before processing
      await markAsSeen(poolAddress);
    } catch (error) {
      console.warn('[webhook:quicknode][dedup-error]', { 
        error: error instanceof Error ? error.message : String(error),
        poolAddress 
      });
      // Continue processing if dedup fails (fail open)
    }
    
    // Light on-chain liquidity probe (best effort)
    let liquidityUsd: number | null = null;
    if (solanaConnection) {
      try {
        liquidityUsd = await probePoolLiquidityUsd(poolAddress, solanaConnection);
      } catch (error) {
        // Best effort - continue if probe fails
        console.debug('[webhook:quicknode][probe-error]', { 
          error: error instanceof Error ? error.message : String(error),
          poolAddress 
        });
      }
    }
    
    accepted++;
    
    // Process accepted event asynchronously to keep response fast
    processEventAsync({
      ...node,
      poolAddress,
      liquidityUsd,
      processedAt: Date.now()
    });
  }

  const processingMs = Date.now() - t0;
  
  console.info('[webhook:quicknode][batch]', { 
    txs, 
    matches, 
    accepted, 
    ignored, 
    duplicates,
    ms: processingMs 
  });
  
  return NextResponse.json({ 
    ok: true, 
    received: true, 
    txs, 
    matches, 
    accepted,
    ignored,
    duplicates,
    ms: processingMs 
  });
}

export async function GET() {
  const config = {
    programIds: allowedProgramIds.length,
    factoryAddresses: allowedFactoryAddresses.length,
    tokenWhitelist: TOKEN_WHITELIST_MINTS.length,
    hmacEnabled: !!QUICKNODE_WEBHOOK_SECRET,
    redisEnabled: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    onChainProbeEnabled: !!solanaConnection
  };
  
  return NextResponse.json({ 
    ok: true, 
    info: 'QuickNode webhook is up',
    config
  });
}
