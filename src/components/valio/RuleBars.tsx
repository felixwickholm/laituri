import { useId } from "react";
import { ShieldCheck } from "lucide-react";
import { count } from "@/lib/console/format/money";
import { ruleTitle } from "@/lib/supplier-console/format";
import type { RuleStat } from "@/lib/supplier-console/types";
import { EmptyState } from "./bits";

const TIER_WORD = { ask: "Asked the buyer", block: "Blocked" } as const;

/**
 * The buyers' rules that held or stopped orders, as horizontal bars by count.
 * Amber: the rule asked a person. Red: the rule refused the order. The limits behind them stay with the buyer.
 */
export function RuleBars({ rules, title = "Rules that fired" }: { rules: RuleStat[]; title?: string }) {
  const titleId = useId();
  const max = Math.max(1, ...rules.map((rule) => rule.count));
  const total = rules.reduce((sum, rule) => sum + rule.count, 0);
  return (
    <section className="block" aria-labelledby={titleId}>
      <header className="block-head">
        <h2 id={titleId}>
          {title} <span className="count">{count(total)}</span>
        </h2>
        <span className="block-meta tier-key">
          <span className="tier-dot" data-tier="ask" aria-hidden="true" />
          Ask
          <span className="tier-dot" data-tier="block" aria-hidden="true" />
          Block
        </span>
      </header>
      {rules.length === 0 ? (
        <EmptyState icon={ShieldCheck} text="No buyer rule has held or stopped an order yet." />
      ) : (
        <div className="card">
          <ol className="bar-list">
            {rules.map((rule) => (
              <li key={`${rule.rule}:${rule.tier}`} className="bar-row">
                <span className="bar-name">
                  {ruleTitle(rule)}
                  <span className="sub">{TIER_WORD[rule.tier]}</span>
                </span>
                <span className="bar-lane">
                  <span className="hbar" data-tier={rule.tier} style={{ transform: `scaleX(${rule.count / max})` }} />
                </span>
                <span className="bar-count num">{count(rule.count)}</span>
              </li>
            ))}
          </ol>
          <p className="card-note">Valio Aimo sees which rule fired. The limit behind it stays in the buyer&rsquo;s signed mandate.</p>
        </div>
      )}
    </section>
  );
}
