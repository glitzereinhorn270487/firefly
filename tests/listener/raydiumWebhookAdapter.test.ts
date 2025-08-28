import { startWebhookAdapter } from '../../src/listener/raydiumWebhookAdapter';

describe('Raydium Webhook Adapter', () => {
  describe('module exports', () => {
    it('should export startWebhookAdapter function', () => {
      expect(typeof startWebhookAdapter).toBe('function');
    });
  });

  describe('startWebhookAdapter', () => {
    it('should be defined and callable', () => {
      expect(startWebhookAdapter).toBeDefined();
      expect(typeof startWebhookAdapter).toBe('function');
    });

    it('should return an object with url and stop function when called with basic options', async () => {
      const adapter = await startWebhookAdapter({ 
        port: 0, 
        onCandidate: async (c) => console.log('test candidate:', c) 
      });
      
      expect(adapter).toBeDefined();
      expect(typeof adapter.url).toBe('string');
      expect(typeof adapter.stop).toBe('function');
      
      // Clean up
      await adapter.stop();
    });

    // Note: We can't test the full functionality without the raydiumWebhook and raydiumDeepFetcher modules
    // which are expected to be added in PRs #20, #21, #22. This test just verifies the module structure.
  });
});