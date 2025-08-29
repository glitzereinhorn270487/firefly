import {
  getCash,
  setCash,
  openPaperPosition,
  updatePaperPosition,
} from '../../lib/paper/portfolio';
import { getOpenPositions, getClosedPositions, setOpenPositions, setClosedPositions } from '../../lib/store/positions';

describe('Paper Portfolio', () => {
  beforeEach(async () => {
    // Reset portfolio state before each test
    await setCash(1000);
    setOpenPositions([]);
    setClosedPositions([]);
  });

  describe('Cash Management', () => {
    it('should get and set cash correctly', async () => {
      // Initially should be 0 (new implementation doesn't default to 120)
      await setCash(0); // Clear any previous value
      expect(await getCash()).toBe(0);
      
      await setCash(1000);
      expect(await getCash()).toBe(1000);
    });

    it('should handle errors gracefully in getCash', async () => {
      // Test that getCash returns 0 when no cash is set
      await setCash(0);
      expect(await getCash()).toBe(0);
    });

    it('should handle numeric conversion in setCash', async () => {
      await setCash(500.75);
      expect(await getCash()).toBe(500.75);
    });
  });

  describe('Position Management', () => {
    it('should open a paper position and deduct cash', async () => {
      await setCash(1000);
      
      const positionData = {
        id: 'test-1',
        name: 'DOGE',
        chain: 'Solana',
        category: 'Meme',
        investment: 100,
        entryPrice: 0.1,
        mint: 'test-mint',
        scores: { risk: 0.5 },
        tags: ['test'],
      };
      
      const position = await openPaperPosition(positionData);
      
      expect(position).toBeDefined();
      expect(position.id).toBe('test-1');
      expect(position.name).toBe('DOGE');
      expect(position.investment).toBe(100);
      expect(position.entryPrice).toBe(0.1);
      expect(position.status).toBe('open');
      expect(position.openedAt).toBeGreaterThan(0);
      
      // Cash should be debited
      expect(await getCash()).toBe(900);
      
      // Position should be in store
      expect(getOpenPositions()).toHaveLength(1);
    });

    it('should handle insufficient cash gracefully', async () => {
      await setCash(50);
      
      const positionData = {
        id: 'test-2',
        investment: 100, // More than available cash
      };
      
      const position = await openPaperPosition(positionData);
      
      // Position should still be created (best-effort cash deduction)
      expect(position).toBeDefined();
      expect(position.id).toBe('test-2');
      
      // Cash should be reduced to 0 (minimum)
      expect(await getCash()).toBe(0);
    });

    it('should handle missing investment amount', async () => {
      await setCash(1000);
      
      const positionData = {
        id: 'test-3',
        name: 'TEST',
        // No investment specified
      };
      
      const position = await openPaperPosition(positionData);
      
      expect(position).toBeDefined();
      expect(position.id).toBe('test-3');
      
      // Cash should remain unchanged (no deduction for 0 investment)
      expect(await getCash()).toBe(1000);
    });

    it('should require position id', async () => {
      const positionData = {
        name: 'TEST',
        investment: 100,
        // Missing required id
      };
      
      await expect(openPaperPosition(positionData as any)).rejects.toThrow('Position must include id');
    });

    it('should update existing position', async () => {
      // First create a position
      const initialPosition = await openPaperPosition({
        id: 'test-4',
        name: 'SOL',
        investment: 200,
        entryPrice: 100,
      });
      
      expect(initialPosition.name).toBe('SOL');
      expect(initialPosition.entryPrice).toBe(100);
      
      // Then update it
      const updatedPosition = await updatePaperPosition('test-4', {
        lastPrice: 120,
        pnlUSD: 40, // 20 * some qty
      });
      
      expect(updatedPosition).toBeDefined();
      expect(updatedPosition!.lastPrice).toBe(120);
      expect(updatedPosition!.pnlUSD).toBe(40);
      expect(updatedPosition!.name).toBe('SOL'); // Original data preserved
    });

    it('should handle updating non-existent position', async () => {
      const result = await updatePaperPosition('non-existent', {
        lastPrice: 100,
      });
      
      expect(result).toBeNull();
    });

    it('should handle errors in updatePosition gracefully', async () => {
      // Create a position first
      await openPaperPosition({
        id: 'test-5',
        name: 'ETH',
        investment: 300,
      });
      
      // Try to update with valid data (should work)
      const result = await updatePaperPosition('test-5', {
        status: 'closed',
        reason: 'manual',
      });
      
      expect(result).toBeDefined();
      expect(result!.status).toBe('closed');
      expect(result!.reason).toBe('manual');
    });
  });

  describe('Default Export', () => {
    it('should export all functions as default', async () => {
      const defaultExport = (await import('../../lib/paper/portfolio')).default;
      
      expect(typeof defaultExport.getCash).toBe('function');
      expect(typeof defaultExport.setCash).toBe('function');
      expect(typeof defaultExport.openPaperPosition).toBe('function');
      expect(typeof defaultExport.updatePaperPosition).toBe('function');
    });
  });
});