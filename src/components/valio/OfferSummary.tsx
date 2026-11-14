import { count } from "@/lib/console/format/money";
import { percent, seconds } from "@/lib/supplier-console/format";
import type { OfferStats } from "@/lib/supplier-console/types";

/** The fixed prices Valio Aimo signed for agents, and what became of them, as four count boxes. */
export function OfferSummary({ offers }: { offers: OfferStats }) {
  return (
    <section className="block" aria-labelledby="offers-title">
      <header className="block-head">
        <h2 id="offers-title">Signed prices</h2>
        {offers.medianSecondsToOrder !== undefined && offers.medianSecondsToOrder >= 1 ? <span className="block-meta">{seconds(offers.medianSecondsToOrder)} price to order</span> : null}
      </header>
      <ul className="count-tiles">
        <li className="count-tile">
          <span className="count-tile-number">{count(offers.signed)}</span>
          <span className="count-tile-word">signed</span>
        </li>
        <li className="count-tile" data-tone={offers.ordered > 0 ? "success" : undefined}>
          <span className="count-tile-number">{count(offers.ordered)}</span>
          <span className="count-tile-word">became orders · {percent(offers.conversionRate)}</span>
        </li>
        <li className="count-tile">
          <span className="count-tile-number">{count(offers.expiredUnused)}</span>
          <span className="count-tile-word">ran out unused</span>
        </li>
        <li className="count-tile">
          <span className="count-tile-number">{count(offers.open)}</span>
          <span className="count-tile-word">still open</span>
        </li>
      </ul>
    </section>
  );
}
