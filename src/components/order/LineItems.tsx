import type { Offer } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { packContent, packCount, priceUnit, roundingNote, stockText } from "@/lib/console/format/packs";
import { substitutionTag } from "@/lib/console/format/substitution";
import { StateWord } from "../ui/StateWord";

/** The small print under a line's name: its code, what the packs come to, stock where it matters, what it replaces. */
function lineFacts(line: Offer["lines"][number]): string {
  return [packContent(line), stockText(line), line.substituteFor ? `replaces ${line.substituteFor.name}` : undefined]
    .filter(Boolean)
    .map((part) => ` · ${part}`)
    .join("");
}

/** Line items with fixed unit prices, then net, VAT and gross: the one place in the console that shows VAT. */
export function LineItems({ offer }: { offer: Offer }) {
  const rounding = roundingNote(offer);
  const swap = substitutionTag({ offer });
  return (
    <section className="section">
      <h3>
        Lines <span className="count">{offer.lines.length}</span>
        {swap ? <StateWord word={swap} tone="waiting" /> : null}
      </h3>
      {rounding ? <p className="line-note">{rounding}</p> : null}
      <ol className="lines">
        {offer.lines.map((line, index) => (
          <li key={`${line.productId}-${index}`}>
            <span className="name">
              {line.name}
              <span className="sub">
                {line.gtin ? <span className="mono">GTIN {line.gtin}</span> : <span className="mono">#{line.productId}</span>}
                {lineFacts(line)}
              </span>
            </span>
            <span className="line-qty">{packCount(line)}</span>
            <span className="money">
              {eur(line.lineNet.amount)}
              <span className="sub">
                {eur(line.unitPrice.amount)} {priceUnit(line)}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <dl className="totals">
        <dt>Net</dt>
        <dd>{eur(offer.totals.net.amount)}</dd>
        <dt>VAT</dt>
        <dd>{eur(offer.totals.tax.amount)}</dd>
        <dt>Total with VAT</dt>
        <dd className="strong">{eur(offer.totals.gross.amount)}</dd>
      </dl>
    </section>
  );
}
