// src/engine/tradingEngine.ts
import { applyRules } from "../rules";

export type Action = "buy" | "sell" | "hold";

export interface TradeDecision {
  action: Action;
  reason?: string;
  size?: number;
}

// ---- Type Guards -------------------------------------------------
function isAction(x: unknown): x is Action {
  return x === "buy" || x === "sell" || x === "hold";
}

function isDecisionLike(x: unknown): x is Partial<TradeDecision> {
  return typeof x === "object" && x !== null && "action" in (x as any);
}

// ---- Engine (always returns a TradeDecision object) --------------
function decideTrade(input: unknown): TradeDecision {
  const outcome = applyRules(input as any) as unknown;

  let action: Action = "hold";
  let reason: string | undefined;
  let size: number | undefined;

  if (isAction(outcome)) {
    action = outcome;
  } else if (isDecisionLike(outcome)) {
    const maybeAction = (outcome as any).action;
    if (isAction(maybeAction)) action = maybeAction;
    reason = (outcome as any).reason;
    size = (outcome as any).size;
  }

  return { action, reason, size };
}

export default decideTrade;
// Für bestehende named-Imports (z.B. in app/api/trade/route.ts)
export { decideTrade as runTradingEngine };
