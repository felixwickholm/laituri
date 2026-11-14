import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DemandFragment } from "./DemandFragment";
import { ApprovalFragment } from "./ApprovalFragment";
import { Reveal } from "./Reveal";
import { stagger } from "./stagger";

/** One door, seen from each side: Valio Aimo's view of every agent first, then the buyer's approval. */
export function TwoSides() {
  return (
    <Reveal className="lp-section lp-sides" aria-labelledby="lp-sides-title">
      <h2 id="lp-sides-title" className="lp-h2 rv" style={stagger(0)}>
        One door. Two sides.
      </h2>
      <div className="lp-sides-grid">
        <article className="lp-side">
          <div className="lp-side-text rv" style={stagger(1)}>
            <h3 className="lp-h3">Valio Aimo control</h3>
            <p>
              Every request an agent brings through the door, and where it went: served with a signed offer, ordered, or lost
              to short stock or a passed cut-off. Demand you never saw before is now a picture.
            </p>
            <Link href="/valio" className="lp-text-link">
              Open the Valio Aimo side <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="lp-side-shot rv" style={stagger(2)}>
            <DemandFragment />
          </div>
        </article>
        <article className="lp-side">
          <div className="lp-side-text rv" style={stagger(3)}>
            <h3 className="lp-h3">The buyer&apos;s kitchen agent</h3>
            <p>
              It orders by itself inside the spending limits Maria signed. Anything bigger waits for her, with the reason in one line and the
              signed offer still holding its price.
            </p>
            <Link href="/buyer" className="lp-text-link">
              Open the buyer side <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="lp-side-shot rv" style={stagger(4)}>
            <ApprovalFragment />
          </div>
        </article>
      </div>
    </Reveal>
  );
}
