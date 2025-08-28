import {
  getCash,
  setCash,
  credit,
  debit,
  openPosition,
  markToMarket,
  closePositionByPrice,
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
    it('should initialize with default cash value', async () => {
      const cash = await getCash();
      expect(cash).toBe(1000); // Set in beforeEach
    });

    it('should credit and debit cash correctly', async () => {
      await credit(500);
      expect(await getCash()).toBe(1500);

      const success = await debit(200);
      expect(success).toBe(true);
      expect(await getCash()).toBe(1300);
    });

    it('should prevent overdraft', async () => {
      const success = await debit(1500); // More than available cash
      expect(success).toBe(false);
      expect(await getCash()).toBe(1000); // Cash unchanged
    });
  });

  describe('Position Management', () => {
    it('should open a position with proper cash debit', async () => {
      const position = await openPosition('DOGE', 0.1, 100);
      
      expect(position).not.toBeNull();
      expect(position!.name).toBe('DOGE');
      expect(position!.investment).toBe(100);
      expect(position!.entryPrice).toBe(0.1);
      expect(position!.qty).toBe(1000); // 100 USD / 0.1 price
      expect(position!.status).toBe('open');
      
      // Cash should be debited
      expect(await getCash()).toBe(900);
      
      // Position should be in open positions
      expect(getOpenPositions()).toHaveLength(1);
    });

    it('should reject position when insufficient cash', async () => {
      await setCash(50);
      
      const position = await openPosition('BTC', 50000, 100);
      
      expect(position).toBeNull();
      expect(await getCash()).toBe(50); // Cash unchanged
      expect(getOpenPositions()).toHaveLength(0);
    });

    it('should mark position to market correctly', async () => {
      const position = await openPosition('ETH', 2000, 200);
      expect(position).not.toBeNull();
      
      await markToMarket(position!.id, 2200);
      
      const openPositions = getOpenPositions();
      expect(openPositions).toHaveLength(1);
      
      const updated = openPositions[0];
      expect(updated.lastPrice).toBe(2200);
      expect(updated.pnlUSD).toBe(20); // (2200 - 2000) * 0.1 qty = 20
    });

    it('should close position and credit realized gains', async () => {
      const position = await openPosition('SOL', 100, 500);
      expect(position).not.toBeNull();
      expect(await getCash()).toBe(500); // 1000 - 500
      
      const closed = await closePositionByPrice(position!.id, 120);
      expect(closed).toBe(true);
      
      // Should credit back investment + profit
      // qty = 500 / 100 = 5, profit = (120 - 100) * 5 = 100
      expect(await getCash()).toBe(1100); // 500 + 500 + 100
      
      // Position should be moved to closed
      expect(getOpenPositions()).toHaveLength(0);
      expect(getClosedPositions()).toHaveLength(1);
      
      const closedPosition = getClosedPositions()[0];
      expect(closedPosition.status).toBe('closed');
      expect(closedPosition.lastPrice).toBe(120);
      expect(closedPosition.txCount?.sell).toBe(1);
    });

    it('should handle losses correctly when closing', async () => {
      const position = await openPosition('SHIB', 0.001, 100);
      expect(position).not.toBeNull();
      expect(await getCash()).toBe(900);
      
      const closed = await closePositionByPrice(position!.id, 0.0005);
      expect(closed).toBe(true);
      
      // qty = 100 / 0.001 = 100000, loss = (0.0005 - 0.001) * 100000 = -50
      expect(await getCash()).toBe(950); // 900 + 100 - 50
    });

    it('should return false when trying to close non-existent position', async () => {
      const closed = await closePositionByPrice('non-existent', 100);
      expect(closed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle mark to market on position without prices', async () => {
      // Create position without proper entry price
      const position = await openPosition('TEST', 1, 100);
      expect(position).not.toBeNull();
      
      // Manually clear entry price to test edge case
      const openPositions = getOpenPositions();
      openPositions[0].entryPrice = undefined;
      openPositions[0].qty = undefined;
      setOpenPositions(openPositions);
      
      // Should not crash
      await markToMarket(position!.id, 2);
      
      const updated = getOpenPositions()[0];
      expect(updated.lastPrice).toBe(2);
      expect(updated.pnlUSD).toBeUndefined();
    });

    it('should handle closing position without proper prices', async () => {
      const position = await openPosition('TEST', 1, 100);
      expect(position).not.toBeNull();
      
      // Manually clear prices to test edge case
      const openPositions = getOpenPositions();
      openPositions[0].entryPrice = undefined;
      openPositions[0].qty = undefined;
      openPositions[0].investment = undefined;
      setOpenPositions(openPositions);
      
      const initialCash = await getCash();
      const closed = await closePositionByPrice(position!.id, 2);
      
      expect(closed).toBe(true);
      expect(await getCash()).toBe(initialCash); // No change due to missing data
    });
  });
});