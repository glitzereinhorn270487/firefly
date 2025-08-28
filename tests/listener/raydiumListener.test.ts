import { startRaydiumListener, stopRaydiumListener } from '../../src/listener/raydiumListener';

describe('Raydium Listener', () => {
  describe('module exports', () => {
    it('should export startRaydiumListener function', () => {
      expect(typeof startRaydiumListener).toBe('function');
    });

    it('should export stopRaydiumListener function', () => {
      expect(typeof stopRaydiumListener).toBe('function');
    });
  });

  describe('stopRaydiumListener', () => {
    it('should run without error when no listener is active', () => {
      expect(() => stopRaydiumListener()).not.toThrow();
    });
  });
});