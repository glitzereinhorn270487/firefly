import { Connection } from '@solana/web3.js';
/**
 * Parse comma-separated environment variable list
 */
export declare function parseEnvList(value: string | undefined): string[];
/**
 * Verify HMAC signature for QuickNode webhook
 */
export declare function verifyHmacSignature(payload: string, signature: string, secret: string, nonce?: string, timestamp?: string): boolean;
/**
 * Redis client interface for Upstash
 */
interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ex?: number): Promise<boolean>;
}
export declare function getRedisClient(): RedisClient;
/**
 * Reset Redis client instance (for testing)
 */
export declare function resetRedisClient(): void;
/**
 * Generate deduplication key for pool address
 */
export declare function alreadySeenKey(poolAddress: string, windowMinutes?: number): string;
/**
 * Check if pool address was already seen
 */
export declare function isAlreadySeen(poolAddress: string): Promise<boolean>;
/**
 * Mark pool address as seen
 */
export declare function markAsSeen(poolAddress: string): Promise<void>;
/**
 * Light on-chain liquidity probe using Solana connection
 */
export declare function probePoolLiquidityUsd(poolAddress: string, connection?: Connection): Promise<number | null>;
/**
 * Extract pool address from transaction data
 */
export declare function extractPoolAddress(transactionData: any): string | null;
export {};
//# sourceMappingURL=quicknode-utils.d.ts.map