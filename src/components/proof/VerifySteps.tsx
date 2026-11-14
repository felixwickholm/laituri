import { Check, X } from "lucide-react";
import { replayView, type ReplayState } from "@/lib/console/verify-replay";

/** The three steps of the browser's check, with the step under way counting up and a bar for its progress. */
export function VerifySteps({ state }: { state: ReplayState }) {
  const steps = replayView(state);
  return (
    <ol className="verify-steps" data-tour="verify" aria-label="How your browser checks the log">
      {steps.map((step, index) => (
        <li key={step.key} className="verify-step" data-status={step.status}>
          <span className="verify-mark" aria-hidden="true">
            {step.status === "done" ? <Check /> : step.status === "failed" ? <X /> : index + 1}
          </span>
          <span className="verify-title">{step.title}</span>
          <span className="verify-line" aria-live={step.status === "active" ? "off" : "polite"}>
            {step.line}
          </span>
          {step.status === "active" ? (
            <span className="verify-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${step.fraction})` }} />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
