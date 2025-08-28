import { validateRaydiumCandidate, RaydiumDeepFetcher, CandidateInput } from '../validator/raydiumDeepFetcher';

/**
 * Optional integration point for the Raydium deep-fetcher
 * This demonstrates how to integrate the deep-fetcher with the existing raydium listener
 * WITHOUT changing the core raydium listener behavior
 */

// Flag to enable/disable deep fetching - completely opt-in
const DEEP_FETCH_ENABLED = process.env.ENABLE_RAYDIUM_DEEP_FETCH === '1' || process.env.ENABLE_RAYDIUM_DEEP_FETCH === 'true';

/**
 * Enhanced candidate handler that optionally performs deep validation
 * This can be passed to the raydium listener's onCandidate callback
 */
export async function enhancedCandidateHandler(candidate: any): Promise<void> {
  console.info('[enhanced-handler] Received candidate', candidate.meta);
  
  // Always perform the basic logging/persistence that was done before
  // This ensures backward compatibility
  
  // Only perform deep fetching if explicitly enabled
  if (DEEP_FETCH_ENABLED) {
    try {
      console.info('[enhanced-handler] Deep fetching enabled, validating candidate', candidate.meta.signature);
      
      // Convert candidate to expected format
      const candidateInput: CandidateInput = {
        meta: {
          signature: candidate.meta.signature,
          slot: candidate.meta.slot,
        },
        ...candidate, // Include all original properties
      };
      
      // Perform deep validation
      const validationResult = await validateRaydiumCandidate(candidateInput);
      
      console.info('[enhanced-handler] Validation result', {
        signature: validationResult.signature,
        status: validationResult.status,
        reason: validationResult.reason,
        estimatedUsdValue: validationResult.reserves?.estimatedUsdValue,
      });
      
      // Take action based on validation result
      if (validationResult.status === 'validated') {
        console.info('[enhanced-handler] Candidate validated successfully', {
          signature: validationResult.signature,
          usdValue: validationResult.reserves?.estimatedUsdValue,
        });
        
        // Here you could trigger additional actions for validated candidates
        // e.g., send to a priority queue, alert systems, etc.
      } else if (validationResult.status === 'low-liquidity') {
        console.info('[enhanced-handler] Candidate below liquidity threshold', {
          signature: validationResult.signature,
          usdValue: validationResult.reserves?.estimatedUsdValue,
        });
      } else {
        console.info('[enhanced-handler] Candidate validation failed', {
          signature: validationResult.signature,
          reason: validationResult.reason,
        });
      }
      
    } catch (error) {
      // Never let deep fetching errors break the main flow
      console.warn('[enhanced-handler] Deep fetching failed, continuing normally', {
        signature: candidate.meta.signature,
        error: (error as Error).message,
      });
    }
  } else {
    console.info('[enhanced-handler] Deep fetching disabled, processing normally');
  }
}

/**
 * Example usage with custom configuration
 */
export function createCustomDeepFetcher(config: {
  concurrency?: number;
  timeoutMs?: number;
  minLiquidityUsd?: number;
}): RaydiumDeepFetcher {
  return new RaydiumDeepFetcher(
    config.concurrency || 5,
    config.timeoutMs || 30_000,
    config.minLiquidityUsd || 50
  );
}

/**
 * Batch processing example - validate multiple candidates efficiently
 */
export async function processCandidateBatch(candidates: CandidateInput[]): Promise<void> {
  if (!DEEP_FETCH_ENABLED) {
    console.info('[batch-processor] Deep fetching disabled, skipping batch');
    return;
  }
  
  console.info('[batch-processor] Processing batch of candidates', { count: candidates.length });
  
  try {
    const fetcher = new RaydiumDeepFetcher();
    const results = await Promise.all(
      candidates.map(candidate => fetcher.validateCandidate(candidate))
    );
    
    const summary = {
      total: results.length,
      validated: results.filter(r => r.status === 'validated').length,
      lowLiquidity: results.filter(r => r.status === 'low-liquidity').length,
      failed: results.filter(r => r.status === 'fetch-failed').length,
      invalid: results.filter(r => r.status === 'invalid').length,
    };
    
    console.info('[batch-processor] Batch processing complete', summary);
    
  } catch (error) {
    console.warn('[batch-processor] Batch processing failed', {
      error: (error as Error).message,
      candidateCount: candidates.length,
    });
  }
}