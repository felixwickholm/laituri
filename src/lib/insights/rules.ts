import type { Order } from "@/lib/contracts";
import { ruleName } from "@/lib/console/format/rules";
import type { RuleStat } from "./types";

/**
 * The mandate rules that stopped or held orders, most frequent first. Only the rule and its tier are counted:
 * the limits and values behind a check are the buyer's business.
 */
export function firedRules(orders: Order[]): RuleStat[] {
  const counts = new Map<string, RuleStat>();
  for (const order of orders) {
    for (const check of order.decision.checks) {
      if (check.status !== "ask" && check.status !== "block") continue;
      const key = `${check.rule}:${check.status}`;
      const stat = counts.get(key) ?? { rule: check.rule, title: ruleName(check.rule), tier: check.status, count: 0 };
      stat.count += 1;
      counts.set(key, stat);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule) || a.tier.localeCompare(b.tier));
}
