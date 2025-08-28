/**
 * Conservative Raydium Price Validator
 * 
 * Provides opt-in, non-destructive USD value estimation for Raydium pool reserves.
 * Used as a post-processing filter to remove low-USD-value pools after deep-fetcher.
 */

import { fetchDexPriceUsdByMint, getSolUsd } from './priceUtils';

/**
 * Represents a token reserve in a Raydium pool
 */
export interface ReserveInfo {
  /** Token mint address */
  mint: string;
  /** Reserve amount in token's native units (not UI amount) */
  amount: string | number;
  /** Token decimals (default: 9 for SOL-like tokens) */
  decimals?: number;
}

/**
 * Configuration options for price estimation
 */
export interface PriceEstimateOptions {
  /** Conservative multiplier to apply to estimates (default: 0.8) */
  conservativeFactor?: number;
  /** Timeout for price fetching in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Fallback to SOL price for unknown tokens (default: false) */
  fallbackToSol?: boolean;
}

/**
 * Result of USD estimation for reserves
 */
export interface ReserveEstimateResult {
  /** Total estimated USD value across all reserves */
  totalUsd: number;
  /** Individual reserve estimates */
  reserves: Array<{
    mint: string;
    amountUi: number;
    priceUsd: number | null;
    valueUsd: number;
    source: 'dexscreener' | 'sol' | 'fallback' | 'unknown';
  }>;
  /** Whether estimation was successful for at least one reserve */
  hasValidData: boolean;
  /** Timestamp of estimation */
  timestamp: number;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const WSOL_MINT = '11111111111111111111111111111111111111111';

/**
 * Conservatively estimates USD value of Raydium pool reserves
 * 
 * @param reserves Array of reserve information containing mint addresses and amounts
 * @param options Configuration options for estimation
 * @returns Promise resolving to USD value estimate
 */
export async function estimateReservesUSD(
  reserves: ReserveInfo[],
  options: PriceEstimateOptions = {}
): Promise<ReserveEstimateResult> {
  const {
    conservativeFactor = 0.8,
    timeoutMs = 5000,
    fallbackToSol = false
  } = options;

  if (!Array.isArray(reserves) || reserves.length === 0) {
    return {
      totalUsd: 0,
      reserves: [],
      hasValidData: false,
      timestamp: Date.now()
    };
  }

  const result: ReserveEstimateResult = {
    totalUsd: 0,
    reserves: [],
    hasValidData: false,
    timestamp: Date.now()
  };

  // Get SOL price once for efficiency
  let solPrice: number | null = null;
  try {
    solPrice = await Promise.race([
      getSolUsd(),
      new Promise<number>((_, reject) => setTimeout(() => reject(new Error('SOL price timeout')), timeoutMs))
    ]);
  } catch (error) {
    console.warn('[raydium-price-validator] Failed to fetch SOL price:', error);
    solPrice = null;
  }

  // Process each reserve
  for (const reserve of reserves) {
    const { mint, amount, decimals = 9 } = reserve;
    
    if (!mint || (!amount && amount !== 0)) {
      result.reserves.push({
        mint,
        amountUi: 0,
        priceUsd: null,
        valueUsd: 0,
        source: 'unknown'
      });
      continue;
    }

    // Convert to UI amount
    const amountBN = typeof amount === 'string' ? parseFloat(amount) : amount;
    const amountUi = amountBN / Math.pow(10, decimals);

    let priceUsd: number | null = null;
    let source: 'dexscreener' | 'sol' | 'fallback' | 'unknown' = 'unknown';

    try {
      // Handle SOL/WSOL specially
      if (mint === SOL_MINT || mint === WSOL_MINT) {
        if (solPrice && solPrice > 0) {
          priceUsd = solPrice;
          source = 'sol';
        } else {
          // SOL price is not available
          priceUsd = null;
          source = 'unknown';
        }
      } else {
        // Try DexScreener for other tokens
        const dexPrice = await Promise.race([
          fetchDexPriceUsdByMint(mint),
          new Promise<number | undefined>((_, reject) => 
            setTimeout(() => reject(new Error('DexScreener timeout')), timeoutMs))
        ]);
        
        if (dexPrice && dexPrice > 0) {
          priceUsd = dexPrice;
          source = 'dexscreener';
        } else if (fallbackToSol && solPrice && solPrice > 0) {
          // Conservative fallback: assume unknown tokens are worth much less than SOL
          priceUsd = solPrice * 0.001; // Very conservative assumption
          source = 'fallback';
        }
      }
    } catch (error) {
      console.warn(`[raydium-price-validator] Failed to fetch price for mint ${mint}:`, error);
    }

    const valueUsd = (priceUsd && priceUsd > 0) ? amountUi * priceUsd : 0;

    result.reserves.push({
      mint,
      amountUi,
      priceUsd,
      valueUsd,
      source
    });

    if (valueUsd > 0) {
      result.totalUsd += valueUsd;
      result.hasValidData = true;
    }
  }

  // Apply conservative factor
  result.totalUsd *= conservativeFactor;

  return result;
}

/**
 * Checks if estimated pool value meets minimum threshold
 * 
 * @param reserves Reserve information array
 * @param minUsd Minimum USD threshold (default: 1000)
 * @param options Estimation options
 * @returns Promise resolving to boolean indicating if pool meets threshold
 */
export async function meetsMinimumValue(
  reserves: ReserveInfo[],
  minUsd: number = 1000,
  options?: PriceEstimateOptions
): Promise<boolean> {
  try {
    const estimate = await estimateReservesUSD(reserves, options);
    return estimate.hasValidData && estimate.totalUsd >= minUsd;
  } catch (error) {
    console.error('[raydium-price-validator] Error checking minimum value:', error);
    return false; // Conservative: reject on error
  }
}

/**
 * Filters an array of pool candidates based on minimum USD value
 * 
 * @param candidates Array of candidates with reserve information
 * @param minUsd Minimum USD threshold
 * @param options Estimation options
 * @returns Promise resolving to filtered array of candidates
 */
export async function filterByMinimumValue<T extends { reserves?: ReserveInfo[] }>(
  candidates: T[],
  minUsd: number = 1000,
  options?: PriceEstimateOptions
): Promise<T[]> {
  const results = await Promise.allSettled(
    candidates.map(async candidate => {
      if (!candidate.reserves || candidate.reserves.length === 0) {
        return { candidate, meets: false };
      }
      const meets = await meetsMinimumValue(candidate.reserves, minUsd, options);
      return { candidate, meets };
    })
  );

  return results
    .filter((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[raydium-price-validator] Error processing candidate ${index}:`, result.reason);
        return false; // Conservative: exclude on error
      }
      return result.value.meets;
    })
    .map(result => (result as PromiseFulfilledResult<{ candidate: T; meets: boolean }>).value.candidate);
}