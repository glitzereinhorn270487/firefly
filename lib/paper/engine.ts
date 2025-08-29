import * as Vol from '@/lib/store/volatile';
import type { Position as StorePosition } from '@/lib/store/positions';

type Tick = {
  mint?: string;
  symbol?: string;
  priceUsd?: number;
  volumeUsd1m?: number;
  volumeUsd5m?: number;
  txBuys1m?: number;
  txSells1m?: number;
  source?: string; // "quicknode" | "pumpfun" | "test"
};

type Position = StorePosition;

let storeApi: {
  listPositions: () => Promise<Position[]>;
  getPosition: (id: string) => Promise<Position | null>;
  openPosition: (p: Position) => Promise<Position>;
  updatePosition: (id: string, patch: Partial<Position>) => Promise<Position | null>;
  closePosition: (id: string, reason?: string) => Promise<Position | null>;
} | null = null;

let inMemory: Map<string, Position> | null = null;

async function ensureStore() {
  if (storeApi) return storeApi;
  try {
    const mod: any = await import('@/lib/store/positions');
    if (mod.listPositions && mod.openPosition && mod.closePosition) {
      storeApi = {
        listPositions: mod.listPositions,
        getPosition: mod.getPosition ?? (async (_id:string)=>null),
        openPosition: mod.openPosition,
        updatePosition: mod.updatePosition ?? (async (_id:string,_p:Partial<Position>)=>null),
        closePosition: mod.closePosition,
      };
      return storeApi;
    }
  } catch {}
  if (!inMemory) inMemory = new Map<string, Position>();
  storeApi = {
    async listPositions() { return Array.from(inMemory!.values()); },
    async getPosition(id: string) { return inMemory!.get(id) ?? null; },
    async openPosition(p: Position) { inMemory!.set(p.id, p); return p; },
    async updatePosition(id: string, patch: Partial<Position>) {
      const cur = inMemory!.get(id); if (!cur) return null;
      const upd: Position = { ...cur, ...patch }; inMemory!.set(id, upd); return upd;
    },
    async closePosition(id: string, reason?: string) {
      const cur = inMemory!.get(id); if (!cur) return null;
      const upd: Position = { ...cur, status: 'closed', reason: reason ?? 'closed' };
      inMemory!.set(id, upd); return upd;
    },
  };
  return storeApi;
}

const DEFAULTS = {
  minVol1mUsd: 50,
  minBuys1m: 1,
  investUsd: 5,
  stagnationMinutes: 5,
  maxFirstBuyerSlots: 3,
};

function envNum(name:string, def:number) {
  const v = process.env[name]; const n = Number(v); return Number.isFinite(n)?n:def;
}
function envBool(name:string, def:boolean) {
  const v = process.env[name]; if (v==null) return def;
  const s = String(v).toLowerCase(); return s==='1'||s==='true'||s==='yes'||s==='on';
}

export function getEffectiveConfig() {
  return {
    minVol1mUsd: Vol.getNumber('rules.minVol1mUsd', envNum('RULE_MIN_VOL_1M', DEFAULTS.minVol1mUsd)),
    minBuys1m: Vol.getNumber('rules.minBuys1m', envNum('RULE_MIN_BUYS_1M', DEFAULTS.minBuys1m)),
    investUsd: Vol.getNumber('rules.investUsd', envNum('PAPER_INVEST_USD', DEFAULTS.investUsd)),
    stagnationMinutes: Vol.getNumber('rules.stagnationMinutes', envNum('PAPER_STAG_MIN', DEFAULTS.stagnationMinutes)),
    maxFirstBuyerSlots: Vol.getNumber('rules.maxFirstBuyerSlots', envNum('PAPER_MAX_FIRSTBUYER_SLOTS', DEFAULTS.maxFirstBuyerSlots)),
  };
}
function isBotActive() {
  return Vol.getBoolean('bot.active', envBool('BOT_ACTIVE', true));
}

const niceName = (t:Tick) => (t.symbol?.trim() ? t.symbol!.toUpperCase() : (t.mint ? t.mint.slice(0,4)+'…'+t.mint.slice(-4) : 'UNK'));
const categoryFor = (t:Tick): Position['category'] => {
  const s = (t.source || '').toLowerCase();
  if (s.includes('pump')) return 'PumpFun';
  if (s.includes('quick') || s.includes('rayd')) return 'Raydium';
  return 'Test';
};

const now = () => Date.now();

async function shouldOpen(t: Tick, CFG: ReturnType<typeof getEffectiveConfig>) {
  const vol = Number(t.volumeUsd1m || 0);
  const buys = Number(t.txBuys1m || 0);
  if (vol < CFG.minVol1mUsd) return { ok:false, reason:'vol_too_low' };

  if (buys < CFG.minBuys1m) {
    const api = await ensureStore();
    const open = (await api.listPositions()).filter(p=>p.status==='open');
    const firstBuyerOpen = open.filter(p=>p.meta?.noFollowers===true).length;
    if (firstBuyerOpen >= CFG.maxFirstBuyerSlots) return { ok:false, reason:'no_follower_slots_full' };
    return { ok:true, noFollowers:true as const };
  }
  return { ok:true };
}

async function paperOpen(t: Tick, CFG: ReturnType<typeof getEffectiveConfig>) {
  const api = await ensureStore();
  const id = (t.mint || t.symbol || '').trim() || `UNK-${Date.now()}`;
  const exists = await api.getPosition(id); if (exists?.status==='open') return;

  const pos: Position = {
    id, chain:'SOL', name:niceName(t), category:categoryFor(t),
    marketcap: undefined, volume: t.volumeUsd1m || 0,
    investmentUsd: CFG.investUsd, pnlUsd: 0, openedAt: now(),
    status: 'open',
    meta: { priceUsdAtOpen: t.priceUsd, noFollowers: Number(t.txBuys1m||0) < CFG.minBuys1m, src: t.source || 'unknown' },
  };
  await api.openPosition(pos);
}

async function paperStagnationSweep(CFG: ReturnType<typeof getEffectiveConfig>) {
  const api = await ensureStore();
  const all = await api.listPositions();
  const open = all.filter(p=>p.status==='open');
  const cutoff = now() - CFG.stagnationMinutes * 60 * 1000;
  for (const p of open) {
    if (p.openedAt < cutoff && p.meta?.noFollowers) {
      await api.closePosition(p.id, 'stagnation_no_followers');
    }
  }
}

// Public
export async function onWebhook(_evt:{source?:string; path?:string; payload?:any}) { return { ok:true }; }

/**
 * Process accepted webhook event in background
 * This function is called asynchronously by the webhook handler
 */
export async function processAcceptedEvent(event: {
  source?: string;
  path?: string;
  payload?: any;
  poolAddress?: string;
  txHash?: string;
  timestamp?: number;
}): Promise<{ ok: boolean; processed?: boolean; error?: string }> {
  try {
    // Call existing onWebhook function
    const result = await onWebhook(event);
    
    // Additional processing could be added here for accepted events
    // such as queuing for further analysis, updating metrics, etc.
    
    return { processed: true, ...result };
  } catch (error) {
    return { 
      ok: false, 
      processed: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

export async function onTick(t: Tick) {
  const CFG = getEffectiveConfig();

  // Manager-Teil läuft immer, open nur wenn aktiv
  await paperStagnationSweep(CFG);
  if (!isBotActive()) return { ok:true, skipped:'bot_inactive' };

  const d = await shouldOpen(t, CFG);
  if (d.ok) await paperOpen(t, CFG);
  return { ok:true, decision:d };
}

export async function onManager() {
  const CFG = getEffectiveConfig();
  await paperStagnationSweep(CFG);
  return { ok:true };
}

export default onTick;
