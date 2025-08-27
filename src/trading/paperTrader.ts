import { getLogger, Logger } from '../logging/logger';

/**
 * Position interface for paper trading
 */
export interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  timestamp: number;
  status: 'open' | 'closed';
  pnl?: number;
  meta?: Record<string, any>;
}

/**
 * Order request interface
 */
export interface OrderRequest {
  /** Optional order ID - will be generated if not provided */
  id?: string;
  /** Order side - buy or sell */
  side: 'buy' | 'sell';
  /** Quantity to trade */
  qty: number;
  /** Price per unit */
  price: number;
  /** Optional symbol/mint identifier */
  symbol?: string;
  /** Optional metadata */
  meta?: Record<string, any>;
}

/**
 * Order result interface
 */
export interface OrderResult {
  /** Order ID */
  id: string;
  /** Order status */
  status: 'filled' | 'rejected';
  /** Optional reason for rejection */
  reason?: string;
  /** Filled price (for successful orders) */
  filledPrice?: number;
  /** Filled quantity (for successful orders) */
  filledQty?: number;
  /** Timestamp of execution */
  timestamp: number;
}

/**
 * Paper trading implementation that simulates order execution without real trades.
 * This is a self-contained implementation for the listener service.
 */
export class PaperTrader {
  private logger: Logger;
  private runId: string;
  private positions: Map<string, Position> = new Map();

  /**
   * Create a new PaperTrader instance
   * @param runId - Optional run identifier, defaults to PAPER_RUN_ID env var or timestamp
   */
  constructor(runId?: string) {
    this.runId = runId || process.env.PAPER_RUN_ID || `paper-${Date.now()}`;
    this.logger = getLogger('paper-trader');
    
    this.logger.info('paper_trader_initialized', { 
      runId: this.runId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Place a paper order (simulated execution)
   * @param order - Order details
   * @returns Promise resolving to order result
   */
  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const orderId = order.id || `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = Date.now();

    this.logger.info('order_received', {
      orderId,
      side: order.side,
      qty: order.qty,
      price: order.price,
      symbol: order.symbol,
      runId: this.runId
    });

    // Validate order parameters
    if (order.qty <= 0) {
      this.logger.warn('order_rejected', { 
        orderId, 
        reason: 'invalid_quantity', 
        qty: order.qty 
      });
      return {
        id: orderId,
        status: 'rejected',
        reason: 'invalid_quantity',
        timestamp
      };
    }

    if (order.price <= 0) {
      this.logger.warn('order_rejected', { 
        orderId, 
        reason: 'invalid_price', 
        price: order.price 
      });
      return {
        id: orderId,
        status: 'rejected',
        reason: 'invalid_price',
        timestamp
      };
    }

    try {
      if (order.side === 'buy') {
        return await this.executeBuyOrder(orderId, order, timestamp);
      } else {
        return await this.executeSellOrder(orderId, order, timestamp);
      }
    } catch (error) {
      this.logger.error('order_execution_failed', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
        side: order.side
      });

      return {
        id: orderId,
        status: 'rejected',
        reason: 'execution_error',
        timestamp
      };
    }
  }

  /**
   * Get current positions
   * @returns Promise resolving to array of positions
   */
  async getPositions(): Promise<Position[]> {
    const openPositions = Array.from(this.positions.values())
      .filter(pos => pos.status === 'open');
    
    this.logger.debug('positions_retrieved', {
      count: openPositions.length,
      runId: this.runId
    });

    return openPositions;
  }

  /**
   * Get position by ID
   * @param positionId - Position identifier
   * @returns Position if found, undefined otherwise
   */
  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  /**
   * Execute a buy order (opens position)
   */
  private async executeBuyOrder(orderId: string, order: OrderRequest, timestamp: number): Promise<OrderResult> {
    const symbol = order.symbol || `UNKNOWN-${orderId.slice(-6)}`;

    // Create position
    const position: Position = {
      id: orderId,
      symbol,
      side: order.side,
      qty: order.qty,
      price: order.price,
      timestamp,
      status: 'open',
      meta: {
        paperTrader: true,
        runId: this.runId,
        originalOrder: order.meta
      }
    };

    this.positions.set(orderId, position);

    this.logger.info('buy_order_filled', {
      orderId,
      symbol,
      qty: order.qty,
      price: order.price,
      investmentUsd: order.qty * order.price,
      positionId: position.id
    });

    return {
      id: orderId,
      status: 'filled',
      filledPrice: order.price,
      filledQty: order.qty,
      timestamp
    };
  }

  /**
   * Execute a sell order (closes matching position)
   */
  private async executeSellOrder(orderId: string, order: OrderRequest, timestamp: number): Promise<OrderResult> {
    // Find matching open position
    const openPositions = Array.from(this.positions.values())
      .filter(pos => pos.status === 'open' && pos.side === 'buy');

    let targetPosition: Position | undefined;

    // Match by symbol if provided
    if (order.symbol) {
      targetPosition = openPositions.find(pos => pos.symbol === order.symbol && pos.qty >= order.qty);
    } else {
      // Find any position with sufficient quantity
      targetPosition = openPositions.find(pos => pos.qty >= order.qty);
    }

    if (!targetPosition) {
      this.logger.warn('sell_order_rejected', {
        orderId,
        reason: 'no_matching_position',
        requestedQty: order.qty,
        symbol: order.symbol,
        availablePositions: openPositions.length
      });

      return {
        id: orderId,
        status: 'rejected',
        reason: 'no_matching_position',
        timestamp
      };
    }

    // Calculate PnL
    const pnl = (order.price - targetPosition.price) * order.qty;

    // Close or partially close the position
    if (targetPosition.qty === order.qty) {
      // Close entire position
      targetPosition.status = 'closed';
      targetPosition.pnl = pnl;
    } else {
      // Partial close - reduce quantity
      targetPosition.qty -= order.qty;
    }

    this.logger.info('sell_order_filled', {
      orderId,
      positionId: targetPosition.id,
      qty: order.qty,
      price: order.price,
      pnl,
      entryPrice: targetPosition.price,
      remainingQty: targetPosition.qty
    });

    return {
      id: orderId,
      status: 'filled',
      filledPrice: order.price,
      filledQty: order.qty,
      timestamp
    };
  }
}