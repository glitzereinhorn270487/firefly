// lib/prices/dexscreener.ts
interface DexScreenerResponse {
  pairs?: Array<{
    priceUsd?: string;
  }>;
}

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
