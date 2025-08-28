import { kvGet, kvSet } from '../store/volatile';
import { Position, getOpenPositions, getClosedPositions, setOpenPositions, setClosedPositions } from '../store/positions';

const KEY_CASH = 'portfolio:cash';

export async function getCash(): Promise<number> {
  const c = await kvGet<number>(KEY_CASH);
  if (typeof c === 'number') return c;
  await kvSet(KEY_CASH, 120); // Startkapital V1.0
  return 120;
}
export async function setCash(v: number) { await kvSet(KEY_CASH, v); }

export async function credit(amount: number) { await setCash((await getCash()) + amount); }
export async function debit(amount: number): Promise<boolean> {
  const c = await getCash();
  if (c < amount) return false;
  await setCash(c - amount);
  return true;
}

// ---- Positions-Helfer für Paper-Orders ----
export async function openPosition(symbol: string, price: number, usd: number): Promise<Position|null> {
  const ok = await debit(usd);
  if (!ok) return null;
  const qty = usd / price;
  const open = await getOpenPositions();
  const p: Position = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
    chain: 'Solana',
    name: symbol,
    category: 'Meme',
    narrative: null,
    mcap: 0,
    volume: 0,
    investment: usd,
    pnlUSD: 0,
    taxUSD: 0,
    holders: 0,
    txCount: { buy: 1, sell: 0 },
    scores: { scorex: 0, risk: 0, fomo: 0, pumpDumpProb: 0 },
    links: {},
    entryPrice: price,
    lastPrice: price,
    qty,
    openedAt: Date.now(),
    status: 'open',
  };
  open.unshift(p);
  await setOpenPositions(open);
  return p;
}

export async function markToMarket(id: string, newPrice: number): Promise<void> {
  const open = await getOpenPositions();
  const idx = open.findIndex(x => x.id === id);
  if (idx === -1) return;
  const p = open[idx];
  const updatedP: Position = {
    ...p,
    lastPrice: newPrice,
    pnlUSD: p.entryPrice ? (newPrice - p.entryPrice) * (p.qty || 0) : undefined,
  };
  open[idx] = updatedP;
  await setOpenPositions(open);
}

export async function closePositionByPrice(id: string, price: number): Promise<boolean> {
  const open = await getOpenPositions();
  const idx = open.findIndex(x => x.id === id);
  if (idx === -1) return false;
  const p = open[idx];
  const realized = p.entryPrice && p.qty ? (price - p.entryPrice) * p.qty : 0;
  await credit((p.investment || 0) + realized);
  const closed = await getClosedPositions();
  const moved: Position = { 
    ...p, 
    closedAt: Date.now(), 
    lastPrice: price, 
    status: 'closed',
    txCount: { 
      buy: p.txCount?.buy || 0, 
      sell: (p.txCount?.sell || 0) + 1 
    } 
  };
  open.splice(idx,1);
  closed.unshift(moved);
  await setOpenPositions(open);
  await setClosedPositions(closed);
  return true;
}