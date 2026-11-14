import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GLOSS } from "../shell/brand-copy";
import { TourLink } from "../tour/TourLink";
import { HeroBasket } from "./HeroBasket";
import { stagger } from "./stagger";
import { TryExample } from "./TryExample";

/** The challenge sheet's three promises, each in one plain line. */
const PROOF = [
  { word: "Safe", line: "Your agent cannot break your limits." },
  { word: "Open", line: "Any AI agent can connect. No lock-in." },
  { word: "Human approval", line: "A person signs what matters." },
];

/** The first screen: one line, one sub-line, one big button, and the example basket at work beside it. */
export function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="lp-title">
      <div className="lp-hero-text">
        <h1 id="lp-title" className="lp-h1 enter" style={stagger(0)}>
          <span className="lp-h1-line">Your AI agent orders.</span> <span className="lp-h1-line">You stay in control.</span>
        </h1>
        <p className="lp-lede enter" style={stagger(1)}>
          Laituri is the dock where customers’ AI agents buy from Valio Aimo. Fixed prices. Your limits. Proof on every order.
        </p>
        <div className="lp-actions enter" style={stagger(2)}>
          <TourLink className="btn btn-primary big lp-cta">
            Demo walkthrough
            <ArrowRight aria-hidden="true" />
          </TourLink>
          <TryExample className="btn btn-secondary big" />
          <Link href="/buyer" className="btn btn-quiet big">
            Try it yourself
          </Link>
        </div>
        <p className="lp-gloss enter" style={stagger(3)}>
          {GLOSS}
        </p>
        <ul className="lp-proof enter" style={stagger(4)}>
          {PROOF.map((point) => (
            <li key={point.word}>
              <strong>{point.word}</strong>
              <span>{point.line}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="lp-hero-side enter" style={stagger(2)}>
        <HeroBasket />
      </div>
    </section>
  );
}
