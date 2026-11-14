import type { Order, SignedOffer } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { lineText } from "@/lib/console/format/proof";
import { day } from "@/lib/console/format/time";

/** What each tier means, in one line, so the three offers can be compared without guessing. */
const TIERS: { name: string; meaning: string }[] = [
  { name: "Good", meaning: "The cheapest product of the same type that covers the whole order on time." },
  { name: "Better", meaning: "Keeps what is in stock of your product and fills the rest, or picks the most reliable supplier." },
  { name: "Best", meaning: "An organic or Finnish-label product of the same type." },
];

function delta(amount: number, base: number): string {
  const diff = Math.round((amount - base) * 100) / 100;
  if (diff === 0) return "same price";
  return `${diff > 0 ? "+" : "\u2212"}${eur(Math.abs(diff))} vs this order`;
}

/** The signed alternatives Valio Aimo offered, side by side, each with what its tier means. */
export function Alternatives({ order, alternatives }: { order: Order; alternatives: SignedOffer[] }) {
  if (alternatives.length === 0) return null;
  const base = order.offer.totals.net.amount;
  const tiered = alternatives.length === TIERS.length;
  return (
    <section className="section">
      <h3>
        Signed alternatives <span className="count">{alternatives.length}</span>
      </h3>
      <ul className="alts">
        {alternatives.map(({ offer }, index) => (
          <li key={offer.id} className="alt">
            <span className="alt-tier">{tiered ? TIERS[index].name : `Option ${String.fromCharCode(65 + index)}`}</span>
            {tiered ? <span className="alt-meaning">{TIERS[index].meaning}</span> : null}
            <span className="alt-total num">{eur(offer.totals.net.amount)}</span>
            <span className="alt-delta">{delta(offer.totals.net.amount, base)}</span>
            <span className="alt-what">{offer.lines.map(lineText).join("; ")}</span>
            <span className="alt-when">{offer.deliveryDate ? `Delivers ${day(offer.deliveryDate)}` : "No delivery date"}</span>
            {offer.notes[0] ? <span className="alt-note">{offer.notes[0]}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
