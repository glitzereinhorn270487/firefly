import {
  RaydiumDeepFetcher,
  CandidateInput,
} from '../../src/validator/raydiumDeepFetcher';

// Mock dependencies
jest.mock('../../src/clients/redisClient', () => ({
  redisSet: jest.fn().mockResolvedValue(true),
}));

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn(),
}));

describe('RaydiumDeepFetcher', () => {
  let deepFetcher: RaydiumDeepFetcher;

  beforeEach(() => {
    // Use short timeouts for testing
    deepFetcher = new RaydiumDeepFetcher(5, 1000, 50);
    jest.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should create instance with default configuration', () => {
      const fetcher = new RaydiumDeepFetcher();
      const config = fetcher.getConfig();
      
      expect(config.concurrencyLimit).toBe(5);
      expect(config.timeoutMs).toBe(30000);
      expect(config.minLiquidityUsd).toBe(50);
      expect(config.rpcUrl).toBeDefined();
    });

    it('should create instance with custom configuration', () => {
      const fetcher = new RaydiumDeepFetcher(10, 60000, 100);
      const config = fetcher.getConfig();
      
      expect(config.concurrencyLimit).toBe(10);
      expect(config.timeoutMs).toBe(60000);
      expect(config.minLiquidityUsd).toBe(100);
    });

    it('should expose configuration through getConfig()', () => {
      const config = deepFetcher.getConfig();
      
      expect(config).toHaveProperty('concurrencyLimit');
      expect(config).toHaveProperty('timeoutMs');
      expect(config).toHaveProperty('minLiquidityUsd');
      expect(config).toHaveProperty('rpcUrl');
    });
  });

  describe('validateCandidate', () => {
    const mockCandidate: CandidateInput = {
      meta: {
        signature: 'test_signature_123',
        slot: 12345,
      },
      logs: ['test log'],
      time: Date.now(),
    };

    it('should return fetch-failed when transaction not found', async () => {
      const { Connection } = require('@solana/web3.js');
      const mockConnection = {
        getParsedTransaction: jest.fn().mockResolvedValue(null),
      };
      Connection.mockImplementation(() => mockConnection);

      const result = await deepFetcher.validateCandidate(mockCandidate);

      expect(result.status).toBe('fetch-failed');
      expect(result.reason).toBe('transaction_not_found');
      expect(result.signature).toBe(mockCandidate.meta.signature);
      expect(mockConnection.getParsedTransaction).toHaveBeenCalledWith(
        mockCandidate.meta.signature,
        { maxSupportedTransactionVersion: 0 }
      );
    });

    it('should process transaction with empty account keys', async () => {
      const mockParsedTx = {
        transaction: {
          message: {
            accountKeys: [], // Empty account keys
          },
        },
      };

      const { Connection } = require('@solana/web3.js');
      const mockConnection = {
        getParsedTransaction: jest.fn().mockResolvedValue(mockParsedTx),
      };
      Connection.mockImplementation(() => mockConnection);

      const result = await deepFetcher.validateCandidate(mockCandidate);

      // Should return some result status
      expect(result.status).toMatch(/^(validated|low-liquidity|fetch-failed|invalid)$/);
      expect(result.signature).toBe(mockCandidate.meta.signature);
    });

    it('should handle errors gracefully', async () => {
      const { Connection } = require('@solana/web3.js');
      const mockConnection = {
        getParsedTransaction: jest.fn().mockRejectedValue(new Error('Network error')),
      };
      Connection.mockImplementation(() => mockConnection);

      const result = await deepFetcher.validateCandidate(mockCandidate);

      expect(result.status).toBe('fetch-failed');
      expect(result.reason).toBe('transaction_not_found');
    });

    it('should return proper structure for all results', async () => {
      const { Connection } = require('@solana/web3.js');
      const mockConnection = {
        getParsedTransaction: jest.fn().mockResolvedValue(null),
      };
      Connection.mockImplementation(() => mockConnection);

      const result = await deepFetcher.validateCandidate(mockCandidate);

      // Validate result structure
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('slot');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('number');
      expect(result.signature).toBe(mockCandidate.meta.signature);
      expect(result.slot).toBe(mockCandidate.meta.slot);
    });
  });

  describe('environment configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use default values when env vars not set', () => {
      delete process.env.MIN_LIQUIDITY_USD;
      delete process.env.VALIDATOR_CONCURRENCY;
      delete process.env.VALIDATOR_TIMEOUT_MS;
      
      jest.resetModules();
      const { RaydiumDeepFetcher } = require('../../src/validator/raydiumDeepFetcher');
      
      const fetcher = new RaydiumDeepFetcher();
      const config = fetcher.getConfig();

      // Should use defaults
      expect(config.minLiquidityUsd).toBe(50);
      expect(config.concurrencyLimit).toBe(5);
      expect(config.timeoutMs).toBe(30000);
    });
  });

  describe('module safety', () => {
    it('should not throw on construction', () => {
      expect(() => new RaydiumDeepFetcher()).not.toThrow();
    });

    it('should handle concurrent validation requests safely', async () => {
      const mockCandidate1: CandidateInput = {
        meta: { signature: 'sig1', slot: 1 },
      };
      const mockCandidate2: CandidateInput = {
        meta: { signature: 'sig2', slot: 2 },
      };

      const { Connection } = require('@solana/web3.js');
      const mockConnection = {
        getParsedTransaction: jest.fn().mockResolvedValue(null),
      };
      Connection.mockImplementation(() => mockConnection);

      // Should handle multiple concurrent requests
      const [result1, result2] = await Promise.all([
        deepFetcher.validateCandidate(mockCandidate1),
        deepFetcher.validateCandidate(mockCandidate2),
      ]);

      expect(result1.signature).toBe('sig1');
      expect(result2.signature).toBe('sig2');
      expect(result1.status).toBe('fetch-failed');
      expect(result2.status).toBe('fetch-failed');
    });
  });
});