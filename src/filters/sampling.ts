import { createHash } from 'crypto';

/**
 * Deterministic sampling function based on SHA256 hash
 * Same identifier will always return the same decision for a fixed sample rate
 * 
 * @param identifier - Unique identifier to hash (e.g., poolAddress, txHash)
 * @param sampleRate - Rate between 0.0 and 1.0 (inclusive)
 * @returns true if the identifier should be sampled, false otherwise
 */
export function shouldSample(identifier: string, sampleRate: number): boolean {
  // Handle edge cases
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  if (!identifier) return false;

  // Create SHA256 hash of the identifier
  const hash = createHash('sha256').update(identifier).digest('hex');
  
  // Take first 8 characters and convert to integer
  const hashPrefix = hash.substring(0, 8);
  const hashInt = parseInt(hashPrefix, 16);
  
  // Convert to 0-1 range using modulo to ensure uniform distribution
  const normalizedHash = hashInt / 0xFFFFFFFF;
  
  // Sample if normalized hash is less than sample rate
  return normalizedHash < sampleRate;
}

/**
 * Get sampling statistics for testing/debugging
 * 
 * @param identifiers - Array of identifiers to test
 * @param sampleRate - Sample rate to use
 * @returns Statistics about the sampling
 */
export function getSamplingStats(identifiers: string[], sampleRate: number) {
  const results = identifiers.map(id => ({
    identifier: id,
    sampled: shouldSample(id, sampleRate)
  }));
  
  const sampledCount = results.filter(r => r.sampled).length;
  const actualRate = sampledCount / identifiers.length;
  
  return {
    total: identifiers.length,
    sampled: sampledCount,
    rejected: identifiers.length - sampledCount,
    actualRate,
    expectedRate: sampleRate,
    variance: Math.abs(actualRate - sampleRate)
  };
}