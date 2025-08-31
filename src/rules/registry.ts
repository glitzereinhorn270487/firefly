import type { Rule } from "./types";

const _rules: Rule[] = [];

export function register(rule: Rule): void {
  _rules.push(rule);
}

export function all(): Rule[] {
  return _rules.slice();
}

export function byId(id: string): Rule | undefined {
  return _rules.find(r => r.id === id);
}
