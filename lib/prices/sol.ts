const TTL = 60_000;
let cache: { t: number; v: number } | null = null;

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
  if (cache && (now - cache.t) < TTL && cache.v > 0) return cache.v;
  const v = await fetchSol();
  cache = { t: now, v };
  return v;
}
