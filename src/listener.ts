import fetch from 'node-fetch';
import { Connection, PublicKey } from '@solana/web3.js';
import { handleWebhookWithSampling, defaultWebhookForward, WebhookPayload } from './listener/handler';
import { getLogger } from './logging/logger';
import { getConfig } from './config';

const logger = getLogger();
const config = getConfig();

/**
 * Enhanced Listener with Deterministic Sampling
 * - subscribes to Raydium v4 and SPL Token program logs via QuickNode WSS
 * - applies deterministic sampling to events
 * - structured JSON logging with runId tracking
 * - forwards sampled-in events to webhook pipeline
 *
 * ENV:
 * - RPC_WSS (wss endpoint)
 * - WEBHOOK_URL
 * - WEBHOOK_AUTH (optional Bearer token for outgoing)
 * - MAX_GETTX_PER_SEC (default 5)
 * - SAMPLE_RATE (default 0.05)
 * - SAMPLE_BY (poolAddress or txHash)
 * - RAYDIUM_FACTORY_ADDRESSES (optional filter)
 * - LOG_LEVEL (debug, info, warn, error)
 */
const RPC_WSS = config.RPC_WSS || process.env.RPC_WSS!;
const WEBHOOK_URL = config.WEBHOOK_URL || process.env.WEBHOOK_URL!;
const WEBHOOK_AUTH = config.WEBHOOK_AUTH || (process.env.WEBHOOK_AUTH ? `Bearer ${process.env.WEBHOOK_AUTH}` : undefined);
const MAX_GETTX_PER_SEC = config.MAX_GETTX_PER_SEC;

if (!RPC_WSS || !WEBHOOK_URL) {
  logger.error('Missing required environment variables', {
    event: 'startup.error',
    module: 'listener',
    metadata: {
      rpcWssSet: !!RPC_WSS,
      webhookUrlSet: !!WEBHOOK_URL
    }
  });
  process.exit(1);
}

logger.info('Listener starting with configuration', {
  event: 'startup.config',
  module: 'listener',
  metadata: {
    sampleRate: config.SAMPLE_RATE,
    sampleBy: config.SAMPLE_BY,
    paperTrading: config.PAPER_TRADING,
    logLevel: config.LOG_LEVEL,
    factoryAddressCount: config.RAYDIUM_FACTORY_ADDRESSES.length
  }
});

const conn = new Connection(RPC_WSS, 'confirmed');
const RAYDIUM_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// rate limiter
class RateLimiter {
  tokens: number;
  last: number;
  capacity: number;
  refillPerSec: number;
  constructor(perSec: number) {
    this.capacity = perSec;
    this.tokens = perSec;
    this.refillPerSec = perSec;
    this.last = Date.now();
    setInterval(() => this.refill(), 250);
  }
  refill() {
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
  }
  async removeToken() {
    while (this.tokens < 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    this.tokens -= 1;
  }
}
const limiter = new RateLimiter(MAX_GETTX_PER_SEC);

function logsMatch(logs: string[], patterns: RegExp[]) {
  const joined = logs.join('\n');
  return patterns.some((r) => r.test(joined));
}

function buildWebhookPayload(eventType: string, signature: string, slot: number, logs: string[], accountKeys: string[], parsedTx: any | null): WebhookPayload {
  return {
    eventType,
    signature,
    slot,
    logs, // trim if needed on your side
    accountKeys,
    txSummary: parsedTx ? {
      fee: parsedTx?.meta?.fee,
      preTokenBalances: parsedTx?.meta?.preTokenBalances,
      postTokenBalances: parsedTx?.meta?.postTokenBalances,
      innerInstructions: parsedTx?.meta?.innerInstructions?.map((ii:any) => ({ index: ii.index, instructions: ii.instructions?.length || 0 })),
    } : null,
    receivedAt: new Date().toISOString(),
  };
}

async function fetchAndParseTx(signature: string) {
  await limiter.removeToken();
  const tx = await conn.getParsedTransaction(signature, 'confirmed');
  return tx;
}

// Enhanced webhook processing with sampling
async function processWebhookWithSampling(payload: WebhookPayload) {
  return await handleWebhookWithSampling(payload, defaultWebhookForward);
}

conn.onLogs(RAYDIUM_V4, async (logInfo) => {
  try {
    const { logs, signature } = logInfo;
    const slot = (logInfo as any).slot || 0; // slot might not be available in all versions
    
    if (logsMatch(logs, [/Instruction:\s*Initialize2/i])) {
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('raydium_pool_initialize', signature, slot, logs, keys, parsedTx);
      await processWebhookWithSampling(payload);
      return;
    }
    
    if (logsMatch(logs, [/Instruction:\s*(Burn|BurnChecked)/i])) {
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('raydium_liquidity_burn_candidate', signature, slot, logs, keys, parsedTx);
      await processWebhookWithSampling(payload);
      return;
    }
  } catch (err) {
    logger.error('Raydium handler error', {
      event: 'raydium.error',
      module: 'listener',
      metadata: {
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    });
  }
});

conn.onLogs(TOKEN_PROGRAM, async (logInfo) => {
  try {
    const { logs, signature } = logInfo;
    const slot = (logInfo as any).slot || 0; // slot might not be available in all versions
    
    if (logsMatch(logs, [/Instruction:\s*SetAuthority/i, /New Authority:\s*(none|null|<none>|0x0)/i])) {
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('token_setauthority_revoked', signature, slot, logs, keys, parsedTx);
      await processWebhookWithSampling(payload);
      return;
    }
  } catch (err) {
    logger.error('Token handler error', {
      event: 'token.error', 
      module: 'listener',
      metadata: {
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    });
  }
});

logger.info('Listener started successfully', {
  event: 'startup.complete',
  module: 'listener',
  metadata: {
    raydiumV4: RAYDIUM_V4.toString(),
    tokenProgram: TOKEN_PROGRAM.toString(),
    rpcEndpoint: RPC_WSS,
    webhookUrl: WEBHOOK_URL
  }
});
