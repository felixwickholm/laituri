import { ArrowLeftRight, Check, CircleQuestionMark, X } from "lucide-react";
import type { Order } from "@/lib/contracts";
import { askedLine, matchedFacts, offeredLine } from "@/lib/console/format/proof";

/** The request beside the signed offer, with the wholesaler's mark on each requirement: matches, does not match, substituted or not checked. */
export function RequestProof({ order }: { order: Order }) {
  const facts = matchedFacts(order);
  return (
    <section className="section">
      <h3>Request versus offer</h3>
      <div className="well proof-well">
        <p className="asked">{askedLine(order.offer)}</p>
        <p className="offered">{offeredLine(order.offer)}</p>
        <ul className="facts">
          {facts.map((fact, index) => (
            <li key={`${fact.label}-${index}`} data-ok={fact.ok} data-result={fact.result}>
              {fact.result === "met" ? (
                <Check aria-label="Matches" />
              ) : fact.result === "unmet" ? (
                <X aria-label="Does not match" />
              ) : fact.result === "substituted" ? (
                <ArrowLeftRight aria-label="Substituted, as the mandate allows" />
              ) : (
                <CircleQuestionMark aria-label="Not checked" />
              )}
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
