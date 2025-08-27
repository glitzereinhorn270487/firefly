import fetch from 'node-fetch';
import { Connection, PublicKey } from '@solana/web3.js';
import { getLogger } from './logging/logger';
import { shouldSample } from './filters/sampling';
import { PaperTrader } from './trading/paperTrader';

/**
 * Enhanced Listener (Node.js) with deterministic sampling and structured logging
 * - subscribes to Raydium v4 and SPL Token program logs via QuickNode WSS
 * - deterministic sampling to reduce load
 * - structured logging with Pino
 * - rate-limited getParsedTransaction calls
 * - forwards compact webhook payloads to your WEBHOOK_URL
 * - optional paper trading integration
 *
 * ENV:
 * - RPC_WSS (wss endpoint)
 * - WEBHOOK_URL
 * - WEBHOOK_AUTH (optional Bearer token for outgoing)
 * - MAX_GETTX_PER_SEC (default 5)
 * - SAMPLE_RATE (default 1.0 - process all events)
 * - PAPER_TRADER_ENABLED (default false)
 * - PAPER_RUN_ID (for paper trading)
 */
const RPC_WSS = process.env.RPC_WSS!;
const WEBHOOK_URL = process.env.WEBHOOK_URL!;
const WEBHOOK_AUTH = process.env.WEBHOOK_AUTH ? `Bearer ${process.env.WEBHOOK_AUTH}` : undefined;
const MAX_GETTX_PER_SEC = Number(process.env.MAX_GETTX_PER_SEC || 5);
const SAMPLE_RATE = Number(process.env.SAMPLE_RATE || 1.0);
const PAPER_TRADER_ENABLED = process.env.PAPER_TRADER_ENABLED === 'true';

// Initialize logger and paper trader
const logger = getLogger('listener');
const paperTrader = PAPER_TRADER_ENABLED ? new PaperTrader() : null;

if (!RPC_WSS || !WEBHOOK_URL) {
  logger.error('startup_failed', { reason: 'missing_required_env_vars', RPC_WSS: !!RPC_WSS, WEBHOOK_URL: !!WEBHOOK_URL });
  process.exit(1);
}

logger.info('listener_starting', {
  RPC_WSS,
  WEBHOOK_URL,
  MAX_GETTX_PER_SEC,
  SAMPLE_RATE,
  PAPER_TRADER_ENABLED,
  timestamp: new Date().toISOString()
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

function buildWebhookPayload(eventType: string, signature: string, slot: number, logs: string[], accountKeys: string[], parsedTx: any | null) {
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

async function forwardWebhook(payload: any) {
  const body = JSON.stringify(payload);
  
  logger.info('webhook_forwarding', {
    eventType: payload.eventType,
    signature: payload.signature,
    slot: payload.slot,
    payloadSize: body.length
  });

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_AUTH ? { Authorization: WEBHOOK_AUTH } : {}),
      },
      body,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      logger.warn('webhook_forward_failed', { 
        status: res.status,
        statusText: res.statusText,
        signature: payload.signature,
        error: errorText 
      });
    } else {
      logger.info('webhook_forward_success', {
        signature: payload.signature,
        status: res.status
      });
    }
  } catch (err) {
    logger.error('webhook_forward_error', {
      signature: payload.signature,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

conn.onLogs(RAYDIUM_V4, async (logInfo) => {
  try {
    const { logs, signature } = logInfo;
    const slot = (logInfo as any).slot || 0;
    
    logger.debug('raydium_log_received', { signature, slot, logCount: logs.length });
    
    if (logsMatch(logs, [/Instruction:\s*Initialize2/i])) {
      // Apply deterministic sampling
      if (!shouldSample(signature, SAMPLE_RATE)) {
        logger.debug('event_sampled_out', { signature, eventType: 'raydium_pool_initialize', sampleRate: SAMPLE_RATE });
        return;
      }

      logger.info('raydium_pool_initialize_detected', { signature, slot });
      
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('raydium_pool_initialize', signature, slot, logs, keys, parsedTx);
      
      await forwardWebhook(payload);
      
      // Optional: create paper trade
      if (paperTrader && parsedTx) {
        try {
          const result = await paperTrader.placeOrder({
            side: 'buy',
            qty: 100, // Default amount
            price: 0.001, // Default price - in real scenario would extract from tx
            symbol: `RAYDIUM-${signature.slice(-8)}`,
            meta: { signature, eventType: 'raydium_pool_initialize', slot }
          });
          logger.info('paper_trade_executed', { signature, result });
        } catch (paperErr) {
          logger.warn('paper_trade_failed', { signature, error: paperErr instanceof Error ? paperErr.message : String(paperErr) });
        }
      }
      return;
    }
    
    if (logsMatch(logs, [/Instruction:\s*(Burn|BurnChecked)/i])) {
      // Apply deterministic sampling
      if (!shouldSample(signature, SAMPLE_RATE)) {
        logger.debug('event_sampled_out', { signature, eventType: 'raydium_liquidity_burn_candidate', sampleRate: SAMPLE_RATE });
        return;
      }

      logger.info('raydium_liquidity_burn_detected', { signature, slot });
      
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('raydium_liquidity_burn_candidate', signature, slot, logs, keys, parsedTx);
      
      await forwardWebhook(payload);
      return;
    }
  } catch (err) {
    logger.error('raydium_handler_error', {
      signature: (logInfo as any).signature,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

conn.onLogs(TOKEN_PROGRAM, async (logInfo) => {
  try {
    const { logs, signature } = logInfo;
    const slot = (logInfo as any).slot || 0;
    
    logger.debug('token_log_received', { signature, slot, logCount: logs.length });
    
    if (logsMatch(logs, [/Instruction:\s*SetAuthority/i, /New Authority:\s*(none|null|<none>|0x0)/i])) {
      // Apply deterministic sampling
      if (!shouldSample(signature, SAMPLE_RATE)) {
        logger.debug('event_sampled_out', { signature, eventType: 'token_setauthority_revoked', sampleRate: SAMPLE_RATE });
        return;
      }

      logger.info('token_authority_revoked_detected', { signature, slot });
      
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('token_setauthority_revoked', signature, slot, logs, keys, parsedTx);
      
      await forwardWebhook(payload);
      return;
    }
  } catch (err) {
    logger.error('token_handler_error', {
      signature: (logInfo as any).signature,
      error: err instanceof Error ? err.message : String(err)
    });
  }
});

logger.info('listener_started', { 
  message: 'Subscribed to Raydium v4 and SPL Token program logs with enhanced features',
  features: {
    structuredLogging: true,
    deterministicSampling: true,
    paperTrading: PAPER_TRADER_ENABLED
  }
});
