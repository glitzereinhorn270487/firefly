// Zentraler Entry für Paper-Trade Signale (vom Webhook & von Tests)
import { liqAdd } from '@/lib/experiments/liqlog';

type StoreApi = {
  openPosition?: (p: any) => Promise<any> | any;
  closePosition?: (id: string, reason?: string) => Promise<any> | any;
  updatePosition?: (id: string, patch: any) => Promise<any> | any;
  listPositions?: () => Promise<any[]> | any[];
  getPosition?: (id: string) => Promise<any> | any;
};

let fallbackMem = (globalThis as any).__positions || new Map<string, any>();
(globalThis as any).__positions = fallbackMem;

async function getStore(): Promise<StoreApi> {
  try {
    const mod: any = await import('@/lib/store/positions');
    if (mod?.openPosition && mod?.closePosition) return mod as StoreApi;
  } catch {}
  // Fallback – nur für Notfälle/Tests
  const api: StoreApi = {
    listPositions: () => Array.from(fallbackMem.values()),
    getPosition: (id: string) => fallbackMem.get(id),
    openPosition: (p: any) => {
      const id = p?.id || String(Date.now());
      const pos = { status: 'open', createdAt: Date.now(), ...p, id };
      fallbackMem.set(id, pos);
      return pos;
    },
    updatePosition: (id: string, patch: any) => {
      const cur = fallbackMem.get(id);
      if (!cur) return null;
      const upd = { ...cur, ...patch };
      fallbackMem.set(id, upd);
      return upd;
    },
    closePosition: (id: string, reason?: string) => {
      const cur = fallbackMem.get(id);
      if (!cur) return null;
      const upd = { ...cur, status: 'closed', reason: reason || 'closed' };
      fallbackMem.set(id, upd);
      return upd;
    },
  };
  return api;
}

async function loadRules(): Promise<any> {
  try {
    const KV: any = await import('@/lib/store/volatile');
    const r = (await KV.kvGet?.('rules')) || {};
    // Defaults & Deine Wünsche
    const defaults = {
      watchOnly: false,
      investUsd: 20,
      minTradeUsd: 15,
      maxFirstBuyerSlots: 3,
      minVol1mUsd: 50,
      minBuys1m: 1,
      stagnationMinutes: 5,
    };
    // Soft-Merge ohne Typ-Generics
    return { ...defaults, ...(r || {}) };
  } catch {
    return {
      watchOnly: false,
      investUsd: 20,
      minTradeUsd: 15,
      maxFirstBuyerSlots: 3,
      minVol1mUsd: 50,
      minBuys1m: 1,
      stagnationMinutes: 5,
    };
  }
}

function makeId(sig: any) {
  return (
    sig?.id ||
    sig?.mint ||
    sig?.pair ||
    `${sig?.category || 'SIG'}-${sig?.tx || ''}-${Date.now()}`
  );
}

export async function onTick(signal: any) {
  // Signal kann aus QuickNode kommen (Raydium/Revoked/LP Burn)
  const rules = await loadRules();

  // Watch-only Pfad für LIQ burned Momentum
  if (signal?.category === 'LIQ_BURN_MOMENTUM' || signal?.watchOnly) {
    await liqAdd({
      src: signal?.source || 'webhook',
      mint: signal?.mint || null,
      symbol: signal?.symbol || null,
      tx: signal?.tx || null,
      reason: 'watch-only',
      note: 'LP burn detected',
      raw: signal?.raw ? undefined : signal, // vermeide zu große payloads
    });
    return { ok: true, watchOnly: true };
  }

  // Regulärer Paper-Trade
  const invest = Math.max(
    Number(rules?.minTradeUsd || 15),
    Number(rules?.investUsd || 20),
    Number(signal?.investmentUsd || 0)
  );

  const pos: any = {
    id: makeId(signal),
    chain: signal?.chain || 'SOL',
    name: signal?.name || signal?.symbol || 'unknown',
    category: signal?.category || 'Raydium',
    investmentUsd: invest,
    status: 'open',
    createdAt: Date.now(),
    mint: signal?.mint,
    pair: signal?.pair,
    meta: {
      src: signal?.source || 'webhook',
      tx: signal?.tx || null,
      tag: signal?.tag || null,
    },
    // Scores/Telemetrie optional
    scores: signal?.scores,
  };

  const store = await getStore();
  const opened = await store.openPosition?.(pos);

  // Attempt to trigger a simulated trade via the project's PaperTrader (if available)
  try {
    const path = require('path');
    function tryRequire(modulePath: string) {
      try {
        return require(modulePath);
      } catch (err: any) {
        if (err && err.code === 'MODULE_NOT_FOUND') return null;
        throw err;
      }
    }

    const traderModule =
      tryRequire(path.join(__dirname, '..', '..', 'src', 'trading', 'paperTrader')) ||
      tryRequire(path.join(process.cwd(), 'src', 'trading', 'paperTrader')) ||
      tryRequire('@/trading/paperTrader');

    if (traderModule) {
      const TraderCtor = traderModule?.default || traderModule?.PaperTrader || traderModule;
      if (typeof TraderCtor === 'function') {
        const trader = new TraderCtor();
        if (typeof trader.placeOrder === 'function') {
          const order = {
            side: 'buy',
            symbol: pos.name,
            price: Number(signal?.priceUsd || signal?.price || pos.entryPrice || 1.0),
            amount: invest,
            slippage: 0.5,
          };
          try {
            const result = await trader.placeOrder(order as any);
            // persist order id / result into the opened position (best effort)
            if (result && result.orderId) {
              await store.updatePosition?.(pos.id, { meta: { ...(pos.meta || {}), orderId: result.orderId }, trade: result });
            }
            console.log('PaperTrader simulated order result:', result);
          } catch (err) {
            console.error('PaperTrader.placeOrder failed:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to run PaperTrader integration:', err);
  }

  return { ok: true, opened: opened || pos };
}
