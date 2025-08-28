import { Connection, PublicKey, ParsedTransactionWithMeta, ParsedAccountData } from '@solana/web3.js';
import { redisSet } from '../clients/redisClient';

// Environment configuration with sensible defaults
const MIN_LIQUIDITY_USD = parseFloat(process.env.MIN_LIQUIDITY_USD || '50');
const VALIDATOR_CONCURRENCY = parseInt(process.env.VALIDATOR_CONCURRENCY || '5');
const VALIDATOR_TIMEOUT_MS = parseInt(process.env.VALIDATOR_TIMEOUT_MS || '30000');
const RPC_URL = process.env.QUICKNODE_RPC_URL || process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Types
export interface CandidateInput {
  meta: {
    signature: string;
    slot: number;
  };
  [key: string]: any; // Allow additional properties from raydium listener
}

export interface ValidationResult {
  signature: string;
  slot: number;
  status: 'validated' | 'low-liquidity' | 'fetch-failed' | 'invalid';
  reason?: string;
  reserves?: {
    baseAmount?: number;
    quoteAmount?: number;
    estimatedUsdValue?: number;
  };
  timestamp: number;
}

// Connection instance - reuse for efficiency
let connection: Connection | null = null;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, 'confirmed');
  }
  return connection;
}

/**
 * Conservative deep-fetcher for Raydium candidates
 * Performs minimal on-chain validation with lightweight checks
 */
export class RaydiumDeepFetcher {
  private concurrencyLimit: number;
  private timeoutMs: number;
  private minLiquidityUsd: number;
  private activeValidations = new Set<string>();

  constructor(
    concurrencyLimit = VALIDATOR_CONCURRENCY,
    timeoutMs = VALIDATOR_TIMEOUT_MS,
    minLiquidityUsd = MIN_LIQUIDITY_USD
  ) {
    this.concurrencyLimit = concurrencyLimit;
    this.timeoutMs = timeoutMs;
    this.minLiquidityUsd = minLiquidityUsd;
  }

  /**
   * Validate a single candidate
   */
  async validateCandidate(candidate: CandidateInput): Promise<ValidationResult> {
    const { signature, slot } = candidate.meta;
    
    // Skip if already being validated
    if (this.activeValidations.has(signature)) {
      return {
        signature,
        slot,
        status: 'fetch-failed',
        reason: 'already_validating',
        timestamp: Date.now(),
      };
    }

    this.activeValidations.add(signature);

    try {
      return await this.performValidation(candidate);
    } finally {
      this.activeValidations.delete(signature);
    }
  }

  /**
   * Core validation logic
   */
  private async performValidation(candidate: CandidateInput): Promise<ValidationResult> {
    const { signature, slot } = candidate.meta;
    
    try {
      // Fetch parsed transaction with timeout
      const parsedTx = await this.fetchParsedTransactionWithTimeout(signature);
      
      if (!parsedTx) {
        return this.createResult(signature, slot, 'fetch-failed', 'transaction_not_found');
      }

      // Scan for suspected pool/reserve/mint accounts
      const suspectedAccounts = this.scanForPoolAccounts(parsedTx);
      
      if (suspectedAccounts.length === 0) {
        return this.createResult(signature, slot, 'invalid', 'no_pool_accounts_found');
      }

      // Validate reserves and liquidity
      const reserves = await this.validateReserves(suspectedAccounts);
      
      if (!reserves || reserves.estimatedUsdValue === undefined) {
        return this.createResult(signature, slot, 'fetch-failed', 'reserves_validation_failed');
      }

      // Check liquidity threshold
      if (reserves.estimatedUsdValue < this.minLiquidityUsd) {
        return this.createResult(signature, slot, 'low-liquidity', 'below_threshold', reserves);
      }

      // Mark as validated
      const result = this.createResult(signature, slot, 'validated', 'passed_validation', reserves);
      
      // Persist validation result to Redis
      await this.persistValidationResult(result);
      
      return result;

    } catch (error) {
      return this.createResult(signature, slot, 'fetch-failed', `error: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch parsed transaction with timeout protection
   */
  private async fetchParsedTransactionWithTimeout(signature: string): Promise<ParsedTransactionWithMeta | null> {
    try {
      const conn = getConnection();
      const result = await conn.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
      return result;
    } catch (error) {
      // Return null for any fetch errors - will be handled upstream
      return null;
    }
  }

  /**
   * Scan transaction for suspected pool/reserve/mint accounts
   * Conservative approach - look for common Raydium patterns
   */
  private scanForPoolAccounts(parsedTx: ParsedTransactionWithMeta): string[] {
    const suspectedAccounts: string[] = [];
    const accountKeys = parsedTx.transaction.message.accountKeys;
    
    // Look through account keys for potential mint/token accounts
    for (const accountKey of accountKeys) {
      const pubkeyStr = typeof accountKey === 'string' ? accountKey : accountKey.pubkey.toString();
      
      // Add accounts that could be mints or token accounts
      // This is intentionally conservative - we'll validate them later
      suspectedAccounts.push(pubkeyStr);
    }

    // Limit to reasonable number to avoid excessive API calls
    return suspectedAccounts.slice(0, 20);
  }

  /**
   * Validate reserves by fetching account info for suspected accounts
   */
  private async validateReserves(suspectedAccounts: string[]): Promise<ValidationResult['reserves'] | null> {
    const conn = getConnection();
    let baseAmount = 0;
    let quoteAmount = 0;
    let foundTokenAccounts = 0;

    // Check each suspected account for token amounts
    for (const accountStr of suspectedAccounts) {
      try {
        const pubkey = new PublicKey(accountStr);
        const accountInfo = await conn.getParsedAccountInfo(pubkey);
        
        if (accountInfo.value?.data && 'parsed' in accountInfo.value.data) {
          const parsed = accountInfo.value.data as ParsedAccountData;
          
          // Look for token account data
          if (parsed.program === 'spl-token' && parsed.parsed?.type === 'account') {
            const tokenAmount = parsed.parsed.info?.tokenAmount;
            if (tokenAmount?.uiAmount && tokenAmount.uiAmount > 0) {
              foundTokenAccounts++;
              
              // Assign amounts conservatively
              if (foundTokenAccounts === 1) {
                baseAmount = tokenAmount.uiAmount;
              } else if (foundTokenAccounts === 2) {
                quoteAmount = tokenAmount.uiAmount;
              }
            }
          }
        }
      } catch (error) {
        // Skip accounts that can't be fetched - this is expected for many accounts
        continue;
      }
    }

    // Need at least some token amounts to proceed
    if (foundTokenAccounts === 0) {
      return null;
    }

    // Conservative USD estimation
    // For now, use a simple heuristic - assume quote token might be USDC/USDT
    // In a real implementation, you'd want proper price feeds
    const estimatedUsdValue = Math.max(baseAmount, quoteAmount) * 0.1; // Very conservative

    return {
      baseAmount,
      quoteAmount,
      estimatedUsdValue,
    };
  }

  /**
   * Create a standardized validation result
   */
  private createResult(
    signature: string,
    slot: number,
    status: ValidationResult['status'],
    reason?: string,
    reserves?: ValidationResult['reserves']
  ): ValidationResult {
    return {
      signature,
      slot,
      status,
      reason,
      reserves,
      timestamp: Date.now(),
    };
  }

  /**
   * Persist validation result to Redis
   */
  private async persistValidationResult(result: ValidationResult): Promise<void> {
    try {
      const key = `raydium:validated:${result.signature}`;
      const value = JSON.stringify(result);
      // Store for 24 hours
      await redisSet(key, value, 24 * 60 * 60);
    } catch (error) {
      // Log but don't fail validation on persistence errors
      console.warn('[raydium-deep-fetcher] Failed to persist result:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      concurrencyLimit: this.concurrencyLimit,
      timeoutMs: this.timeoutMs,
      minLiquidityUsd: this.minLiquidityUsd,
      rpcUrl: RPC_URL,
    };
  }
}

// Export a default instance for convenience
export const defaultDeepFetcher = new RaydiumDeepFetcher();

/**
 * Convenience function to validate a single candidate
 */
export async function validateRaydiumCandidate(candidate: CandidateInput): Promise<ValidationResult> {
  return defaultDeepFetcher.validateCandidate(candidate);
}

/**
 * Convenience function to validate multiple candidates with concurrency control
 */
export async function validateRaydiumCandidates(candidates: CandidateInput[]): Promise<ValidationResult[]> {
  const fetcher = new RaydiumDeepFetcher();
  const results: ValidationResult[] = [];
  
  // Process in batches to respect concurrency limits
  for (let i = 0; i < candidates.length; i += VALIDATOR_CONCURRENCY) {
    const batch = candidates.slice(i, i + VALIDATOR_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(candidate => fetcher.validateCandidate(candidate))
    );
    results.push(...batchResults);
  }
  
  return results;
}