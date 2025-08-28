/**
 * Redis Store Adapter
 * 
 * Provides kvGet/kvSet functions that use Upstash Redis when configured,
 * otherwise falls back to the existing in-memory volatile store.
 * This ensures zero breaking changes when UPSTASH env vars are not set.
 */

import { redisGet, redisSet, isRedisAvailable } from '@/src/clients/redisClient';
import * as volatile from './volatile';

/**
 * Get a value from the store
 * Uses Redis if available, otherwise falls back to in-memory storage
 */
export async function kvGet<T = any>(key: string): Promise<T | undefined> {
  if (isRedisAvailable()) {
    try {
      return await redisGet<T>(key);
    } catch (error) {
      console.warn('Redis kvGet failed, falling back to volatile store:', error);
      // Fall back to volatile store on Redis failure
      return await volatile.kvGet<T>(key);
    }
  }
  
  // Use volatile store when Redis is not configured
  return await volatile.kvGet<T>(key);
}

/**
 * Set a value in the store
 * Uses Redis if available, otherwise falls back to in-memory storage
 */
export async function kvSet<T = any>(key: string, val: T): Promise<void> {
  if (isRedisAvailable()) {
    try {
      await redisSet(key, val);
      // Also store in volatile as backup/cache
      await volatile.kvSet(key, val);
      return;
    } catch (error) {
      console.warn('Redis kvSet failed, falling back to volatile store:', error);
      // Fall back to volatile store on Redis failure
      await volatile.kvSet(key, val);
      return;
    }
  }
  
  // Use volatile store when Redis is not configured
  await volatile.kvSet(key, val);
}

/**
 * Check if Redis is being used for storage
 */
export function isUsingRedis(): boolean {
  return isRedisAvailable();
}

// Re-export other functions from volatile store for compatibility
export {
  get,
  set,
  getBoolean,
  getNumber,
  merge
} from './volatile';