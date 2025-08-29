// src/webhooks/quicknode-express.ts
// Express-based alternative to the Next.js API route for production deployment
import express from 'express';
import { Connection } from '@solana/web3.js';
import { 
  parseEnvList, 
  verifyHmacSignature, 
  getRedisClient, 
  isAlreadySeen, 
  markAsSeen,
  probePoolLiquidityUsd,
  extractPoolAddress 
} from './quicknode-utils';

const router = express.Router();

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

function getHeaderToken(req: express.Request): string {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const candidates = [
    req.query.token as string,
    bearer,
    req.headers['x-qn-token'] as string,
    req.headers['x-quicknode-token'] as string,
    req.headers['x-security-token'] as string,
    req.headers['x-webhook-token'] as string,
    req.headers['x-verify-token'] as string,
    req.headers['x-token'] as string,
    req.headers['x-auth-token'] as string,
    req.headers['x-api-key'] as string,
    req.headers['quicknode-token'] as string,
  ].filter(Boolean);
  return candidates[0] || '';
}

function authorize(req: express.Request, envVarName = 'QN_WEBHOOK_TOKEN') {
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
    node?.message?.logs,
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
  for (const t of toArray(body?.transactions)) yield t;
  if (body?.transaction || body?.value?.transaction) yield body;
  if (body?.result?.transaction) yield body.result;
}

function isAllowedProgram(node: any): boolean {
  const keys = extractAccountKeys(node);
  return allowedProgramIds.some(programId => keys.includes(programId));
}

function isAllowedFactory(node: any): boolean {
  const keys = extractAccountKeys(node);
  return allowedFactoryAddresses.some(factory => keys.includes(factory));
}

function isWhitelistedToken(node: any): boolean {
  if (TOKEN_WHITELIST_MINTS.length === 0) return true;
  
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

async function processEventAsync(event: any): Promise<void> {
  try {
    // Simple async processing - in production this would connect to paper trading engine
    // For now, just log the accepted event
    console.info('[webhook:quicknode-express][accepted-event]', {
      poolAddress: event.poolAddress,
      signature: event.signature || 'unknown',
      liquidityUsd: event.liquidityUsd,
      processedAt: event.processedAt
    });
    
    // Future: integrate with paper trading engine here
    // const { processAcceptedEvent } = await import('../../lib/paper/engine');
    // await processAcceptedEvent({ ... });
    
  } catch (error) {
    console.error('[webhook:quicknode-express][process-error]', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

// GET endpoint for health check
router.get('/quicknode', (req, res) => {
  const config = {
    programIds: allowedProgramIds.length,
    factoryAddresses: allowedFactoryAddresses.length,
    tokenWhitelist: TOKEN_WHITELIST_MINTS.length,
    hmacEnabled: !!QUICKNODE_WEBHOOK_SECRET,
    redisEnabled: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    onChainProbeEnabled: !!solanaConnection
  };
  
  res.json({ 
    ok: true, 
    info: 'QuickNode webhook (Express) is up',
    config
  });
});

// POST endpoint for webhook processing
router.post('/quicknode', express.raw({ type: 'application/json' }), async (req, res) => {
  const t0 = Date.now();
  
  console.info('[webhook:quicknode-express][hit]', {
    method: req.method,
    url: req.url,
    tokenLen: getHeaderToken(req).length,
    ct: req.headers['content-type'],
    clen: req.headers['content-length'],
    ua: req.headers['user-agent']
  });

  // Parse request body
  let parsed: any;
  try {
    const bodyText = req.body.toString('utf8');
    parsed = JSON.parse(bodyText);
    
    // HMAC signature verification if secret is configured
    if (QUICKNODE_WEBHOOK_SECRET) {
      const signature = (req.headers['x-quicknode-signature'] || req.headers['x-qn-signature'] || '') as string;
      const nonce = (req.headers['x-quicknode-nonce'] || req.headers['x-qn-nonce'] || '') as string;
      const timestamp = (req.headers['x-quicknode-timestamp'] || req.headers['x-qn-timestamp'] || '') as string;
      
      if (!verifyHmacSignature(bodyText, signature, QUICKNODE_WEBHOOK_SECRET, nonce, timestamp)) {
        console.warn('[webhook:quicknode-express][invalid-signature]', { 
          hasSignature: !!signature,
          hasNonce: !!nonce,
          hasTimestamp: !!timestamp
        });
        return res.status(401).json({ ok: false, error: 'invalid-signature' });
      }
    }
  } catch (error) {
    console.warn('[webhook:quicknode-express][bad-body]', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(400).json({ ok: false, error: 'bad-body' });
  }

  // Token-based authorization (legacy support)
  const auth = authorize(req, 'QN_WEBHOOK_TOKEN');
  if (!auth.ok && !QUICKNODE_WEBHOOK_SECRET) {
    console.warn('[webhook:quicknode-express][unauthorized]', { 
      wantLen: auth.wantLen, 
      gotLen: auth.gotLen, 
      reason: auth.reason 
    });
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  let txs = 0;
  let matches = 0;
  let accepted = 0;
  let ignored = 0;
  let duplicates = 0;
  
  for (const node of iterTransactions(parsed)) {
    txs++;
    
    if (!isRaydiumInit2(node)) continue;
    matches++;
    
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
    
    try {
      if (await isAlreadySeen(poolAddress)) {
        duplicates++;
        ignored++;
        continue;
      }
      
      await markAsSeen(poolAddress);
    } catch (error) {
      console.warn('[webhook:quicknode-express][dedup-error]', { 
        error: error instanceof Error ? error.message : String(error),
        poolAddress 
      });
    }
    
    let liquidityUsd: number | null = null;
    if (solanaConnection) {
      try {
        liquidityUsd = await probePoolLiquidityUsd(poolAddress, solanaConnection);
      } catch (error) {
        console.debug('[webhook:quicknode-express][probe-error]', { 
          error: error instanceof Error ? error.message : String(error),
          poolAddress 
        });
      }
    }
    
    accepted++;
    
    processEventAsync({
      ...node,
      poolAddress,
      liquidityUsd,
      processedAt: Date.now()
    });
  }

  const processingMs = Date.now() - t0;
  
  console.info('[webhook:quicknode-express][batch]', { 
    txs, 
    matches, 
    accepted, 
    ignored, 
    duplicates,
    ms: processingMs 
  });
  
  res.json({ 
    ok: true, 
    received: true, 
    txs, 
    matches, 
    accepted,
    ignored,
    duplicates,
    ms: processingMs 
  });
});

export default router;