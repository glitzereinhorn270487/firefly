// Setup fetch polyfill for Node.js testing environment
import fetch from 'node-fetch';

// Polyfill fetch for Node.js environment
if (!global.fetch) {
  global.fetch = fetch as any;
}

import {
  estimateReservesUSD,
  meetsMinimumValue,
  filterByMinimumValue,
  ReserveInfo,
  PriceEstimateOptions,
} from '../../src/listener/raydiumPriceValidator';
import { fetchDexPriceUsdByMint, getSolUsd } from '../../src/listener/priceUtils';

// Mock the price fetching functions
jest.mock('../../src/listener/priceUtils');

const mockFetchDexPriceUsdByMint = fetchDexPriceUsdByMint as jest.MockedFunction<typeof fetchDexPriceUsdByMint>;
const mockGetSolUsd = getSolUsd as jest.MockedFunction<typeof getSolUsd>;

describe('raydiumPriceValidator', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console warnings in tests
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('estimateReservesUSD', () => {
    it('should return zero for empty reserves array', async () => {
      const result = await estimateReservesUSD([]);
      
      expect(result.totalUsd).toBe(0);
      expect(result.reserves).toEqual([]);
      expect(result.hasValidData).toBe(false);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should estimate SOL reserves correctly', async () => {
      mockGetSolUsd.mockResolvedValue(100); // $100 per SOL
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112', // SOL mint
          amount: '5000000000', // 5 SOL (9 decimals)
          decimals: 9
        }
      ];

      const result = await estimateReservesUSD(reserves);
      
      expect(result.totalUsd).toBe(400); // 5 SOL * $100 * 0.8 (conservative factor)
      expect(result.reserves).toHaveLength(1);
      expect(result.reserves[0]).toEqual({
        mint: 'So11111111111111111111111111111111111111112',
        amountUi: 5,
        priceUsd: 100,
        valueUsd: 500,
        source: 'sol'
      });
      expect(result.hasValidData).toBe(true);
    });

    it('should estimate token reserves using DexScreener', async () => {
      mockGetSolUsd.mockResolvedValue(100);
      mockFetchDexPriceUsdByMint.mockResolvedValue(0.5); // $0.50 per token
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint (example)
          amount: '1000000000000', // 1000 tokens (with 9 decimals: 1000 * 10^9)
          decimals: 9
        }
      ];

      const result = await estimateReservesUSD(reserves);
      
      expect(result.totalUsd).toBe(400); // 1000 tokens * $0.50 * 0.8
      expect(result.reserves[0].source).toBe('dexscreener');
      expect(result.hasValidData).toBe(true);
    });

    it('should handle mixed SOL and token reserves', async () => {
      mockGetSolUsd.mockResolvedValue(100);
      mockFetchDexPriceUsdByMint.mockResolvedValue(2); // $2 per token
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: '1000000000', // 1 SOL
          decimals: 9
        },
        {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '500000000000', // 500 tokens
          decimals: 9
        }
      ];

      const result = await estimateReservesUSD(reserves);
      
      expect(result.totalUsd).toBe(880); // (1*100 + 500*2) * 0.8 = 1100 * 0.8
      expect(result.reserves).toHaveLength(2);
      expect(result.hasValidData).toBe(true);
    });

    it('should apply custom conservative factor', async () => {
      mockGetSolUsd.mockResolvedValue(100);
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: '1000000000', // 1 SOL
          decimals: 9
        }
      ];

      const options: PriceEstimateOptions = {
        conservativeFactor: 0.5 // More conservative
      };

      const result = await estimateReservesUSD(reserves, options);
      
      expect(result.totalUsd).toBe(50); // 1 SOL * $100 * 0.5
    });

    it('should handle price fetching failures gracefully', async () => {
      mockGetSolUsd.mockRejectedValue(new Error('Network error'));
      mockFetchDexPriceUsdByMint.mockRejectedValue(new Error('API error'));
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: '1000000000',
          decimals: 9
        }
      ];

      const result = await estimateReservesUSD(reserves);
      
      expect(result.totalUsd).toBe(0);
      expect(result.hasValidData).toBe(false);
      expect(result.reserves[0].priceUsd).toBeNull();
      expect(result.reserves[0].source).toBe('unknown');
    });

    it('should use fallback pricing when enabled', async () => {
      mockGetSolUsd.mockResolvedValue(100);
      mockFetchDexPriceUsdByMint.mockResolvedValue(undefined); // No price from DexScreener
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'SomeUnknownToken123456789',
          amount: '1000000000000', // 1000 tokens
          decimals: 9
        }
      ];

      const options: PriceEstimateOptions = {
        fallbackToSol: true
      };

      const result = await estimateReservesUSD(reserves, options);
      
      expect(result.totalUsd).toBe(80); // 1000 * (100 * 0.001) * 0.8 = 1000 * 0.1 * 0.8
      expect(result.reserves[0].source).toBe('fallback');
      expect(result.hasValidData).toBe(true);
    });

    it('should handle timeout scenarios', async () => {
      // Mock slow responses
      mockGetSolUsd.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(100), 6000)));
      mockFetchDexPriceUsdByMint.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(1), 6000)));
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: '1000000000',
          decimals: 9
        }
      ];

      const options: PriceEstimateOptions = {
        timeoutMs: 1000 // 1 second timeout
      };

      const result = await estimateReservesUSD(reserves, options);
      
      expect(result.totalUsd).toBe(0);
      expect(result.hasValidData).toBe(false);
    });

    it('should handle invalid reserve data', async () => {
      const reserves: ReserveInfo[] = [
        {
          mint: '',
          amount: '1000000000',
          decimals: 9
        },
        {
          mint: 'ValidMint123',
          amount: '', // Invalid amount
          decimals: 9
        }
      ];

      const result = await estimateReservesUSD(reserves);
      
      expect(result.reserves).toHaveLength(2);
      expect(result.reserves[0].source).toBe('unknown');
      expect(result.reserves[1].source).toBe('unknown');
      expect(result.totalUsd).toBe(0);
      expect(result.hasValidData).toBe(false);
    });
  });

  describe('meetsMinimumValue', () => {
    it('should return true when reserves meet minimum value', async () => {
      mockGetSolUsd.mockResolvedValue(100);
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: '20000000000', // 20 SOL = $2000 * 0.8 = $1600
          decimals: 9
        }
      ];

      const result = await meetsMinimumValue(reserves, 1000);
      expect(result).toBe(true);
    });

    it('should return false when reserves do not meet minimum value', async () => {
      mockGetSolUsd.mockResolvedValue(100);
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: '5000000000', // 5 SOL = $500 * 0.8 = $400
          decimals: 9
        }
      ];

      const result = await meetsMinimumValue(reserves, 1000);
      expect(result).toBe(false);
    });

    it('should return false on estimation error', async () => {
      mockGetSolUsd.mockRejectedValue(new Error('Network error'));
      
      const reserves: ReserveInfo[] = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: '20000000000',
          decimals: 9
        }
      ];

      const result = await meetsMinimumValue(reserves, 1000);
      expect(result).toBe(false);
    });
  });

  describe('filterByMinimumValue', () => {
    beforeEach(() => {
      mockGetSolUsd.mockResolvedValue(100);
    });

    it('should filter candidates based on minimum value', async () => {
      const candidates = [
        {
          id: 'pool1',
          reserves: [
            {
              mint: 'So11111111111111111111111111111111111111112',
              amount: '20000000000', // $1600 after conservative factor
              decimals: 9
            }
          ]
        },
        {
          id: 'pool2',
          reserves: [
            {
              mint: 'So11111111111111111111111111111111111111112',
              amount: '5000000000', // $400 after conservative factor
              decimals: 9
            }
          ]
        },
        {
          id: 'pool3',
          reserves: [
            {
              mint: 'So11111111111111111111111111111111111111112',
              amount: '15000000000', // $1200 after conservative factor
              decimals: 9
            }
          ]
        }
      ];

      const filtered = await filterByMinimumValue(candidates, 1000);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.id)).toEqual(['pool1', 'pool3']);
    });

    it('should handle candidates without reserves', async () => {
      const candidates = [
        { id: 'pool1', reserves: undefined },
        { id: 'pool2', reserves: [] },
        {
          id: 'pool3',
          reserves: [
            {
              mint: 'So11111111111111111111111111111111111111112',
              amount: '20000000000',
              decimals: 9
            }
          ]
        }
      ];

      const filtered = await filterByMinimumValue(candidates, 1000);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('pool3');
    });

    it('should handle errors in individual candidate processing', async () => {
      // Make SOL price fail for some calls but succeed for others
      let callCount = 0;
      mockGetSolUsd.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network error');
        }
        return Promise.resolve(100);
      });

      const candidates = [
        {
          id: 'pool1',
          reserves: [
            {
              mint: 'So11111111111111111111111111111111111111112',
              amount: '20000000000',
              decimals: 9
            }
          ]
        },
        {
          id: 'pool2',
          reserves: [
            {
              mint: 'So11111111111111111111111111111111111111112',
              amount: '20000000000',
              decimals: 9
            }
          ]
        }
      ];

      const filtered = await filterByMinimumValue(candidates, 1000);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('pool2');
    });
  });
});