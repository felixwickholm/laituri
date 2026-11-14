import { Check, ChevronRight, Hand, Minus, X } from "lucide-react";
import type { Order } from "@/lib/contracts";
import { ruleChecklist } from "@/lib/console/format/rules";

/** "17 of 17 rules passed", a tick per rule, and every rule by name one tap away. */
export function RuleChecks({ order, approver }: { order: Order; approver: string }) {
  const list = ruleChecklist(order);
  if (list.total === 0) return null;
  const asked = list.rules.filter((rule) => rule.status === "ask").length;
  const blocked = list.rules.filter((rule) => rule.status === "block").length;
  const extra = blocked > 0 ? ` · ${blocked} blocked it` : asked > 0 ? ` · ${asked} ${asked === 1 ? "asks" : "ask"} ${approver}` : "";
  return (
    <details className="rule-checks" data-tour="checks">
      <summary>
        <span className="rule-ticks" aria-hidden="true">
          {list.rules.map((rule) => (
            <span key={rule.rule} data-status={rule.status} />
          ))}
        </span>
        <span className="rule-checks-line">
          {list.passed} of {list.total} rules passed
          {extra}
        </span>
        <ChevronRight className="rule-checks-chevron" aria-hidden="true" />
      </summary>
      <ol className="rule-list">
        {list.rules.map((rule) => (
          <li key={rule.rule} data-status={rule.status}>
            {rule.status === "pass" ? <Check aria-label="Passed" /> : rule.status === "ask" ? <Hand aria-label="Asks a person" /> : rule.status === "block" ? <X aria-label="Blocked" /> : <Minus aria-label="Not checked" />}
            {rule.name}
          </li>
        ))}
      </ol>
    </details>
  );
}
