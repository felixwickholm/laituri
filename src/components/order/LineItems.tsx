import type { Offer } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { contentText } from "@/lib/console/format/proof";

/** Line items with fixed unit prices, then net, VAT and gross. */
export function LineItems({ offer }: { offer: Offer }) {
  return (
    <section className="section">
      <h3>
        Lines <span className="count">{offer.lines.length}</span>
      </h3>
      <ol className="lines">
        {offer.lines.map((line, index) => (
          <li key={`${line.productId}-${index}`}>
            <span className="idx mono">{String(index + 1).padStart(2, "0")}</span>
            <span className="name">
              {line.name}
              <span className="sub">
                {line.gtin ? <span className="mono">GTIN {line.gtin}</span> : <span className="mono">#{line.productId}</span>}
                {contentText(line) ? ` · ${contentText(line)}` : ""}
                {line.substituteFor ? ` · replaces ${line.substituteFor.name}` : ""}
              </span>
            </span>
            <span className="qty">×{count(line.quantity)}</span>
            <span className="money">
              {eur(line.lineNet.amount)}
              <span className="sub">{eur(line.unitPrice.amount)} each</span>
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
