import { Check, X } from "lucide-react";
import type { FlowStep } from "@/lib/console/format/flow";

/** Request, Lookup, Order, Approval: Valio Aimo's four steps, each with one sentence from this order. */
export function FlowSteps({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="flow-steps" aria-label="Request, Lookup, Order, Approval" data-tour="flow-steps">
      {steps.map((step, index) => (
        <li key={step.name} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="flow-dot" aria-hidden="true">
            {step.state === "done" ? <Check /> : step.state === "failed" ? <X /> : index + 1}
          </span>
          <span className="flow-name">{step.name}</span>
          <span className="flow-sentence">{step.sentence}</span>
        </li>
      ))}
    </ol>
  );
}

/** "Why this product": two or three short lines from the offer and the agent's search. */
export function WhyProduct({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section className="section why-product" aria-labelledby="why-title">
      <h3 id="why-title">Why this product</h3>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
