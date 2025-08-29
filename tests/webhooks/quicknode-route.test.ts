import { 
  parseEnvList, 
  verifyHmacSignature, 
  getRedisClient,
  resetRedisClient,
  alreadySeenKey,
  isAlreadySeen,
  markAsSeen,
  extractPoolAddress
} from '../../lib/webhooks/quicknode-utils';
import crypto from 'crypto';

describe('QuickNode Utils', () => {
  describe('parseEnvList', () => {
    it('should parse comma-separated values', () => {
      expect(parseEnvList('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('should handle spaces around values', () => {
      expect(parseEnvList(' a , b , c ')).toEqual(['a', 'b', 'c']);
    });

    it('should filter empty values', () => {
      expect(parseEnvList('a,,b,,')).toEqual(['a', 'b']);
    });

    it('should return empty array for undefined/null', () => {
      expect(parseEnvList(undefined)).toEqual([]);
      expect(parseEnvList('')).toEqual([]);
    });
  });

  describe('verifyHmacSignature', () => {
    it('should verify valid HMAC signature', () => {
      const secret = 'test-secret';
      const payload = '{"test":"data"}';
      const nonce = '123';
      const timestamp = '456';
      
      const data = `${nonce}${timestamp}${payload}`;
      const mac = crypto.createHmac('sha256', Buffer.from(secret));
      mac.update(Buffer.from(data));
      const signature = mac.digest('hex');
      
      expect(verifyHmacSignature(payload, signature, secret, nonce, timestamp)).toBe(true);
    });

    it('should reject invalid signature', () => {
      expect(verifyHmacSignature('payload', 'invalid', 'secret', 'nonce', 'timestamp')).toBe(false);
    });

    it('should reject missing parameters', () => {
      expect(verifyHmacSignature('', 'sig', 'secret')).toBe(false);
      expect(verifyHmacSignature('payload', '', 'secret')).toBe(false);
      expect(verifyHmacSignature('payload', 'sig', '')).toBe(false);
    });
  });

  describe('Redis operations', () => {
    let redis: ReturnType<typeof getRedisClient>;
    
    beforeEach(() => {
      // Use in-memory client for testing (no Upstash env vars set)
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      resetRedisClient(); // Reset singleton
      redis = getRedisClient();
    });

    describe('alreadySeenKey', () => {
      it('should generate consistent keys for same pool within window', () => {
        const poolAddress = 'test-pool-123';
        const key1 = alreadySeenKey(poolAddress);
        const key2 = alreadySeenKey(poolAddress);
        
        expect(key1).toBe(key2);
        expect(key1).toContain('quicknode:pool:test-pool-123:');
      });
      
      it('should generate different keys for different time windows', (done) => {
        const poolAddress = 'test-pool-123';
        const key1 = alreadySeenKey(poolAddress, 0.001); // Very small window
        
        setTimeout(() => {
          const key2 = alreadySeenKey(poolAddress, 0.001);
          expect(key1).not.toBe(key2);
          done();
        }, 100);
      });
    });

    describe('deduplication', () => {
      it('should mark and detect seen pools', async () => {
        const poolAddress = 'test-pool-dedup';
        
        // Initially not seen
        expect(await isAlreadySeen(poolAddress)).toBe(false);
        
        // Mark as seen
        await markAsSeen(poolAddress);
        
        // Should now be seen
        expect(await isAlreadySeen(poolAddress)).toBe(true);
      });
    });
  });

  describe('extractPoolAddress', () => {
    it('should extract pool address from direct poolAddress property', () => {
      const input = { poolAddress: 'direct-pool-address' };
      expect(extractPoolAddress(input)).toBe('direct-pool-address');
    });

    it('should extract pool address from transaction message accountKeys', () => {
      const input = { 
        transaction: { 
          message: { 
            accountKeys: [{ pubkey: 'account-key-pool' }] 
          } 
        } 
      };
      expect(extractPoolAddress(input)).toBe('account-key-pool');
    });

    it('should extract pool address from value.transaction.message.accountKeys', () => {
      const input = { 
        value: { 
          transaction: { 
            message: { 
              accountKeys: ['long-string-account-key'] 
            } 
          } 
        } 
      };
      expect(extractPoolAddress(input)).toBe('long-string-account-key');
    });

    it('should extract pool address from message.accountKeys', () => {
      const input = { 
        message: { 
          accountKeys: ['direct-message-account-key'] 
        } 
      };
      expect(extractPoolAddress(input)).toBe('direct-message-account-key');
    });

    it('should extract pool address even for short strings', () => {
      const input = { poolAddress: 'short' };
      expect(extractPoolAddress(input)).toBe('short');
    });

    it('should return null for invalid/missing data', () => {
      expect(extractPoolAddress({})).toBe(null);
      expect(extractPoolAddress(null)).toBe(null);
      expect(extractPoolAddress({ transaction: {} })).toBe(null);
    });
  });
});