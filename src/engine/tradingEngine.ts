// src/engine/tradingEngine.ts
import { applyRules } from "../rules";

// Aktionstypen strikt halten
export type Action = "buy" | "sell" | "hold";

// Einheitlicher Rückgabe-Typ
export interface TradeDecision {
  action: Action;
  reason?: string;
  size?: number;
}

// Hauptfunktion: immer ein TradeDecision-Objekt zurückgeben
function decideTrade(input: unknown): TradeDecision {
  const outcome = applyRules(input as any);

  // outcome kann string ("buy" | "sell" | "hold") ODER ein Objekt sein
  const action: Action =
    outcome === "buy" || outcome === "sell" || outcome === "hold"
      ? outcome
      : (outcome?.action as Action) ?? "hold";

  return {
    action,
    reason: typeof outcome === "object" && outcome !== null ? (outcome as any).reason : undefined,
    size: typeof outcome === "object" && outcome !== null ? (outcome as any).size : undefined,
  };
}

export default decideTrade;
// Named export für bestehende Importe in der API-Route
export { decideTrade as runTradingEngine };
