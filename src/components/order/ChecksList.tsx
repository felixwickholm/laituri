import { Check, CircleAlert, Hand, Minus } from "lucide-react";
import type { Check as PolicyCheck, Decision } from "@/lib/contracts";
import { askSentence, blockSentence, ruleName } from "@/lib/console/format/rules";
import { plainSentence } from "@/lib/console/format/sentence";

const GROUPS: { status: PolicyCheck["status"]; title: string }[] = [
  { status: "block", title: "Blocked" },
  { status: "ask", title: "Asked a person" },
  { status: "pass", title: "Passed" },
];

function Row({ check }: { check: PolicyCheck }) {
  return (
    <li>
      {check.status === "pass" ? (
        <Check aria-hidden="true" />
      ) : check.status === "ask" ? (
        <Hand aria-hidden="true" />
      ) : check.status === "block" ? (
        <CircleAlert aria-hidden="true" />
      ) : (
        <Minus aria-hidden="true" />
      )}
      <span className="check-rule">{ruleName(check.rule)}</span>
      <span className="check-msg">{detail(check)}</span>
    </li>
  );
}

function detail(check: PolicyCheck): string {
  if (check.status === "ask") return askSentence(check);
  if (check.status === "block") return blockSentence(check);
  return plainSentence(check.message);
}

/** Every mandate check, grouped by outcome. All of them are always listed. */
export function ChecksList({ decision }: { decision: Decision }) {
  // A rule that could not run (the mandate or offer was invalid) is neither passed nor blocking.
  const skipped = decision.checks.filter((check) => check.status === "skipped");
  return (
    <section className="section">
      <h3>
        Mandate checks <span className="count">{decision.checks.length}</span>
      </h3>
      {GROUPS.map((group) => {
        const checks = decision.checks.filter((check) => check.status === group.status);
        if (checks.length === 0) return null;
        return (
          <div key={group.status} className="check-group" data-status={group.status}>
            <h4>
              {group.title} <span className="count">{checks.length}</span>
            </h4>
            <ul>
              {checks.map((check) => (
                <Row key={check.rule} check={check} />
              ))}
            </ul>
          </div>
        );
      })}
      {skipped.length > 0 ? (
        <details className="check-group" data-status="skipped">
          <summary>
            Not checked <span className="count">{skipped.length}</span>
          </summary>
          <ul>
            {skipped.map((check) => (
              <Row key={check.rule} check={check} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
