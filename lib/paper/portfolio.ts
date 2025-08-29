// Minimal portfolio wrapper used by Paper trading flow.
// - Uses the in-memory volatile kv (lib/store/volatile.ts) for cash
// - Uses the positions store (lib/store/positions.ts) for positions
// Keep this minimal and defensive for the MVP.
import * as positions from '../store/positions';
import { kvGet, kvSet } from '../store/volatile';

const CASH_KEY = 'portfolio:cash';

export async function getCash(): Promise<number> {
  try {
    const v = await kvGet<number>(CASH_KEY);
    return typeof v === 'number' ? v : 0;
  } catch (err) {
    console.error('getCash failed:', err);
    return 0;
  }
}

export async function setCash(amount: number): Promise<void> {
  try {
    await kvSet(CASH_KEY, Number(amount));
  } catch (err) {
    console.error('setCash failed:', err);
  }
}

/**
 * Open a paper position: create a Position in the positions store and deduct cash (best-effort).
 * Returns the created Position clone from positions.openPosition.
 */
export async function openPaperPosition(pos: Partial<positions.Position> & { id: string; investmentUsd?: number }): Promise<positions.Position> {
  // Defensive: ensure id exists
  if (!pos || !pos.id) throw new Error('Position must include id');

  // Best-effort: deduct cash
  try {
    const cash = await getCash();
    const invest = Number(pos.investment ?? pos.investmentUsd ?? 0);
    if (!isNaN(invest) && invest > 0) {
      const newCash = Math.max(0, cash - invest);
      await setCash(newCash);
    }
  } catch (err) {
    console.warn('openPaperPosition: failed to update cash (continuing):', err);
  }

  // ensure minimal shape for store
  const now = Date.now();
  const payload: positions.Position = {
    id: pos.id,
    chain: pos.chain,
    name: pos.name,
    category: pos.category,
    investment: pos.investment ?? pos.investmentUsd,
    entryPrice: pos.entryPrice,
    openedAt: pos.openedAt ?? now,
    status: 'open',
    mint: pos.mint,
    scores: pos.scores,
    tags: pos.tags,
  };

  return positions.openPosition(payload);
}

/**
 * Update an existing position (close, update meta, etc.)
 */
export async function updatePaperPosition(id: string, patch: Partial<positions.Position>): Promise<positions.Position | null> {
  try {
    return positions.updatePosition(id, patch);
  } catch (err) {
    console.error('updatePaperPosition failed:', err);
    return null;
  }
}

export default { getCash, setCash, openPaperPosition, updatePaperPosition };