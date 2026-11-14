import { ShoppingBasket } from "lucide-react";
import { count } from "@/lib/console/format/money";
import { conceptLabel, quantityText, unservedByConcept } from "@/lib/supplier-console/format";
import type { ConceptDemand, UnmetRequest } from "@/lib/supplier-console/types";
import { EmptyState } from "./bits";

/**
 * The products agents asked for most, ranked by requests, with the total quantity they wanted. The part of each bar
 * that went unserved is amber, set apart by a 2px seam and named in words under the product.
 */
export function ConceptBars({ concepts, requests, unmet }: { concepts: ConceptDemand[]; requests: number; unmet: UnmetRequest[] }) {
  const max = Math.max(1, ...concepts.map((concept) => concept.requests));
  const unserved = unservedByConcept(unmet);
  return (
    <section className="block" aria-labelledby="concepts-title">
      <header className="block-head">
        <h2 id="concepts-title">What agents ask for</h2>
        <span className="block-meta tier-key">
          <span className="tier-dot" data-tier="served" aria-hidden="true" />
          Served
          <span className="tier-dot" data-tier="ask" aria-hidden="true" />
          Unserved
        </span>
      </header>
      {concepts.length === 0 ? (
        <EmptyState icon={ShoppingBasket} text="No agent has asked for anything yet." action={{ href: "/connect", label: "Connect an agent" }} />
      ) : (
        <div className="card">
          <ol className="bar-list concept-bars">
            {concepts.map((concept) => {
              const missed = Math.min(concept.requests, unserved.get(concept.concept) ?? 0);
              return (
                <li key={concept.concept} className="bar-row">
                  <span className="bar-name">
                    {conceptLabel(concept.concept)}
                    <span className="sub">
                      {quantityText(concept.quantity)}
                      {missed > 0 ? <span className="tone-waiting"> · {count(missed)} unserved</span> : null}
                    </span>
                  </span>
                  <span className="bar-lane split-lane" style={{ width: `${(concept.requests / max) * 100}%` }}>
                    {concept.requests > missed ? <span className="seg" style={{ flexGrow: concept.requests - missed }} /> : null}
                    {missed > 0 ? <span className="seg" data-tier="ask" style={{ flexGrow: missed }} /> : null}
                  </span>
                  <span className="bar-count num">{count(concept.requests)}</span>
                </li>
              );
            })}
          </ol>
          <p className="card-note">
            {count(concepts.reduce((sum, concept) => sum + concept.requests, 0))} of {count(requests)} requests named one of these products. Bars count requests.
          </p>
        </div>
      )}
    </section>
  );
}
