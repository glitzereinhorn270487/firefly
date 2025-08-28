// Lightweight Log-Speicher für die Watch-Only Kategorie "LIQ burned Momentum"
let mem: any[] = (globalThis as any).__liqlog || [];
(globalThis as any).__liqlog = mem;

async function loadKV() {
  try {
    const mod = await import('@/lib/store/redisStore');
    return mod;
  } catch {
    return {};
  }
}

const KEY = 'exp:liq';

export async function liqAdd(entry: any) {
  // Minimale Normalisierung
  const e = {
    ts: Date.now(),
    kind: 'LIQ_BURN_MOMENTUM',
    ...entry,
  };
  mem.push(e);
  try {
    const KV: any = await loadKV();
    // best-effort persist
    const prev = (await KV.kvGet?.(KEY)) || [];
    const next = [...prev, e].slice(-2000); // begrenzen
    await KV.kvSet?.(KEY, next);
  } catch {}
  return e;
}

export async function liqList() {
  try {
    const KV: any = await loadKV();
    const arr = (await KV.kvGet?.(KEY)) || mem || [];
    return arr;
  } catch {
    return mem;
  }
}

export async function liqClear() {
  mem = [];
  (globalThis as any).__liqlog = mem;
  try {
    const KV: any = await loadKV();
    await KV.kvSet?.(KEY, []);
  } catch {}
  return { ok: true, cleared: true };
}
