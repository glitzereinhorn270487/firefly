import { kvGet, kvSet } from '../store/redisStore';
import { getPolicy } from './policy';
import { getOpenPositions, setOpenPositions, type Position } from '../store/positions';
import { getCash } from '../paper/portfolio';

type MintMetrics = {
  startedAt: number;           // Start des aktuellen Fensters
  buyers: string[];            // unique Käufer in Fenster
  volUSD: number;              // Volumen im Fenster
};

const KEY_MINT = (mint: string) => `rules:mint:${mint}`;

async function readMint(mint: string): Promise<MintMetrics> {
  const p = await getPolicy();
  const cur = (await kvGet<MintMetrics>(KEY_MINT(mint))) || { startedAt: Date.now(), buyers: [], volUSD: 0 };
  // Fenster ggf. resetten
  const winMs = Math.max(30, p.confirmWindowSec || 180) * 1000;
  if (Date.now() - cur.startedAt > winMs) {
    return { startedAt: Date.now(), buyers: [], volUSD: 0 };
  }
  return cur;
}
async function writeMint(mint: string, m: MintMetrics) { await kvSet(KEY_MINT(mint), m); }

export async function recordTrade(mint: string, buyer: string | null, usd: number, side: 'buy'|'sell') {
  if (!mint) return;
  const m = await readMint(mint);
  if (side === 'buy') {
    if (buyer) {
      const has = m.buyers.includes(buyer);
      if (!has) m.buyers.push(buyer);
    }
    m.volUSD += Math.max(0, usd || 0);
  }
  await writeMint(mint, m);
}

export async function getMintMetrics(mint: string) {
  const p = await getPolicy();
  const m = await readMint(mint);
  const winMs = Math.max(30, p.confirmWindowSec || 180) * 1000;
  const remaining = Math.max(0, Math.ceil((m.startedAt + winMs - Date.now()) / 1000));
  return { ...m, windowRemainingSec: remaining };
}

export async function canOpenForMint(mint: string, opts?: { estBuyTaxPct?: number; estSellTaxPct?: number }) {
  const p = await getPolicy();
  const m = await readMint(mint);
  const cash = await getCash();
  const open = await getOpenPositions();

  // Wie viele "First-Buyer"-Positionen sind aktiv?
  const firstBuyerOpen = open.filter((x: any) => Array.isArray(x.tags) && x.tags.includes('firstBuyer')).length;

  // Tax-Gate (nur wenn Schätzung vorhanden)
  if (typeof opts?.estBuyTaxPct === 'number' && opts.estBuyTaxPct > p.maxTaxBuyPct) {
    return { allow: false as const, reason: 'BUY_TAX_TOO_HIGH' };
  }
  if (typeof opts?.estSellTaxPct === 'number' && opts.estSellTaxPct > p.maxTaxSellPct) {
    return { allow: false as const, reason: 'SELL_TAX_TOO_HIGH' };
  }

  // First-Buyer-Exposure-Caps
  const isFirst = (m.buyers.length === 0);
  if (isFirst) {
    if (firstBuyerOpen >= p.maxFirstBuyerPositions) {
      return { allow: false as const, reason: 'FIRST_BUYER_SLOTS_EXHAUSTED' };
    }
    const capUsd = Math.max(0, (p.firstBuyerCapPct || 0.2)) * cash;
    // Engine entscheidet die konkrete Size; hier nur Info zurück
    return { allow: true as const, firstBuyer: true, capUsd, reason: 'FIRST_BUYER_ALLOWED' };
  }

  return { allow: true as const, firstBuyer: false };
}

export async function postOpenMark(mint: string, posId: string, entryUsd: number, markAsFirstBuyer: boolean) {
  const p = await getPolicy();
  const open = await getOpenPositions();
  const i = open.findIndex(x => x.id === posId);
  if (i === -1) return;
  const until = Date.now() + Math.max(30, p.confirmWindowSec || 180) * 1000;
  const tags = new Set<string>(Array.isArray((open as any)[i].tags) ? (open as any)[i].tags : []);
  tags.add('needsConfirm');
  if (markAsFirstBuyer) tags.add('firstBuyer');
  (open as any)[i] = { ...(open as any)[i], mint, confirmUntil: until, needsConfirm: true, tags: Array.from(tags), entryUsd };
  await setOpenPositions(open);
}

/** True = bestätigt (genug Käufer + Volumen), False = (noch) nicht */
export async function isConfirmed(mint: string): Promise<boolean> {
  const p = await getPolicy();
  const m = await readMint(mint);
  const buyersOK = m.buyers.length >= Math.max(0, p.minConfirmBuyers || 2);
  const volOK = m.volUSD >= Math.max(0, p.minConfirmVolumeUSD || 150);
  return buyersOK && volOK;
}

/** prüft alle offenen needsConfirm-Positionen und schließt sie ggf. */
export async function sweepUnconfirmed(nowPriceOf: (p: Position) => number) {
  const open = await getOpenPositions();
  let changed = false;
  for (let i = 0; i < open.length; i++) {
    const p: any = open[i];
    if (!p.needsConfirm || !p.confirmUntil) continue;
    const mint = p.mint || p.name; // fallback
    if (Date.now() >= p.confirmUntil) {
      const ok = await isConfirmed(mint);
      if (ok) {
        // Bestätigt -> Flag entfernen
        p.needsConfirm = false;
        p.tags = Array.isArray(p.tags) ? p.tags.filter((t: string) => t !== 'needsConfirm') : [];
        changed = true;
      } else {
        // Nicht bestätigt -> SOFORT EXIT zum aktuellen Preis
        const px = nowPriceOf(p);
        // Wir speichern das gewünschte Ziel (Engine kümmert sich)
        p._forceCloseAt = typeof px === 'number' ? px : undefined;
        p._forceCloseReason = 'ENTRY_NOT_CONFIRMED';
        changed = true;
      }
      open[i] = p;
    }
  }
  if (changed) await setOpenPositions(open);
}