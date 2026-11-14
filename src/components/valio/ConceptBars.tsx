import { count } from "@/lib/console/format/money";
import { conceptLabel, quantityText } from "@/lib/supplier-console/format";
import type { ConceptDemand } from "@/lib/supplier-console/types";

/** The products agents asked for most, ranked by requests, with the total quantity they wanted. */
export function ConceptBars({ concepts, requests }: { concepts: ConceptDemand[]; requests: number }) {
  const max = Math.max(1, ...concepts.map((concept) => concept.requests));
  return (
    <section className="block" aria-labelledby="concepts-title">
      <header className="block-head">
        <h2 id="concepts-title">What agents ask for</h2>
        <span className="block-meta">Requests per product, with the total quantity asked</span>
      </header>
      {concepts.length === 0 ? (
        <p className="empty-frame">No agent has asked for anything yet.</p>
      ) : (
        <div className="card">
          <ol className="bar-list concept-bars">
            {concepts.map((concept, index) => (
              <li key={concept.concept} className="bar-row" data-top={index === 0}>
                <span className="bar-name">
                  {conceptLabel(concept.concept)}
                  <span className="sub">{quantityText(concept.quantity)}</span>
                </span>
                <span className="bar-lane">
                  <span className="hbar" style={{ transform: `scaleX(${concept.requests / max})` }} />
                </span>
                <span className="bar-count num">{count(concept.requests)}</span>
              </li>
            ))}
          </ol>
          <p className="card-note">
            {count(concepts.reduce((sum, concept) => sum + concept.requests, 0))} of {count(requests)} requests named one of these products.
          </p>
        </div>
      )}
    </section>
  );
}
