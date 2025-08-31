import { TradeDecision } from "./tradingEngine";

export interface PaperPosition {
  token: string;
  amount: number;
  entryPrice: number;
  timestamp: number;
}

const positions: PaperPosition[] = [];

export async function executePaperTrade(decision: TradeDecision, token: string, price: number) {
  if (decision.action === "buy") {
    positions.push({ token, amount: 1, entryPrice: price, timestamp: Date.now() });
    console.log("Paper BUY", token, "@", price);
  }
  if (decision.action === "sell") {
    const idx = positions.findIndex(p => p.token === token);
    if (idx >= 0) {
      const pos = positions.splice(idx, 1)[0];
      const pnl = price - pos.entryPrice;
      console.log("Paper SELL", token, "@", price, "PnL:", pnl);
    }
  }
}

export function listPaperPositions() {
  return positions;
}
