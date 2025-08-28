import { kvGet, kvSet } from '../store/redisStore';

const KEY = 'idem:events'; // { [id]: ts }
const TTL_MS = 60 * 60 * 1000;

export async function seen(id: string): Promise<boolean> {
  const map = (await kvGet<Record<string, number>>(KEY)) || {};
  const now = Date.now();
  // purge old
  for (const k in map) if (now - map[k] > TTL_MS) delete map[k];
  if (map[id]) return true;
  map[id] = now;
  await kvSet(KEY, map);
  return false;
}