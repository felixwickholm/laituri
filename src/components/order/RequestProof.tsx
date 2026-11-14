import { Check, X } from "lucide-react";
import type { Order } from "@/lib/contracts";
import { askedLine, matchedFacts, offeredLine } from "@/lib/console/format/proof";

/** The request beside the signed offer, with a mark on each fact that must match. */
export function RequestProof({ order }: { order: Order }) {
  const facts = matchedFacts(order);
  return (
    <section className="section">
      <h3>Request versus offer</h3>
      <div className="well proof-well">
        <p className="asked">{askedLine(order.offer)}</p>
        <p className="offered">{offeredLine(order.offer)}</p>
        <ul className="facts">
          {facts.map((fact) => (
            <li key={fact.label} data-ok={fact.ok}>
              {fact.ok ? <Check aria-label="Matches" /> : <X aria-label="Does not match" />}
              <span className="name">{fact.label}</span>
              <span className="value">{fact.detail}</span>
            </li>
          ))}
        </ul>
      </div>
      {order.offer.notes.length > 0 ? (
        <ul className="notes">
          {order.offer.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
