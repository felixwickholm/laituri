import { ArrowRight, CirclePause, History, UserRound } from "lucide-react";
import Link from "next/link";
import type { Side } from "../shell/nav";
import { AskValio } from "./AskValio";

const STEPS = [
  { icon: CirclePause, text: "Orders pause." },
  { icon: History, text: "The record comes back from its last sealed copy." },
  { icon: UserRound, text: "A person at Valio Aimo is told." },
];

/** The production answer when something looks wrong, in three short lines, and a way to reach a person. */
export function IfWrong({ side }: { side: Side }) {
  return (
    <section className="sec-block" aria-labelledby="wrong-title">
      <h2 id="wrong-title" className="section-title">
        If something looks wrong
      </h2>
      <div className="glass pad sec-wrong">
        <ol className="sec-wrong-steps">
          {STEPS.map((step) => (
            <li key={step.text}>
              <step.icon aria-hidden="true" />
              {step.text}
            </li>
          ))}
        </ol>
        {side === "buyer" ? (
          <AskValio />
        ) : (
          <Link href="/valio/handoffs" className="btn btn-secondary sec-ask-link">
            Questions from customers
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
