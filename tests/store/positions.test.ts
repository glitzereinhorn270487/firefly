import {
  Position,
  openPosition,
  closePosition,
  updatePosition,
  getPosition,
  getOpenPositions,
  getClosedPositions,
  listPositions,
  setOpenPositions,
  setClosedPositions,
} from '../../lib/store/positions';

describe('Position Store', () => {
  beforeEach(() => {
    // Clear all positions before each test
    setOpenPositions([]);
    setClosedPositions([]);
  });

  describe('openPosition', () => {
    it('should create and store an open position', () => {
      const position: Position = {
        id: 'test-1',
        name: 'Test Token',
        chain: 'SOL',
        category: 'Meme',
        investment: 100,
        entryPrice: 1.5,
        qty: 66.67,
        openedAt: Date.now(),
      };

      const result = openPosition(position);
      
      expect(result.status).toBe('open');
      expect(result.closedAt).toBeUndefined();
      expect(getPosition('test-1')).toEqual(result);
      expect(getOpenPositions()).toHaveLength(1);
      expect(getClosedPositions()).toHaveLength(0);
    });

    it('should move position from closed to open if it already exists', () => {
      const position: Position = {
        id: 'test-1',
        name: 'Test Token',
        status: 'closed',
        closedAt: Date.now(),
      };

      setClosedPositions([position]);
      expect(getClosedPositions()).toHaveLength(1);

      openPosition(position);
      
      expect(getOpenPositions()).toHaveLength(1);
      expect(getClosedPositions()).toHaveLength(0);
      expect(getPosition('test-1')?.status).toBe('open');
    });
  });

  describe('closePosition', () => {
    it('should close an open position with reason', () => {
      const position: Position = {
        id: 'test-1',
        name: 'Test Token',
        status: 'open',
        openedAt: Date.now(),
      };

      openPosition(position);
      const result = closePosition('test-1', 'manual');
      
      expect(result).not.toBeNull();
      expect(result!.status).toBe('closed');
      expect(result!.reason).toBe('manual');
      expect(result!.closedAt).toBeGreaterThan(0);
      expect(getOpenPositions()).toHaveLength(0);
      expect(getClosedPositions()).toHaveLength(1);
    });

    it('should return null for non-existent position', () => {
      const result = closePosition('non-existent');
      expect(result).toBeNull();
    });

    it('should use default reason when none provided', () => {
      const position: Position = { id: 'test-1' };
      openPosition(position);
      
      const result = closePosition('test-1');
      expect(result!.reason).toBe('closed');
    });
  });

  describe('updatePosition', () => {
    it('should update existing position fields', () => {
      const position: Position = {
        id: 'test-1',
        name: 'Test Token',
        investment: 100,
        entryPrice: 1.5,
      };

      openPosition(position);
      const result = updatePosition('test-1', {
        lastPrice: 2.0,
        pnlUSD: 33.33,
      });
      
      expect(result).not.toBeNull();
      expect(result!.lastPrice).toBe(2.0);
      expect(result!.pnlUSD).toBe(33.33);
      expect(result!.name).toBe('Test Token'); // Original fields preserved
    });

    it('should move position between maps when status changes', () => {
      const position: Position = { id: 'test-1', status: 'open' };
      openPosition(position);
      
      expect(getOpenPositions()).toHaveLength(1);
      expect(getClosedPositions()).toHaveLength(0);
      
      updatePosition('test-1', { status: 'closed' });
      
      expect(getOpenPositions()).toHaveLength(0);
      expect(getClosedPositions()).toHaveLength(1);
    });

    it('should return null for non-existent position', () => {
      const result = updatePosition('non-existent', { name: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('listPositions', () => {
    it('should return all positions sorted by openedAt (newest first)', () => {
      const oldPosition: Position = {
        id: 'old',
        openedAt: 1000,
        status: 'closed',
      };
      const newPosition: Position = {
        id: 'new',
        openedAt: 2000,
        status: 'open',
      };

      openPosition(newPosition);
      setClosedPositions([oldPosition]);
      
      const result = listPositions();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('new'); // Newest first
      expect(result[1].id).toBe('old');
    });

    it('should handle positions without openedAt', () => {
      const positionWithoutTimestamp: Position = { id: 'no-timestamp' };
      const positionWithTimestamp: Position = { id: 'with-timestamp', openedAt: 1000 };

      openPosition(positionWithoutTimestamp);
      openPosition(positionWithTimestamp);
      
      const result = listPositions();
      expect(result).toHaveLength(2);
      // Position with timestamp should come first (1000 > 0)
      expect(result[0].id).toBe('with-timestamp');
    });
  });

  describe('setOpenPositions and setClosedPositions', () => {
    it('should replace open positions completely', () => {
      const initialPosition: Position = { id: 'initial', status: 'open' };
      openPosition(initialPosition);
      
      const newPositions: Position[] = [
        { id: 'new-1', name: 'Token 1' },
        { id: 'new-2', name: 'Token 2' },
      ];
      
      setOpenPositions(newPositions);
      
      const openPositions = getOpenPositions();
      expect(openPositions).toHaveLength(2);
      expect(openPositions.find(p => p.id === 'initial')).toBeUndefined();
      expect(openPositions.find(p => p.id === 'new-1')).toBeDefined();
      expect(openPositions.find(p => p.id === 'new-2')).toBeDefined();
      
      // All should have status 'open' and no closedAt
      openPositions.forEach(p => {
        expect(p.status).toBe('open');
        expect(p.closedAt).toBeUndefined();
      });
    });

    it('should replace closed positions completely', () => {
      const closedPositions: Position[] = [
        { id: 'closed-1', name: 'Closed Token 1' },
        { id: 'closed-2', name: 'Closed Token 2' },
      ];
      
      setClosedPositions(closedPositions);
      
      const result = getClosedPositions();
      expect(result).toHaveLength(2);
      
      // All should have status 'closed' and closedAt timestamp
      result.forEach(p => {
        expect(p.status).toBe('closed');
        expect(p.closedAt).toBeGreaterThan(0);
        expect(p.reason).toBe('closed');
      });
    });
  });
});