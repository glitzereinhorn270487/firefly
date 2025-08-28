import { Connection, PublicKey } from '@solana/web3.js';
import { fetchDexPriceUsdByMint } from './utils/priceOracle';

// Types for the validator interface
interface ValidateCandidatePriceParams {
  signature: string;
  reserves: {
    mintA?: string;
    mintB?: string;
    reserveA?: number;
    reserveB?: number;
  };
}

interface ValidateCandidatePriceResult {
  signature: string;
  totalUsd: number;
  ok: boolean;
  reason?: string;
}

interface PriceValidatorOptions {
  redisGet?: (key: string) => Promise<string | null>;
  redisSet?: (key: string, value: string, ex?: number) => Promise<boolean>;
  rpcUrl?: string;
}

interface PriceValidator {
  validateCandidatePrice: (params: ValidateCandidatePriceParams) => Promise<ValidateCandidatePriceResult>;
  stop?: () => void;
}

// Configuration from environment
const RPC_URL = process.env.RPC_URL || process.env.QUICKNODE_RPC_URL;
const MIN_LIQUIDITY_USD = Number(process.env.MIN_LIQUIDITY_USD) || 10000; // Minimum $10k liquidity

/**
 * Start the Raydium price validator
 * @param options Optional configuration including Redis helpers and RPC URL
 * @returns Price validator instance with validateCandidatePrice method
 */
export function startPriceValidator(options: PriceValidatorOptions = {}): PriceValidator {
  const rpcUrl = options.rpcUrl || RPC_URL;
  const connection = rpcUrl ? new Connection(rpcUrl, 'confirmed') : null;
  
  if (!rpcUrl) {
    console.warn('[raydium-price-validator] No RPC URL configured, price validation will be limited');
  }

  /**
   * Validate candidate price by checking liquidity and calculating total USD value
   */
  async function validateCandidatePrice(params: ValidateCandidatePriceParams): Promise<ValidateCandidatePriceResult> {
    const { signature, reserves } = params;
    
    try {
      // Extract mint addresses from reserves
      const { mintA, mintB, reserveA = 0, reserveB = 0 } = reserves;
      
      if (!mintA && !mintB) {
        return {
          signature,
          totalUsd: 0,
          ok: false,
          reason: 'no-mints-provided'
        };
      }

      let totalUsd = 0;
      let priceableTokens = 0;

      // Try to get prices for both mints
      if (mintA) {
        const priceA = await getPriceWithCache(mintA, options);
        if (priceA !== undefined) {
          totalUsd += priceA * reserveA;
          priceableTokens++;
        }
      }

      if (mintB) {
        const priceB = await getPriceWithCache(mintB, options);
        if (priceB !== undefined) {
          totalUsd += priceB * reserveB;
          priceableTokens++;
        }
      }

      // Check if we have enough priceable tokens and sufficient liquidity
      if (priceableTokens === 0) {
        return {
          signature,
          totalUsd: 0,
          ok: false,
          reason: 'no-price-data'
        };
      }

      if (totalUsd < MIN_LIQUIDITY_USD) {
        return {
          signature,
          totalUsd,
          ok: false,
          reason: 'low-liquidity'
        };
      }

      return {
        signature,
        totalUsd,
        ok: true
      };

    } catch (error) {
      console.error('[raydium-price-validator] Error validating candidate price:', error);
      return {
        signature,
        totalUsd: 0,
        ok: false,
        reason: 'validation-error'
      };
    }
  }

  /**
   * Optional cleanup method to stop background resources
   */
  function stop() {
    // Currently no background resources to clean up
    // This could be extended in the future for cleanup of timers, connections, etc.
    console.log('[raydium-price-validator] Stopped');
  }

  return {
    validateCandidatePrice,
    stop
  };
}

/**
 * Get price with caching support if Redis is available
 */
async function getPriceWithCache(
  mint: string, 
  options: PriceValidatorOptions
): Promise<number | undefined> {
  const cacheKey = `price:${mint}`;
  const cacheExpirySeconds = 30; // Cache prices for 30 seconds

  // Try to get cached price first if Redis is available
  if (options.redisGet) {
    try {
      const cached = await options.redisGet(cacheKey);
      if (cached) {
        const price = Number(cached);
        if (Number.isFinite(price)) {
          return price;
        }
      }
    } catch (error) {
      console.warn('[raydium-price-validator] Redis get error:', error);
    }
  }

  // Fetch fresh price
  const price = await fetchDexPriceUsdByMint(mint);
  
  // Cache the result if Redis is available and price is valid
  if (options.redisSet && price !== undefined) {
    try {
      await options.redisSet(cacheKey, price.toString(), cacheExpirySeconds);
    } catch (error) {
      console.warn('[raydium-price-validator] Redis set error:', error);
    }
  }

  return price;
}