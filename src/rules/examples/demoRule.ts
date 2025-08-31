import type { Rule, RuleResult } from "../types";

export const demoRule: Rule = {
  id: "demo/ok",
  name: "Always OK",
  description: "Returns ok = true.",
  run: (ctx): RuleResult => ({
    id: "demo/ok",
    ok: true,
    detail: new Date(ctx.now).toISOString(),
  }),
};
