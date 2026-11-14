import { ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import { plainSentence } from "@/lib/console/format/sentence";
import type { Attempt } from "@/lib/console/runs";
import { StateWord } from "../ui/StateWord";
import { ToolRows } from "./ToolRows";

interface AttemptsProps {
  attempts: Attempt[];
  showTools: boolean;
  onOpenOrder: (orderId: string) => void;
  lastRef: RefObject<HTMLLIElement | null>;
}

/** The rule that held. A changed log entry is caught by the signed log itself, not by a mandate rule. */
function ruleLabel(attempt: Attempt): string | undefined {
  if (/\blog\b/i.test(attempt.action)) return "Signed log";
  return attempt.rule;
}

/** Scene 3 at a glance: each attempt, and the rule that stopped it. */
export function Attempts({ attempts, showTools, onOpenOrder, lastRef }: AttemptsProps) {
  return (
    <ol className="attempts">
      {attempts.map((attempt, index) => (
        <li key={attempt.n} ref={index === attempts.length - 1 ? lastRef : undefined} className="attempt" style={{ ["--i" as string]: Math.min(index, 5) }}>
          <span className="attempt-n mono">{attempt.n}</span>
          <span className="attempt-action">{plainSentence(attempt.action)}</span>
          <span className="attempt-state">
            {attempt.stopped === undefined ? (
              <StateWord word="Trying" tone="neutral" />
            ) : (
              <StateWord word={attempt.stopped ? "Stopped" : "Got through"} tone={attempt.stopped ? "danger" : "waiting"} />
            )}
          </span>
          {attempt.stopped !== undefined ? (
            <span className="attempt-rule">
              {ruleLabel(attempt) ? <strong>{ruleLabel(attempt)}.</strong> : null} {plainSentence(attempt.reason ?? "")}
              {attempt.orderId ? (
                <button type="button" className="text-link strong inline" onClick={() => onOpenOrder(attempt.orderId as string)}>
                  See the check
                  <ChevronRight aria-hidden="true" />
                </button>
              ) : null}
            </span>
          ) : null}
          {showTools ? <ToolRows tools={attempt.tools} /> : null}
        </li>
      ))}
    </ol>
  );
}
