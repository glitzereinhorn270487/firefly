import { kvGet, kvSet } from '../store/redisStore';

export type Policy = {
  // Entry-Confirmation („One-more-buyer“)
  confirmWindowSec: number;   // 120..600
  minConfirmBuyers: number;   // 1..5
  minConfirmVolumeUSD: number;// 50..500

  // First-Buyer Guardrails
  firstBuyerCapPct: number;       // 0.1..0.5  (vom Cash)
  maxFirstBuyerPositions: number; // 1..5
  maxTaxBuyPct: number;           // 0..5
  maxTaxSellPct: number;          // 0..5

  // CurveRunner
  enableCurveRunner: boolean;
  tpPct: number;  // 0.05..0.3
  slPct: number;  // 0.04..0.2
  cooldownMs: number;

  // Revocation & Backfill
  backfillMinutes: number;        // 0..120  (0 = aus)
  enableFirstSeenAuthoritySnap: boolean; // One-shot Authority Snapshot
  enableGlobalRevocationStream: boolean; // falls du global SetAuthority hören willst (Credits!)
};

const KEY = 'settings:policy';

const DEFAULTS: Policy = {
  confirmWindowSec: 180,
  minConfirmBuyers: 2,
  minConfirmVolumeUSD: 150,
  firstBuyerCapPct: 0.2,
  maxFirstBuyerPositions: 2,
  maxTaxBuyPct: 2,
  maxTaxSellPct: 2,
  enableCurveRunner: true,
  tpPct: 0.15,
  slPct: 0.10,
  cooldownMs: 5 * 60 * 1000,
  backfillMinutes: 0,
  enableFirstSeenAuthoritySnap: true,
  enableGlobalRevocationStream: false,
};

export async function getPolicy(): Promise<Policy> {
  return (await kvGet<Policy>(KEY)) ?? DEFAULTS;
}
export async function setPolicy(p: Partial<Policy>) {
  const cur = await getPolicy();
  const next = { ...cur, ...p };
  await kvSet(KEY, next);
  return next;
}