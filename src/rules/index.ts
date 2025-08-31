export interface RuleContext {
  price: number;
  volume: number;
  [key: string]: any;
}

export function applyRules(ctx: RuleContext): "buy" | "sell" | "hold" {
  // Minimal-Stub → immer "hold"
  return "hold";
}

export type Rule = {
  id: string;
  name: string;
  condition: string;
  enabled: boolean;
};

export const sampleRules: Rule[] = [
  { id: "1", name: "Risk Check", condition: "position.size < 1000", enabled: true },
  { id: "2", name: "Stop Loss", condition: "price < entry * 0.9", enabled: true }
];
