import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { OrbState } from "@/lib/console/orb-params";
import { TourLink } from "../tour/TourLink";
import { HeroOrb } from "./HeroOrb";
import { LiveCounters } from "./LiveCounters";
import { stagger } from "./stagger";

/**
 * The first screen: what Laituri is in two lines and one sentence, beside the agent orb running the story, and at its
 * foot the week's live figures from this visitor's own workspace.
 */
export function Hero({ pinned }: { pinned?: OrbState }) {
  return (
    <section className="lp-hero" aria-labelledby="lp-title">
      <div className="lp-hero-main">
        <div className="lp-hero-text">
          <h1 id="lp-title" className="lp-h1">
            <span className="enter" style={stagger(0)}>
              AI agents can buy from you.
            </span>{" "}
            <span className="lp-h1-quiet enter" style={stagger(1)}>
              On terms a person signed.
            </span>
          </h1>
          <p className="lp-lede enter" style={stagger(2)}>
            Laituri is the open front door where a customer&apos;s own AI agent gets a signed, fixed price from Valio Aimo and
            orders inside the limits a person signed, with every step in a log anyone can verify.
          </p>
          <div className="lp-actions enter" style={stagger(3)}>
            <TourLink className="btn btn-primary big lp-cta">
              See it in 2 minutes
              <ArrowRight aria-hidden="true" />
            </TourLink>
            <Link href="/buyer" className="btn btn-quiet big">
              Open the live demo
            </Link>
          </div>
        </div>
        <div className="lp-hero-orb enter" style={stagger(2)}>
          <HeroOrb pinned={pinned} />
        </div>
      </div>
      <LiveCounters />
    </section>
  );
}
