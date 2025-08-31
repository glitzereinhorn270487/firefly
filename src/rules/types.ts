export interface RuleContext {
  now: number;
}

export interface RuleResult {
  id: string;
  ok: boolean;
  detail?: string;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  run(ctx: RuleContext): Promise<RuleResult> | RuleResult;
}
