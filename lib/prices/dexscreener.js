"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDexPriceUsdByMint = fetchDexPriceUsdByMint;
// lib/prices/dexscreener.ts
async function fetchDexPriceUsdByMint(mint) {
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
            // kurze Cache-Gültigkeit, kein Dauer-Polling
            next: { revalidate: 10 },
        });
        if (!res.ok)
            return undefined;
        const data = await res.json();
        const p = data?.pairs?.[0]?.priceUsd;
        const n = p ? Number(p) : undefined;
        return Number.isFinite(n) ? n : undefined;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=dexscreener.js.map