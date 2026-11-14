"use client";

import { useEffect, useState } from "react";
import { BasketLineRow } from "../basket/BasketLineRow";
import { BasketCounts } from "../basket/BasketSummary";
import { AgentOrb } from "../orb/AgentOrb";
import { EXAMPLE_REQUEST, exampleFrame, finalFrame } from "./example-basket";

const TICK_MS = 120;
const DONE = finalFrame().counts;
const CAPTION = `An example weekly order: ${DONE.green} lines ordered, ${DONE.orange} needs a person, ${DONE.red} blocked.`;

/** The loop's clock: runs while the tab is visible; reduced motion holds the finished basket. */
function useLoop(): number | undefined {
  const [elapsed, setElapsed] = useState<number>();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    let total = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") total += Math.min(now - last, 500);
      last = now;
      setElapsed(total);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return elapsed;
}

/**
 * The hero's picture: an example weekly basket drawn with the product's own line rows, its lines turning green, orange
 * and red in a loop, with the agent's orb at work beside it. Labelled as an example; the live one is one press away.
 */
export function HeroBasket() {
  const elapsed = useLoop();
  const frame = elapsed === undefined ? finalFrame() : exampleFrame(elapsed);
  return (
    <figure className="lp-hero-visual">
      <div className="lp-hero-orb" aria-hidden="true">
        <AgentOrb state={frame.orb} digits="1000464306" size={240} />
      </div>
      <div className="lp-ex basket-card" data-ui="basket" inert>
        <div className="lp-ex-head">
          <span className="lp-ex-tag">Example</span>
          <span className="lp-ex-title">Weekly order for Monday</span>
        </div>
        <p className="lp-ex-ask">“{EXAMPLE_REQUEST}”</p>
        <BasketCounts counts={frame.counts} className="lp-ex-counts" />
        <ul className="basket-lines lp-ex-lines">
          {frame.lines.map((line) => (
            <BasketLineRow key={line.id} line={line} />
          ))}
        </ul>
      </div>
      <figcaption className="sr-only">{CAPTION}</figcaption>
    </figure>
  );
}
