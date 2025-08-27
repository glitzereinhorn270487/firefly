import fetch from 'node-fetch';
import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Minimal Listener (Node.js)
 * - subscribes to Raydium v4 and SPL Token program logs via QuickNode WSS
 * - light regex checks
 * - rate-limited getParsedTransaction calls
 * - forwards compact webhook payloads to your WEBHOOK_URL
 *
 * ENV:
 * - RPC_WSS (wss endpoint)
 * - WEBHOOK_URL
 * - WEBHOOK_AUTH (optional Bearer token for outgoing)
 * - MAX_GETTX_PER_SEC (default 5)
 * - CONFIRMATIONS (optional)
 */
const RPC_WSS = process.env.RPC_WSS!;
const WEBHOOK_URL = process.env.WEBHOOK_URL!;
const WEBHOOK_AUTH = process.env.WEBHOOK_AUTH ? `Bearer ${process.env.WEBHOOK_AUTH}` : undefined;
const MAX_GETTX_PER_SEC = Number(process.env.MAX_GETTX_PER_SEC || 5);

if (!RPC_WSS || !WEBHOOK_URL) {
  console.error('RPC_WSS and WEBHOOK_URL env vars are required');
  process.exit(1);
}

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
      console.warn('Webhook forward failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('Webhook forward error', err);
  }
}

conn.onLogs(RAYDIUM_V4, async (logInfo) => {
  try {
    const { logs, signature, slot } = logInfo;
    if (logsMatch(logs, [/Instruction:\s*Initialize2/i])) {
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('raydium_pool_initialize', signature, slot, logs, keys, parsedTx);
      await forwardWebhook(payload);
      return;
    }
    if (logsMatch(logs, [/Instruction:\s*(Burn|BurnChecked)/i])) {
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('raydium_liquidity_burn_candidate', signature, slot, logs, keys, parsedTx);
      await forwardWebhook(payload);
      return;
    }
  } catch (err) {
    console.error('Raydium handler error', err);
  }
});

conn.onLogs(TOKEN_PROGRAM, async (logInfo) => {
  try {
    const { logs, signature, slot } = logInfo;
    if (logsMatch(logs, [/Instruction:\s*SetAuthority/i, /New Authority:\s*(none|null|<none>|0x0)/i])) {
      const parsedTx = await fetchAndParseTx(signature);
      const keys = parsedTx?.transaction?.message?.accountKeys?.map((k:any)=>k.pubkey?.toString?.() || k.toString?.()) || [];
      const payload = buildWebhookPayload('token_setauthority_revoked', signature, slot, logs, keys, parsedTx);
      await forwardWebhook(payload);
      return;
    }
  } catch (err) {
    console.error('Token handler error', err);
  }
});

console.log('Listener started. Subscribed to Raydium v4 and SPL Token program logs.');
