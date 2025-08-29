"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEnvList = parseEnvList;
exports.verifyHmacSignature = verifyHmacSignature;
exports.getRedisClient = getRedisClient;
exports.resetRedisClient = resetRedisClient;
exports.alreadySeenKey = alreadySeenKey;
exports.isAlreadySeen = isAlreadySeen;
exports.markAsSeen = markAsSeen;
exports.probePoolLiquidityUsd = probePoolLiquidityUsd;
exports.extractPoolAddress = extractPoolAddress;
const crypto_1 = __importDefault(require("crypto"));
const web3_js_1 = require("@solana/web3.js");
/**
 * Parse comma-separated environment variable list
 */
function parseEnvList(value) {
    if (!value || typeof value !== 'string')
        return [];
    return value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
}
/**
 * Verify HMAC signature for QuickNode webhook
 */
function verifyHmacSignature(payload, signature, secret, nonce, timestamp) {
    if (!secret || !signature || !payload)
        return false;
    try {
        // Construct data string similar to existing verify.ts logic
        const data = `${nonce || ''}${timestamp || ''}${payload}`;
        const mac = crypto_1.default.createHmac('sha256', Buffer.from(secret));
        mac.update(Buffer.from(data));
        const expected = mac.digest('hex');
        // Timing-safe comparison
        return crypto_1.default.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    }
    catch {
        return false;
    }
}
/**
 * In-memory fallback for Redis operations
 */
class MemoryRedisClient {
    constructor() {
        this.cache = new Map();
    }
    async get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
        if (item.expires && Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
    async set(key, value, ex) {
        const expires = ex ? Date.now() + (ex * 1000) : undefined;
        this.cache.set(key, { value, expires });
        return true;
    }
}
/**
 * Upstash Redis HTTP client
 */
class UpstashRedisClient {
    constructor(url, token) {
        this.url = url;
        this.token = token;
    }
    async get(key) {
        try {
            const response = await fetch(`${this.url}/get/${encodeURIComponent(key)}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            const data = await response.json();
            return data.result ?? null;
        }
        catch {
            return null;
        }
    }
    async set(key, value, ex) {
        try {
            const body = [key, value];
            if (ex)
                body.push('EX', ex);
            const response = await fetch(`${this.url}/set`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            return data.result === 'OK';
        }
        catch {
            return false;
        }
    }
}
/**
 * Get Redis client with Upstash or in-memory fallback
 */
let clientInstance = null;
function getRedisClient() {
    if (clientInstance)
        return clientInstance;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (upstashUrl && upstashToken) {
        clientInstance = new UpstashRedisClient(upstashUrl, upstashToken);
    }
    else {
        clientInstance = new MemoryRedisClient();
    }
    return clientInstance;
}
/**
 * Reset Redis client instance (for testing)
 */
function resetRedisClient() {
    clientInstance = null;
}
/**
 * Generate deduplication key for pool address
 */
function alreadySeenKey(poolAddress, windowMinutes = 60) {
    const windowId = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
    return `quicknode:pool:${poolAddress}:${windowId}`;
}
/**
 * Check if pool address was already seen
 */
async function isAlreadySeen(poolAddress) {
    const redis = getRedisClient();
    const key = alreadySeenKey(poolAddress);
    const result = await redis.get(key);
    return result !== null;
}
/**
 * Mark pool address as seen
 */
async function markAsSeen(poolAddress) {
    const redis = getRedisClient();
    const key = alreadySeenKey(poolAddress);
    await redis.set(key, '1', 3600); // 1 hour expiry
}
/**
 * Light on-chain liquidity probe using Solana connection
 */
async function probePoolLiquidityUsd(poolAddress, connection) {
    if (!connection)
        return null;
    try {
        const poolPubkey = new web3_js_1.PublicKey(poolAddress);
        // Try to get token accounts for the pool
        const tokenAccounts = await connection.getTokenAccountsByOwner(poolPubkey, {
            programId: new web3_js_1.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        });
        if (tokenAccounts.value.length === 0)
            return null;
        // For a basic probe, check if pool has any token accounts
        // In production, this could be enhanced with actual balance checks
        // and price calculations, but keeping it lightweight as requested
        return tokenAccounts.value.length > 0 ? 1.0 : null;
    }
    catch (error) {
        // Best effort - return null if probe fails
        return null;
    }
}
/**
 * Extract pool address from transaction data
 */
function extractPoolAddress(transactionData) {
    if (!transactionData)
        return null;
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
//# sourceMappingURL=quicknode-utils.js.map