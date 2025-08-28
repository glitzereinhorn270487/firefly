import { kvGet, kvSet } from '../store/redisStore';
import { getPolicy } from './policy';

type MintState = {
  mint: string;
  firstSeenAt: number;
  poolSeenAt?: number;
  revokeSeenAt?: number;
  mintAuthorityRevoked?: boolean;
  freezeAuthorityRevoked?: boolean;
  lastCheckedAt?: number;
};

const KEY = 'watch:mints';

async function load(): Promise<Record<string, MintState>> {
  return (await kvGet<Record<string, MintState>>(KEY)) || {};
}
async function save(obj: Record<string, MintState>) { await kvSet(KEY, obj); }

export async function trackPool(mint: string) {
  const db = await load();
  const now = Date.now();
  db[mint] = db[mint] ? { ...db[mint], poolSeenAt: now } : { mint, firstSeenAt: now, poolSeenAt: now };
  await save(db);
}

export async function recordRevocation(mint: string, what: 'mint'|'freeze'|'both'='both') {
  const db = await load();
  const now = Date.now();
  const cur = db[mint] || { mint, firstSeenAt: now };
  db[mint] = {
    ...cur,
    revokeSeenAt: now,
    mintAuthorityRevoked: what === 'mint' || what === 'both' ? true : cur.mintAuthorityRevoked,
    freezeAuthorityRevoked: what === 'freeze' || what === 'both' ? true : cur.freezeAuthorityRevoked,
  };
  await save(db);
}

export async function getMintState(mint: string): Promise<MintState|undefined> {
  const db = await load();
  return db[mint];
}

// One-shot Authority Snapshot (kein Polling – nur beim ersten Sehen)
export async function firstSeenAuthoritySnapshot(mint: string) {
  const policy = await getPolicy();
  if (!policy.enableFirstSeenAuthoritySnap) return;

  const rpc = process.env.SOLANA_RPC_URL || process.env.QUICKNODE_RPC_URL;
  if (!rpc) return; // kein RPC konfiguriert -> überspringen

  try {
    // Lightweight getAccountInfo (Mint account)
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [mint, { encoding: 'base64' }],
    };
    const res = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    // Hier müssten wir die Mint-Account-Daten dekodieren (spl-token layout).
    // V1.0 Heuristik: Wenn data fehlt -> unknown; wenn lamports=0 -> invalid.
    if (json?.result?.value?.data) {
      // TODO: Decode mint & freeze authority. V1.0: wir markieren nur "geprüft".
      const db = await load();
      const cur = db[mint] || { mint, firstSeenAt: Date.now() };
      db[mint] = { ...cur, lastCheckedAt: Date.now() };
      await save(db);
    }
  } catch {
    // ignore in V1.0
  }
}