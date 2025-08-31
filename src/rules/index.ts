export type Rule = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};

// Dummy rules for now
export const rules: Rule[] = [
  { id: "momentum", name: "Momentum", description: "Entry when momentum strong", active: true },
  { id: "liqburn", name: "Liquidity Burn", description: "Monitor LIQ burn + holder distribution", active: false },
];

export function getRules(): Rule[] {
  return rules;
}
