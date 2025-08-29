// Simple volatile KV stub used by loadRules / portfolio during local runs and tests.
// If UPSTASH env vars are provided, you can extend this to call the real Upstash REST API.
type KV = {
  kvGet?: <T = any>(key: string) => Promise<T | undefined>;
  kvSet?: (key: string, value: any) => Promise<void>;
  kvDel?: (key: string) => Promise<void>;
};

const mem = new Map<string, any>();

export const kvGet = async <T = any>(key: string): Promise<T | undefined> => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Optional: implement real Upstash call here if desired.
    // For MVP keep in-memory fallback to avoid external dependency.
  }
  return mem.has(key) ? (mem.get(key) as T) : undefined;
};

export const kvSet = async (key: string, value: any): Promise<void> => {
  // Keep JSON-serializable values safe
  try {
    mem.set(key, value);
  } catch {
    mem.set(key, JSON.stringify(value));
  }
};

export const kvDel = async (key: string): Promise<void> => {
  mem.delete(key);
};

export default { kvGet, kvSet, kvDel } as KV;
