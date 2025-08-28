import { startPriceValidator } from '../src/raydiumPriceValidator';

// Mock the price oracle module
jest.mock('../src/utils/priceOracle', () => ({
  fetchDexPriceUsdByMint: jest.fn()
}));

import { fetchDexPriceUsdByMint } from '../src/utils/priceOracle';

const mockFetchDexPriceUsdByMint = fetchDexPriceUsdByMint as jest.MockedFunction<typeof fetchDexPriceUsdByMint>;

describe('Raydium Price Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment for tests
    process.env.MIN_LIQUIDITY_USD = '10000';
  });

  afterEach(() => {
    delete process.env.MIN_LIQUIDITY_USD;
  });

  describe('startPriceValidator', () => {
    it('should return validator instance with required methods', () => {
      const validator = startPriceValidator();
      
      expect(validator).toHaveProperty('validateCandidatePrice');
      expect(validator).toHaveProperty('stop');
      expect(typeof validator.validateCandidatePrice).toBe('function');
      expect(typeof validator.stop).toBe('function');
    });

    it('should handle missing RPC URL gracefully', () => {
      const originalRpcUrl = process.env.QUICKNODE_RPC_URL;
      delete process.env.RPC_URL;
      delete process.env.QUICKNODE_RPC_URL;
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const validator = startPriceValidator();
      expect(validator).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith('[raydium-price-validator] No RPC URL configured, price validation will be limited');
      
      consoleSpy.mockRestore();
      if (originalRpcUrl) process.env.QUICKNODE_RPC_URL = originalRpcUrl;
    });
  });

  describe('validateCandidatePrice', () => {
    it('should return error when no mints provided', async () => {
      const validator = startPriceValidator();
      
      const result = await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {}
      });
      
      expect(result).toEqual({
        signature: 'test-signature',
        totalUsd: 0,
        ok: false,
        reason: 'no-mints-provided'
      });
    });

    it('should return error when no price data available', async () => {
      mockFetchDexPriceUsdByMint.mockResolvedValue(undefined);
      
      const validator = startPriceValidator();
      
      const result = await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {
          mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          reserveA: 1000
        }
      });
      
      expect(result).toEqual({
        signature: 'test-signature',
        totalUsd: 0,
        ok: false,
        reason: 'no-price-data'
      });
      
      expect(mockFetchDexPriceUsdByMint).toHaveBeenCalledWith('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });

    it('should return low-liquidity error when total USD is below threshold', async () => {
      mockFetchDexPriceUsdByMint.mockResolvedValue(1); // $1 per token
      
      const validator = startPriceValidator();
      
      const result = await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {
          mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          reserveA: 5000 // Only $5,000 total, below $10k threshold
        }
      });
      
      expect(result).toEqual({
        signature: 'test-signature',
        totalUsd: 5000,
        ok: false,
        reason: 'low-liquidity'
      });
    });

    it('should return success when liquidity is sufficient', async () => {
      mockFetchDexPriceUsdByMint
        .mockResolvedValueOnce(1) // $1 per token A
        .mockResolvedValueOnce(2); // $2 per token B
      
      const validator = startPriceValidator();
      
      const result = await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {
          mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          mintB: 'So11111111111111111111111111111111111111112', // SOL
          reserveA: 8000, // $8,000
          reserveB: 2000  // $4,000 (2000 * $2)
        }
      });
      
      expect(result).toEqual({
        signature: 'test-signature',
        totalUsd: 12000, // $8,000 + $4,000
        ok: true
      });
    });

    it('should handle price fetching errors gracefully', async () => {
      mockFetchDexPriceUsdByMint.mockRejectedValue(new Error('Network error'));
      
      const validator = startPriceValidator();
      
      const result = await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {
          mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          reserveA: 1000
        }
      });
      
      expect(result).toEqual({
        signature: 'test-signature',
        totalUsd: 0,
        ok: false,
        reason: 'validation-error'
      });
    });

    it('should use Redis cache when available', async () => {
      const mockRedisGet = jest.fn().mockResolvedValue('1.5'); // Cached price
      const mockRedisSet = jest.fn().mockResolvedValue(true);
      
      const validator = startPriceValidator({
        redisGet: mockRedisGet,
        redisSet: mockRedisSet
      });
      
      const result = await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {
          mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          reserveA: 10000 // 10,000 tokens * $1.5 = $15,000
        }
      });
      
      expect(mockRedisGet).toHaveBeenCalledWith('price:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(mockFetchDexPriceUsdByMint).not.toHaveBeenCalled(); // Should use cached price
      expect(result.totalUsd).toBe(15000);
      expect(result.ok).toBe(true);
    });

    it('should cache fresh prices when Redis is available', async () => {
      const mockRedisGet = jest.fn().mockResolvedValue(null); // No cached price
      const mockRedisSet = jest.fn().mockResolvedValue(true);
      mockFetchDexPriceUsdByMint.mockResolvedValue(2.5);
      
      const validator = startPriceValidator({
        redisGet: mockRedisGet,
        redisSet: mockRedisSet
      });
      
      await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {
          mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          reserveA: 5000
        }
      });
      
      expect(mockRedisGet).toHaveBeenCalledWith('price:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(mockFetchDexPriceUsdByMint).toHaveBeenCalledWith('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(mockRedisSet).toHaveBeenCalledWith('price:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', '2.5', 30);
    });

    it('should handle Redis errors gracefully', async () => {
      const mockRedisGet = jest.fn().mockRejectedValue(new Error('Redis connection error'));
      const mockRedisSet = jest.fn().mockRejectedValue(new Error('Redis set error'));
      mockFetchDexPriceUsdByMint.mockResolvedValue(1);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const validator = startPriceValidator({
        redisGet: mockRedisGet,
        redisSet: mockRedisSet
      });
      
      const result = await validator.validateCandidatePrice({
        signature: 'test-signature',
        reserves: {
          mintA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          reserveA: 15000
        }
      });
      
      expect(result.ok).toBe(true); // Should still work despite Redis errors
      expect(result.totalUsd).toBe(15000);
      expect(consoleSpy).toHaveBeenCalledWith('[raydium-price-validator] Redis get error:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('[raydium-price-validator] Redis set error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should provide stop method for cleanup', () => {
      const validator = startPriceValidator();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      validator.stop!();
      
      expect(consoleSpy).toHaveBeenCalledWith('[raydium-price-validator] Stopped');
      consoleSpy.mockRestore();
    });
  });
});