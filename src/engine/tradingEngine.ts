import { applyRules } from "../rules";

export type TradeAction = "buy" | "sell" | "hold";

export interface TradeDecision {
  action: TradeAction;
  reason?: string;
}

export async function decideTrade(input: unknown): Promise<TradeDecision> {
  // applyRules sollte "buy" | "sell" | "hold" liefern
  const action = await applyRules(input as any);
  // In ein Objekt verpacken, das zum erwarteten Typ passt
  return { action };
}

export default decideTrade;
