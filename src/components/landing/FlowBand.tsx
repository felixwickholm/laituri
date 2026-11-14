import { ArrowRight } from "lucide-react";
import { WeekLine } from "./WeekLine";

/** Valio Aimo's challenge sheet names the flow in four words. Each one here, in that order, with what happens. */
const FLOW = [
  { word: "Request", line: "The agent asks." },
  { word: "Lookup", line: "Finds products, prices, stock." },
  { word: "Order", line: "Commits at a fixed price." },
  { word: "Approval", line: "Agent decides, or a person signs." },
];

/** The flow as one band: four words, four short lines, and this demo week's figures in one sentence. */
export function FlowBand() {
  return (
    <section className="lp-flow" aria-labelledby="lp-flow-title">
      <div className="lp-flow-inner">
        <h2 id="lp-flow-title" className="sr-only">
          How an order flows
        </h2>
        <ol className="lp-flow-steps">
          {FLOW.map((step, index) => (
            <li key={step.word}>
              <span className="lp-flow-word">{step.word}</span>
              <span className="lp-flow-line">{step.line}</span>
              {index < FLOW.length - 1 ? <ArrowRight className="lp-flow-arrow" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
        <WeekLine />
      </div>
    </section>
  );
}
