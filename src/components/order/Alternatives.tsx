import type { Order, SignedOffer } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { lineText } from "@/lib/console/format/proof";
import { day } from "@/lib/console/format/time";

const TIERS = ["Good", "Better", "Best"];

function delta(amount: number, base: number): string {
  const diff = Math.round((amount - base) * 100) / 100;
  if (diff === 0) return "same price";
  return `${diff > 0 ? "+" : "−"}${eur(Math.abs(diff))}`;
}

/** The signed alternatives Valio Aimo offered, as a real side-by-side comparison. */
export function Alternatives({ order, alternatives }: { order: Order; alternatives: SignedOffer[] }) {
  if (alternatives.length === 0) return null;
  const base = order.offer.totals.net.amount;
  return (
    <section className="section">
      <h3>
        Alternatives <span className="count">{alternatives.length}</span>
      </h3>
      <ul className="alts" data-count={alternatives.length}>
        {alternatives.map(({ offer }, index) => (
          <li key={offer.id} className="well">
            <span className="tier">{alternatives.length === 3 ? TIERS[index] : `Option ${String.fromCharCode(65 + index)}`}</span>
            <span className="alt-total mono">{eur(offer.totals.net.amount)}</span>
            <span className="alt-delta mono">{delta(offer.totals.net.amount, base)}</span>
            <span className="alt-what">{offer.lines.map(lineText).join("; ")}</span>
            <span className="alt-when">{offer.deliveryDate ? `Delivers ${day(offer.deliveryDate)}` : "No delivery date"}</span>
            {offer.notes[0] ? <span className="alt-note">{offer.notes[0]}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
