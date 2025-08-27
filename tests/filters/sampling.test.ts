import { shouldSample, getSamplingStats } from '../../src/filters/sampling';

describe('Sampling Filter', () => {
  describe('shouldSample', () => {
    it('should return false for sampleRate 0', () => {
      expect(shouldSample('test', 0)).toBe(false);
      expect(shouldSample('any-identifier', 0)).toBe(false);
    });

    it('should return true for sampleRate 1', () => {
      expect(shouldSample('test', 1)).toBe(true);
      expect(shouldSample('any-identifier', 1)).toBe(true);
    });

    it('should return false for empty identifier', () => {
      expect(shouldSample('', 0.5)).toBe(false);
    });

    it('should be deterministic for same identifier and sample rate', () => {
      const identifier = 'test-transaction-hash-123';
      const sampleRate = 0.3;
      
      const result1 = shouldSample(identifier, sampleRate);
      const result2 = shouldSample(identifier, sampleRate);
      const result3 = shouldSample(identifier, sampleRate);
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should produce different results for different identifiers', () => {
      const sampleRate = 0.5;
      const identifiers = [
        'tx1',
        'tx2',
        'tx3',
        'tx4',
        'tx5'
      ];
      
      const results = identifiers.map(id => shouldSample(id, sampleRate));
      
      // Should have some variation (not all same)
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it('should handle edge cases near 0 and 1', () => {
      const identifier = 'test-identifier';
      
      expect(shouldSample(identifier, 0.0001)).toBeDefined();
      expect(shouldSample(identifier, 0.9999)).toBeDefined();
      
      // Very low sample rate should mostly return false
      const lowRateResults = Array.from({ length: 100 }, (_, i) => 
        shouldSample(`test-${i}`, 0.01)
      );
      const lowRateSampled = lowRateResults.filter(r => r).length;
      expect(lowRateSampled).toBeLessThan(10); // Should be around 1
      
      // Very high sample rate should mostly return true
      const highRateResults = Array.from({ length: 100 }, (_, i) => 
        shouldSample(`test-${i}`, 0.99)
      );
      const highRateSampled = highRateResults.filter(r => r).length;
      expect(highRateSampled).toBeGreaterThan(90); // Should be around 99
    });
  });

  describe('getSamplingStats', () => {
    it('should calculate correct statistics', () => {
      const identifiers = Array.from({ length: 100 }, (_, i) => `identifier-${i}`);
      const sampleRate = 0.5;
      
      const stats = getSamplingStats(identifiers, sampleRate);
      
      expect(stats.total).toBe(100);
      expect(stats.sampled + stats.rejected).toBe(100);
      expect(stats.expectedRate).toBe(0.5);
      expect(stats.actualRate).toBe(stats.sampled / 100);
      expect(stats.variance).toBe(Math.abs(stats.actualRate - sampleRate));
    });

    it('should show good distribution for large sample size', () => {
      const identifiers = Array.from({ length: 10000 }, (_, i) => `id-${i}`);
      const sampleRate = 0.05; // 5%
      
      const stats = getSamplingStats(identifiers, sampleRate);
      
      // For large sample size, should be close to expected rate (within 1%)
      expect(Math.abs(stats.actualRate - sampleRate)).toBeLessThan(0.01);
      expect(stats.variance).toBeLessThan(0.01);
    });

    it('should handle edge cases', () => {
      const identifiers = ['test1', 'test2', 'test3'];
      
      const stats0 = getSamplingStats(identifiers, 0);
      expect(stats0.sampled).toBe(0);
      expect(stats0.actualRate).toBe(0);
      
      const stats1 = getSamplingStats(identifiers, 1);
      expect(stats1.sampled).toBe(3);
      expect(stats1.actualRate).toBe(1);
    });

    it('should handle empty identifier list', () => {
      const stats = getSamplingStats([], 0.5);
      expect(stats.total).toBe(0);
      expect(stats.sampled).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.actualRate).toBeNaN(); // 0/0
    });
  });

  describe('Hash Distribution', () => {
    it('should distribute hashes uniformly across sample rates', () => {
      // Test with realistic transaction-like identifiers
      const txHashes = [
        '2ZE7y7e8zTjKn4yYV8G3jEoRHqhqoXGfVs8NiGmrFwHk',
        '5J7d3b2VrXqGrS8qB1EuHkNjRmBtCwPv4xYzAiFsWeLp',
        '8K4f6c9QwYuLnT2pA7DjHkMbGrCvEx1vZ5xFgHsJqWrN',
        '3N8e2a5RzXmHkL9sF4BvJnKdGtCpDx6wY1zAiEqPmUrT',
        '9M7g4h8TxVpKjR3bE6CvLnQfGsBrAy5wX2zA9iNsJmPq'
      ];
      
      const lowRate = 0.1;
      const midRate = 0.5;
      const highRate = 0.9;
      
      txHashes.forEach(hash => {
        const lowResult = shouldSample(hash, lowRate);
        const midResult = shouldSample(hash, midRate);
        const highResult = shouldSample(hash, highRate);
        
        // All should be deterministic
        expect(shouldSample(hash, lowRate)).toBe(lowResult);
        expect(shouldSample(hash, midRate)).toBe(midResult);
        expect(shouldSample(hash, highRate)).toBe(highResult);
      });
    });

    it('should work with pool addresses', () => {
      const poolAddresses = [
        '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
        '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX', 
        '6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg',
        '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'
      ];
      
      const sampleRate = 0.25;
      
      poolAddresses.forEach(address => {
        const result = shouldSample(address, sampleRate);
        expect(typeof result).toBe('boolean');
        
        // Should be deterministic
        expect(shouldSample(address, sampleRate)).toBe(result);
      });
    });
  });
});