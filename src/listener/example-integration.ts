/**
 * Example integration of the Raydium Price Validator
 * 
 * This demonstrates how to integrate the validator into a processing pipeline
 * to filter pool candidates based on USD value thresholds.
 */

import { 
  estimateReservesUSD, 
  filterByMinimumValue, 
  ReserveInfo,
  PriceEstimateOptions 
} from './raydiumPriceValidator';

// Example interface for pool candidates
interface PoolCandidate {
  id: string;
  poolAddress: string;
  timestamp: number;
  reserves?: ReserveInfo[];
  // ... other fields from your deep-fetcher
}

/**
 * Example function to process pool candidates with price validation
 */
export async function processPoolsWithPriceValidation(
  rawCandidates: PoolCandidate[],
  minUsdThreshold: number = 1000
): Promise<PoolCandidate[]> {
  
  console.log(`[price-validator] Processing ${rawCandidates.length} pool candidates`);
  
  // Configure validator options for conservative estimation
  const options: PriceEstimateOptions = {
    conservativeFactor: 0.75, // Extra conservative for production
    timeoutMs: 3000, // 3 second timeout to avoid blocking
    fallbackToSol: false // Don't use fallback pricing for conservative approach
  };
  
  // Filter candidates that meet minimum USD threshold
  const filtered = await filterByMinimumValue(rawCandidates, minUsdThreshold, options);
  
  console.log(`[price-validator] Filtered to ${filtered.length} candidates meeting $${minUsdThreshold} threshold`);
  
  return filtered;
}

/**
 * Example function to get detailed USD estimates for a single pool
 */
export async function getPoolValueEstimate(reserves: ReserveInfo[]): Promise<{
  estimatedUsd: number;
  breakdown: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  
  const result = await estimateReservesUSD(reserves, { 
    conservativeFactor: 0.8 
  });
  
  // Create breakdown string
  const breakdown = result.reserves.map(r => 
    `${r.mint.slice(0, 8)}...: ${r.amountUi.toFixed(2)} tokens @ $${r.priceUsd?.toFixed(4) || 'unknown'} (${r.source})`
  ).join('\n');
  
  // Determine confidence based on price sources
  const sources = result.reserves.map(r => r.source);
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  if (sources.every(s => s === 'dexscreener' || s === 'sol')) {
    confidence = 'high';
  } else if (sources.some(s => s === 'dexscreener' || s === 'sol')) {
    confidence = 'medium';
  }
  
  return {
    estimatedUsd: result.totalUsd,
    breakdown,
    confidence
  };
}

/**
 * Example pipeline integration
 */
export async function examplePipeline() {
  // Example candidates that might come from your deep-fetcher
  const candidates: PoolCandidate[] = [
    {
      id: 'pool1',
      poolAddress: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      timestamp: Date.now(),
      reserves: [
        {
          mint: 'So11111111111111111111111111111111111111112', // SOL
          amount: '10000000000', // 10 SOL
          decimals: 9
        },
        {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Example token
          amount: '500000000000', // 500 tokens
          decimals: 9
        }
      ]
    },
    {
      id: 'pool2', 
      poolAddress: '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX',
      timestamp: Date.now(),
      reserves: [
        {
          mint: 'So11111111111111111111111111111111111111112', // SOL
          amount: '1000000000', // 1 SOL - likely to be filtered out
          decimals: 9
        }
      ]
    }
  ];
  
  // Process with price validation
  const filtered = await processPoolsWithPriceValidation(candidates, 1000);
  
  // Get detailed estimates for remaining candidates
  for (const candidate of filtered) {
    if (candidate.reserves) {
      const estimate = await getPoolValueEstimate(candidate.reserves);
      console.log(`Pool ${candidate.id}: $${estimate.estimatedUsd} (${estimate.confidence} confidence)`);
      console.log(estimate.breakdown);
      console.log('---');
    }
  }
  
  return filtered;
}

// Export main functions for use in other modules
export { estimateReservesUSD, filterByMinimumValue } from './raydiumPriceValidator';