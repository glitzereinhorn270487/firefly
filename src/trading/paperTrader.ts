import { getLogger, LogContext } from '../logging/logger';
import { randomUUID } from 'crypto';

export interface TradeOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  slippage?: number;
  runId: string;
  timestamp: number;
}

export interface TradeResult {
  orderId: string;
  executed: boolean;
  executedAmount: number;
  executedPrice: number;
  fees: number;
  slippage: number;
  timestamp: number;
  simulated: boolean;
}

export interface TradeEvents {
  onTradeExecuted?: (result: TradeResult) => void;
  onTradeError?: (orderId: string, error: Error) => void;
}

/**
 * PaperTrader class that simulates trading operations
 * Provides the same interface as a real trader but only simulates trades
 */
export class PaperTrader {
  private logger = getLogger();
  private runId: string;
  private events: TradeEvents;
  private trades: Map<string, TradeResult> = new Map();

  constructor(runId?: string, events?: TradeEvents) {
    this.runId = runId || randomUUID();
    this.events = events || {};
  }

  /**
   * Place a simulated trade order
   */
  async placeOrder(order: Omit<TradeOrder, 'id' | 'runId' | 'timestamp'>): Promise<TradeResult> {
    const tradeOrder: TradeOrder = {
      id: randomUUID(),
      runId: this.runId,
      timestamp: Date.now(),
      ...order
    };

    const startTime = Date.now();

    try {
      // Simulate order processing delay (50-200ms)
      await this.simulateDelay(50 + Math.random() * 150);

      // Simulate slippage (0-2% additional)
      const simulatedSlippage = this.simulateSlippage(order.slippage || 0.5);
      
      // Simulate fees (0.25% typical for DEX)
      const simulatedFees = this.simulateFees(order.amount);
      
      // Calculate executed price with slippage
      const basePrice = order.price || 1.0;
      const executedPrice = order.side === 'buy' 
        ? basePrice * (1 + simulatedSlippage / 100)
        : basePrice * (1 - simulatedSlippage / 100);

      const result: TradeResult = {
        orderId: tradeOrder.id,
        executed: true,
        executedAmount: order.amount,
        executedPrice,
        fees: simulatedFees,
        slippage: simulatedSlippage,
        timestamp: Date.now(),
        simulated: true
      };

      // Persist the trade
      await this.persistTrade(tradeOrder, result);

      // Log the trade
      const latency = Date.now() - startTime;
      this.logger.info('Trade simulated', {
        event: 'trade.simulated',
        module: 'PaperTrader',
        runId: this.runId,
        latency_ms: latency,
        metadata: {
          orderId: result.orderId,
          symbol: order.symbol,
          side: order.side,
          amount: order.amount,
          executedPrice: result.executedPrice,
          fees: result.fees,
          slippage: result.slippage
        }
      });

      // Emit event
      if (this.events.onTradeExecuted) {
        this.events.onTradeExecuted(result);
      }

      return result;

    } catch (error) {
      const tradeError = error as Error;
      
      this.logger.error('Trade simulation failed', {
        event: 'trade.error',
        module: 'PaperTrader',
        runId: this.runId,
        latency_ms: Date.now() - startTime,
        metadata: {
          orderId: tradeOrder.id,
          symbol: order.symbol,
          error: tradeError.message
        }
      });

      if (this.events.onTradeError) {
        this.events.onTradeError(tradeOrder.id, tradeError);
      }

      throw tradeError;
    }
  }

  /**
   * Simulate trading slippage
   */
  private simulateSlippage(baseSlippage: number): number {
    // Add random variance (±0.5%) to base slippage
    const variance = (Math.random() - 0.5) * 1.0;
    return Math.max(0, baseSlippage + variance);
  }

  /**
   * Simulate trading fees
   */
  private simulateFees(amount: number): number {
    // Typical DEX fee: 0.25% of trade amount
    const feeRate = 0.0025;
    return amount * feeRate;
  }

  /**
   * Simulate network/processing delay
   */
  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Persist simulated trade to database stub
   * In a real implementation, this would write to a database
   */
  private async persistTrade(order: TradeOrder, result: TradeResult): Promise<void> {
    // Store in memory for now (database stub)
    this.trades.set(result.orderId, result);
    
    // Log persistence
    this.logger.debug('Trade persisted', {
      event: 'trade.persisted',
      module: 'PaperTrader',
      runId: this.runId,
      metadata: {
        orderId: result.orderId,
        symbol: order.symbol
      }
    });
  }

  /**
   * Get trade by order ID
   */
  getTrade(orderId: string): TradeResult | undefined {
    return this.trades.get(orderId);
  }

  /**
   * Get all trades for this session
   */
  getAllTrades(): TradeResult[] {
    return Array.from(this.trades.values());
  }

  /**
   * Get run ID for this trader instance
   */
  getRunId(): string {
    return this.runId;
  }
}