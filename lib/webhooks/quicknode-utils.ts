import crypto from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Parse comma-separated environment variable list
 */
export function parseEnvList(value: string | undefined): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Verify HMAC signature for QuickNode webhook
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  nonce?: string,
  timestamp?: string
): boolean {
  if (!secret || !signature || !payload) return false;
  
  try {
    // Construct data string similar to existing verify.ts logic
    const data = `${nonce || ''}${timestamp || ''}${payload}`;
    const mac = crypto.createHmac('sha256', Buffer.from(secret));
    mac.update(Buffer.from(data));
    const expected = mac.digest('hex');
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'), 
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Redis client interface for Upstash
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex?: number): Promise<boolean>;
}

/**
 * In-memory fallback for Redis operations
 */
class MemoryRedisClient implements RedisClient {
  private cache = new Map<string, { value: string; expires?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, ex?: number): Promise<boolean> {
    const expires = ex ? Date.now() + (ex * 1000) : undefined;
    this.cache.set(key, { value, expires });
    return true;
  }
}

/**
 * Upstash Redis HTTP client
 */
class UpstashRedisClient implements RedisClient {
  constructor(
    private url: string,
    private token: string
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      const data: any = await response.json();
      return data.result ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ex?: number): Promise<boolean> {
    try {
      const body: any = [key, value];
      if (ex) body.push('EX', ex);
      
      const response = await fetch(`${this.url}/set`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();
      return data.result === 'OK';
    } catch {
      return false;
    }
  }
}

/**
 * Get Redis client with Upstash or in-memory fallback
 */
let clientInstance: RedisClient | null = null;

export function getRedisClient(): RedisClient {
  if (clientInstance) return clientInstance;
  
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (upstashUrl && upstashToken) {
    clientInstance = new UpstashRedisClient(upstashUrl, upstashToken);
  } else {
    clientInstance = new MemoryRedisClient();
  }
  
  return clientInstance;
}

/**
 * Reset Redis client instance (for testing)
 */
export function resetRedisClient(): void {
  clientInstance = null;
}

/**
 * Generate deduplication key for pool address
 */
export function alreadySeenKey(poolAddress: string, windowMinutes = 60): string {
  const windowId = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
  return `quicknode:pool:${poolAddress}:${windowId}`;
}

/**
 * Check if pool address was already seen
 */
export async function isAlreadySeen(poolAddress: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = alreadySeenKey(poolAddress);
  const result = await redis.get(key);
  return result !== null;
}

/**
 * Mark pool address as seen
 */
export async function markAsSeen(poolAddress: string): Promise<void> {
  const redis = getRedisClient();
  const key = alreadySeenKey(poolAddress);
  await redis.set(key, '1', 3600); // 1 hour expiry
}

/**
 * Light on-chain liquidity probe using Solana connection
 */
export async function probePoolLiquidityUsd(
  poolAddress: string,
  connection?: Connection
): Promise<number | null> {
  if (!connection) return null;
  
  try {
    const poolPubkey = new PublicKey(poolAddress);
    
    // Try to get token accounts for the pool
    const tokenAccounts = await connection.getTokenAccountsByOwner(poolPubkey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });
    
    if (tokenAccounts.value.length === 0) return null;
    
    // For a basic probe, check if pool has any token accounts
    // In production, this could be enhanced with actual balance checks
    // and price calculations, but keeping it lightweight as requested
    return tokenAccounts.value.length > 0 ? 1.0 : null;
  } catch (error) {
    // Best effort - return null if probe fails
    return null;
  }
}

/**
 * Extract pool address from transaction data
 */
export function extractPoolAddress(transactionData: any): string | null {
  if (!transactionData) return null;
  
  // Check various possible locations for pool address
  const candidates = [
    transactionData?.poolAddress,
    transactionData?.transaction?.message?.accountKeys?.[0],
    transactionData?.value?.transaction?.message?.accountKeys?.[0],
    transactionData?.message?.accountKeys?.[0]
  ];
  
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
    if (candidate?.pubkey && typeof candidate.pubkey === 'string') {
      return candidate.pubkey;
    }
  }
  
  return null;
}