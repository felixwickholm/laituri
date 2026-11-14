import { useId } from "react";
import { ShieldCheck } from "lucide-react";
import { count } from "@/lib/console/format/money";
import { ruleTitle } from "@/lib/supplier-console/format";
import type { RuleStat } from "@/lib/supplier-console/types";
import { EmptyState } from "./bits";
import { PlainBars } from "./PlainBars";

const TIER_WORD = { ask: "Asked the customer", block: "Blocked" } as const;

/**
 * The customers' rules that held or stopped orders, one plain bar each with its count and what the rule did.
 * The limits behind them stay with the customer.
 */
export function RuleBars({ rules, title = "Held by rules" }: { rules: RuleStat[]; title?: string }) {
  const titleId = useId();
  const total = rules.reduce((sum, rule) => sum + rule.count, 0);
  return (
    <section className="block" aria-labelledby={titleId}>
      <header className="block-head">
        <h2 id={titleId}>
          {title} <span className="count">{count(total)}</span>
        </h2>
      </header>
      {rules.length === 0 ? (
        <EmptyState icon={ShieldCheck} text="No rule has held an order." />
      ) : (
        <div className="card">
          <PlainBars
            label={title}
            rows={rules.map((rule) => ({
              key: `${rule.rule}:${rule.tier}`,
              label: ruleTitle(rule),
              note: TIER_WORD[rule.tier],
              count: rule.count,
              tone: rule.tier === "ask" ? "warn" : "lost",
            }))}
          />
        </div>
      )}
    </section>
  );
}
