// Setup fetch polyfill for Node.js environment
import fetch from 'node-fetch';

// Polyfill fetch for Node.js environment
if (!global.fetch) {
  global.fetch = fetch as any;
}

interface DexScreenerResponse {
  pairs?: Array<{
    priceUsd?: string;
  }>;
}

interface JupiterPriceResponse {
  data?: {
    SOL?: {
      price?: number;
    };
  };
}

interface CoinGeckoResponse {
  solana?: {
    usd?: number;
  };
}

const SOL_CACHE_TTL = 60_000;
let solCache: { t: number; v: number } | null = null;

export async function fetchDexPriceUsdByMint(mint: string): Promise<number | undefined> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (!res.ok) return undefined;
    const data = await res.json() as DexScreenerResponse;
    const p = data?.pairs?.[0]?.priceUsd;
    const n = p ? Number(p) : undefined;
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

async function fetchSol(): Promise<number> {
  try {
    const r = await fetch('https://price.jup.ag/v4/price?ids=SOL');
    const j = await r.json() as JupiterPriceResponse;
    const n = Number(j?.data?.SOL?.price);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {}
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const j = await r.json() as CoinGeckoResponse;
    const n = Number(j?.solana?.usd);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {}
  return 0;
}

export async function getSolUsd(): Promise<number> {
  const now = Date.now();
  if (solCache && (now - solCache.t) < SOL_CACHE_TTL && solCache.v > 0) return solCache.v;
  const v = await fetchSol();
  solCache = { t: now, v };
  return v;
}