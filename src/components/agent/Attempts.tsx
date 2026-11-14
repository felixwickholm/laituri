import { ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import { stepText } from "@/lib/console/format/run-view";
import type { Attempt } from "@/lib/console/runs";
import { StateWord } from "../ui/StateWord";

interface AttemptsProps {
  attempts: Attempt[];
  onOpenOrder: (orderId: string) => void;
  lastRef: RefObject<HTMLLIElement | null>;
}

/** The rule that held. A changed log entry is caught by the signed log itself, not by a mandate rule. */
function ruleLabel(attempt: Attempt): string | undefined {
  if (/\blog\b/i.test(attempt.action)) return "Signed log";
  return attempt.rule;
}

/** Scene three as it happens: each attempt to break the rules, and the one-line reason it was refused. */
export function Attempts({ attempts, onOpenOrder, lastRef }: AttemptsProps) {
  return (
    <ol className="attempts" data-tour="attempts">
      {attempts.map((attempt, index) => (
        <li key={attempt.n} ref={index === attempts.length - 1 ? lastRef : undefined} className="attempt" data-stopped={attempt.stopped}>
          <span className="attempt-n num">{attempt.n}</span>
          <span className="attempt-action">{stepText(attempt.action)}</span>
          <span className="attempt-state">
            {attempt.stopped === undefined ? (
              <StateWord word="Trying" tone="neutral" />
            ) : (
              <StateWord word={attempt.stopped ? "Refused" : "Got through"} tone={attempt.stopped ? "danger" : "waiting"} />
            )}
          </span>
          {attempt.stopped !== undefined ? (
            <span className="attempt-rule">
              {ruleLabel(attempt) ? <strong>{ruleLabel(attempt)}.</strong> : null} {stepText(attempt.reason ?? "")}
              {attempt.orderId ? (
                <button type="button" className="text-link strong inline" onClick={() => onOpenOrder(attempt.orderId as string)}>
                  See the check
                  <ChevronRight aria-hidden="true" />
                </button>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
