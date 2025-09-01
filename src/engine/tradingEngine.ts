import { applyRules } from "../rules";

export interface TradeDecision {
  action: "buy" | "sell" | "hold";
  reason: string;
  score?: number;
}

export async function runTradingEngine(event: any): Promise<TradeDecision> {
  // Placeholder: apply rules to incoming event
  const decision = await applyRules(event);

  // TODO: risk management, capital allocation, logging
  return decision;
}
