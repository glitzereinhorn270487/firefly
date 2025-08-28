import { kvGet, kvSet } from '@/lib/store/redisStore';

export type TgSettings = {
  global: boolean;
  categories: { signals: boolean; buy: boolean; sell: boolean; startstop: boolean; risk: boolean; pnl: boolean };
  events: { newSignal: boolean; entry: boolean; exit: boolean; stopLoss: boolean; warning: boolean; dailyPnl: boolean };
};
const KEY = 'settings:telegram';
const DEFAULTS: TgSettings = {
  global: true,
  categories: { signals: true, buy: true, sell: true, startstop: true, risk: true, pnl: true },
  events: { newSignal: true, entry: true, exit: true, stopLoss: true, warning: true, dailyPnl: true },
};

export async function getTg(): Promise<TgSettings> {
  return (await kvGet<TgSettings>(KEY)) ?? DEFAULTS;
}
export async function setTg(p: Partial<TgSettings>) {
  const cur = await getTg();
  const next = { ...cur, ...p, categories: { ...cur.categories, ...(p.categories||{}) }, events: { ...cur.events, ...(p.events||{}) } };
  await kvSet(KEY, next);
  return next;
}

// zentral: darf Event raus?
export async function shouldNotify(kind: 'start'|'stop'|'buy'|'sell'|'risk'|'pnl'|'signal', sub?: 'entry'|'exit'|'stopLoss'|'warning'|'dailyPnl'|'newSignal') {
  const s = await getTg();
  if (!s.global) return false;
  const cat = ((): keyof TgSettings['categories'] => {
    if (kind==='start'||kind==='stop') return 'startstop';
    if (kind==='buy') return 'buy';
    if (kind==='sell') return 'sell';
    if (kind==='risk') return 'risk';
    if (kind==='pnl') return 'pnl';
    return 'signals';
  })();
  if (!s.categories[cat]) return false;
  if (sub) {
    if (!s.events[sub]) return false;
  }
  return true;
}