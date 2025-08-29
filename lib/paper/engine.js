"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveConfig = getEffectiveConfig;
exports.onWebhook = onWebhook;
exports.processAcceptedEvent = processAcceptedEvent;
exports.onTick = onTick;
exports.onManager = onManager;
const Vol = __importStar(require("@/lib/store/volatile"));
let storeApi = null;
let inMemory = null;
async function ensureStore() {
    if (storeApi)
        return storeApi;
    try {
        const mod = await Promise.resolve().then(() => __importStar(require('@/lib/store/positions')));
        if (mod.listPositions && mod.openPosition && mod.closePosition) {
            storeApi = {
                listPositions: mod.listPositions,
                getPosition: mod.getPosition ?? (async (_id) => null),
                openPosition: mod.openPosition,
                updatePosition: mod.updatePosition ?? (async (_id, _p) => null),
                closePosition: mod.closePosition,
            };
            return storeApi;
        }
    }
    catch { }
    if (!inMemory)
        inMemory = new Map();
    storeApi = {
        async listPositions() { return Array.from(inMemory.values()); },
        async getPosition(id) { return inMemory.get(id) ?? null; },
        async openPosition(p) { inMemory.set(p.id, p); return p; },
        async updatePosition(id, patch) {
            const cur = inMemory.get(id);
            if (!cur)
                return null;
            const upd = { ...cur, ...patch };
            inMemory.set(id, upd);
            return upd;
        },
        async closePosition(id, reason) {
            const cur = inMemory.get(id);
            if (!cur)
                return null;
            const upd = { ...cur, status: 'closed', reason: reason ?? 'closed' };
            inMemory.set(id, upd);
            return upd;
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
function envNum(name, def) {
    const v = process.env[name];
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}
function envBool(name, def) {
    const v = process.env[name];
    if (v == null)
        return def;
    const s = String(v).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}
function getEffectiveConfig() {
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
const niceName = (t) => (t.symbol?.trim() ? t.symbol.toUpperCase() : (t.mint ? t.mint.slice(0, 4) + '…' + t.mint.slice(-4) : 'UNK'));
const categoryFor = (t) => {
    const s = (t.source || '').toLowerCase();
    if (s.includes('pump'))
        return 'PumpFun';
    if (s.includes('quick') || s.includes('rayd'))
        return 'Raydium';
    return 'Test';
};
const now = () => Date.now();
async function shouldOpen(t, CFG) {
    const vol = Number(t.volumeUsd1m || 0);
    const buys = Number(t.txBuys1m || 0);
    if (vol < CFG.minVol1mUsd)
        return { ok: false, reason: 'vol_too_low' };
    if (buys < CFG.minBuys1m) {
        const api = await ensureStore();
        const open = (await api.listPositions()).filter(p => p.status === 'open');
        const firstBuyerOpen = open.filter(p => p.meta?.noFollowers === true).length;
        if (firstBuyerOpen >= CFG.maxFirstBuyerSlots)
            return { ok: false, reason: 'no_follower_slots_full' };
        return { ok: true, noFollowers: true };
    }
    return { ok: true };
}
async function paperOpen(t, CFG) {
    const api = await ensureStore();
    const id = (t.mint || t.symbol || '').trim() || `UNK-${Date.now()}`;
    const exists = await api.getPosition(id);
    if (exists?.status === 'open')
        return;
    const pos = {
        id, chain: 'SOL', name: niceName(t), category: categoryFor(t),
        marketcap: undefined, volume: t.volumeUsd1m || 0,
        investmentUsd: CFG.investUsd, pnlUsd: 0, openedAt: now(),
        status: 'open',
        meta: { priceUsdAtOpen: t.priceUsd, noFollowers: Number(t.txBuys1m || 0) < CFG.minBuys1m, src: t.source || 'unknown' },
    };
    await api.openPosition(pos);
}
async function paperStagnationSweep(CFG) {
    const api = await ensureStore();
    const all = await api.listPositions();
    const open = all.filter(p => p.status === 'open');
    const cutoff = now() - CFG.stagnationMinutes * 60 * 1000;
    for (const p of open) {
        if (p.openedAt < cutoff && p.meta?.noFollowers) {
            await api.closePosition(p.id, 'stagnation_no_followers');
        }
    }
}
// Public
async function onWebhook(_evt) { return { ok: true }; }
/**
 * Process accepted webhook event in background
 * This function is called asynchronously by the webhook handler
 */
async function processAcceptedEvent(event) {
    try {
        // Call existing onWebhook function
        const result = await onWebhook(event);
        // Additional processing could be added here for accepted events
        // such as queuing for further analysis, updating metrics, etc.
        return { ok: true, processed: true, ...result };
    }
    catch (error) {
        return {
            ok: false,
            processed: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
async function onTick(t) {
    const CFG = getEffectiveConfig();
    // Manager-Teil läuft immer, open nur wenn aktiv
    await paperStagnationSweep(CFG);
    if (!isBotActive())
        return { ok: true, skipped: 'bot_inactive' };
    const d = await shouldOpen(t, CFG);
    if (d.ok)
        await paperOpen(t, CFG);
    return { ok: true, decision: d };
}
async function onManager() {
    const CFG = getEffectiveConfig();
    await paperStagnationSweep(CFG);
    return { ok: true };
}
exports.default = onTick;
//# sourceMappingURL=engine.js.map