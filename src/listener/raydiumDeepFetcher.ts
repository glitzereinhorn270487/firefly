import { Connection, ParsedTransactionWithMeta } from '@solana/web3.js';
import fetch from 'node-fetch';

// Defensive, small deep-fetcher that attempts to validate Raydium candidates and
// optionally forwards validated candidates to the price validator.

type Candidate = {
  meta: { signature: string; slot?: number };
  [k: string]: any;
};

type ValidationSummary = {
  signature: string;
  slot?: number;
  status: 'validated' | 'low-liquidity' | 'fetch-failed' | 'fetch-transient' | 'price-unresolved';
  reserves?: Array<{ mint: string; amount: number; decimals: number }>;  
  totalNative?: number;
  note?: string;
};

export function startDeepFetcher(options?: {
  rpcUrl?: string;
  connection?: Connection;
  redis?: { redisGet?: (k:string)=>Promise<any>; redisSet?: (k:string,v:any,opts?:any)=>Promise<any> } | null;
  concurrency?: number;
  timeoutMs?: number;
  // Optional external price validator (should expose validateCandidatePrice and stop())
  priceValidator?: { validateCandidatePrice: (c:any)=>Promise<any>; stop?: ()=>Promise<void> } | null;
}) {
  const RPC = options?.rpcUrl || process.env.QUICKNODE_RPC_URL || process.env.RPC_URL;
  const connection = options?.connection || new Connection(RPC || '', 'confirmed');
  const redis = options?.redis || null;
  const CONCURRENCY = options?.concurrency ?? (Number(process.env.VALIDATOR_CONCURRENCY) || 5);
  const TIMEOUT_MS = options?.timeoutMs ?? (Number(process.env.VALIDATOR_TIMEOUT_MS) || 30_000);

  let active = true;
  let running = 0;
  const queue: Array<{
    candidate: Candidate;
    resolve: (r:ValidationSummary)=>void;
    reject: (e: any)=>void;
  }> = [];

  // optional price validator lifecycle (start if not provided and available)
  let priceValidator = options?.priceValidator ?? null;
  let startedInternalPriceValidator = false;

  async function tryStartInternalPriceValidator() {
    if (priceValidator) return;
    try {
      // Lazy import to avoid circular deps if validator not present
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const mod = require('./raydiumPriceValidator');
      if (mod && typeof mod.startPriceValidator === 'function') {
        priceValidator = await mod.startPriceValidator();
        startedInternalPriceValidator = true;
        // Note: this is best-effort. If the env isn't configured for price validator,
        // the module will still initialize but may no-op.
      }
    } catch (err) {
      // ignore — price validator is optional
      // console.debug('[deep-fetcher] price validator not started:', err?.message || err);
    }
  }

  function enqueueCandidate(candidate: Candidate): Promise<ValidationSummary> {
    if (!active) return Promise.reject(new Error('deep-fetcher stopped'));
    return new Promise((resolve, reject) => {
      queue.push({ candidate, resolve, reject });
      processQueue();
    });
  }

  function processQueue() {
    if (!active) return;
    if (running >= CONCURRENCY) return;
    const item = queue.shift();
    if (!item) return;
    running++;
    void (async () => {
      try {
        const res = await runValidationWithTimeout(item.candidate, TIMEOUT_MS);
        item.resolve(res);
      } catch (err) {
        item.reject(err);
      } finally {
        running--;
        // next tick
        setImmediate(processQueue);
      }
    })();
  }

  async function runValidationWithTimeout(candidate: Candidate, timeoutMs: number) {
    return await Promise.race([
      runValidation(candidate),
      new Promise<ValidationSummary>((_, rej) => setTimeout(() => rej(new Error('validation-timeout')), timeoutMs)),
    ]);
  }

  async function runValidation(candidate: Candidate): Promise<ValidationSummary> {
    const signature = candidate?.meta?.signature;
    const slot = candidate?.meta?.slot;
    if (!signature) {
      return {
        signature: 'unknown',
        status: 'fetch-failed',
        note: 'missing signature',
      };
    }

    // Attempt to fetch parsed transaction
    let parsed: ParsedTransactionWithMeta | null = null;
    try {
      parsed = await connection.getParsedTransaction(signature, 'confirmed');
    } catch (err) {
      // transient fetch error — store in redis if available
      if (redis?.redisSet) {
        try { await redis.redisSet(`raydium:candidate:fetch-failed:${signature}`, { signature, slot, err: String(err) }, { ex: 60 * 60 }); } catch {}
      }
      return { signature, slot, status: 'fetch-transient', note: String(err) };
    }

    if (!parsed) {
      return { signature, slot, status: 'fetch-failed', note: 'parsedTx null' };
    }

    // Heuristic: collect token accounts / mints mentioned in message account keys and instructions
    const accounts = parsed.transaction.message.accountKeys.map(k => ({ pubkey: k.pubkey.toBase58(), signer: k.signer, writable: k.writable }));

    // Very lightweight: look for parsed token account infos in meta.postTokenBalances or instruction parsed data
    const balances = parsed.meta?.postTokenBalances || parsed.meta?.preTokenBalances || [];
    const reserves: Array<{ mint: string; amount: number; decimals: number }> = [];

    for (const b of balances) {
      try {
        const mint = b?.mint;
        const uiAmount = (b?.uiTokenAmount?.uiAmount ?? null);
        const decimals = (b?.uiTokenAmount?.decimals ?? 0);
        if (mint && uiAmount != null) {
          // treat as possible reserve
          reserves.push({ mint, amount: uiAmount, decimals });
        }
      } catch (e) {
        // ignore malformed entries
      }
    }

    if (reserves.length === 0) {
      // No token balances detected — conservatively mark as fetch-failed
      return { signature, slot, status: 'fetch-failed', note: 'no token balances parsed' };
    }

    const summary: ValidationSummary = { signature, slot, status: 'validated', reserves };

    // If price validator available, forward for USD estimation
    try {
      await tryStartInternalPriceValidator();
      if (priceValidator && typeof priceValidator.validateCandidatePrice === 'function') {
        const priceResult = await priceValidator.validateCandidatePrice({ signature, reserves });
        // priceResult should be { signature, totalUsd, ok, reason? }
        if (!priceResult || typeof priceResult.totalUsd !== 'number') {
          summary.status = 'price-unresolved';
          summary.note = 'price validator returned invalid result';
        } else if (!priceResult.ok) {
          summary.status = priceResult.reason === 'low-liquidity' ? 'low-liquidity' : 'price-unresolved';
          summary.note = priceResult.reason;
        } else {
          // persist priced summary if redis is available
          if (redis?.redisSet) {
            try {
              await redis.redisSet(`raydium:priced:${signature}`, { signature, slot, totalUsd: priceResult.totalUsd, reserves }, { ex: 60 * 60 * 24 * 7 });
            } catch (e) {}
          }
          // attach totalNative for convenience
          (summary as any).totalNative = priceResult.totalUsd;
          summary.status = 'validated';
        }
      }
    } catch (err) {
      // Price validator errors should not crash the pipeline — mark as transient
      summary.status = 'price-unresolved';
      summary.note = String((err as any)?.message || err);
    }

    // persist validation summary in redis if available
    if (redis?.redisSet) {
      try {
        await redis.redisSet(`raydium:validated:${signature}`, summary, { ex: 60 * 60 * 24 * 7 });
      } catch (e) {
        // ignore redis errors
      }
    }

    return summary;
  }

  async function stop() {
    active = false;
    // wait for running tasks to finish (best-effort)
    const start = Date.now();
    while (running > 0 && Date.now() - start < 5000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 100));
    }
    // stop internal price validator if we started it
    if (startedInternalPriceValidator && (priceValidator as any)?.stop) {
      try { await (priceValidator as any).stop(); } catch {}
    }
  }

  return { enqueueCandidate, stop };
}