import crypto from 'crypto';

/**
 * Configuration for sampling behavior
 */
export interface SampleConfig {
  /** Sample rate between 0 and 1 (inclusive) */
  sampleRate: number;
  /** Identifier used for deterministic sampling */
  identifier: string;
}

/**
 * Determines whether a given identifier should be sampled based on a deterministic algorithm.
 * Uses SHA-256 hash of the identifier and converts the first 6 bytes to a normalized value [0,1).
 * 
 * @param identifier - Unique identifier to hash for sampling decision
 * @param sampleRate - Rate of sampling between 0 and 1. 0 = never sample, 1 = always sample
 * @returns true if the identifier should be sampled, false otherwise
 * 
 * @example
 * ```typescript
 * // Sample 50% of items deterministically
 * const shouldInclude = shouldSample("user123", 0.5);
 * 
 * // Never sample
 * const neverSample = shouldSample("user123", 0);
 * 
 * // Always sample  
 * const alwaysSample = shouldSample("user123", 1);
 * ```
 */
export function shouldSample(identifier: string, sampleRate: number): boolean {
  // Handle edge cases
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;

  // Create SHA-256 hash of the identifier
  const hash = crypto.createHash('sha256');
  hash.update(identifier, 'utf8');
  const hashBuffer = hash.digest();

  // Take first 6 bytes and convert to big-endian integer
  const first6Bytes = hashBuffer.subarray(0, 6);
  
  // Convert to big-endian unsigned integer
  let value = 0;
  for (let i = 0; i < 6; i++) {
    value = (value * 256) + first6Bytes[i];
  }

  // Normalize to [0, 1) by dividing by 2^48 (256^6)
  const normalizedValue = value / Math.pow(2, 48);

  // Return true if normalized value is less than sample rate
  return normalizedValue < sampleRate;
}

/**
 * Default export for convenience
 */
export default shouldSample;