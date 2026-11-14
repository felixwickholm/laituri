import { count } from "@/lib/console/format/money";
import { percent, seconds } from "@/lib/supplier-console/format";
import type { OfferStats } from "@/lib/supplier-console/types";

/** The offers Valio Aimo signed for agents, and what became of them. */
export function OfferSummary({ offers }: { offers: OfferStats }) {
  const cells = [
    { label: "Signed", value: count(offers.signed), sub: "offers, primary and alternative" },
    { label: "Ordered", value: count(offers.ordered), sub: offers.signed > 0 ? `${percent(offers.conversionRate)} of signed` : "–" },
    { label: "Expired unused", value: count(offers.expiredUnused), sub: "never ordered before expiry" },
    { label: "Open", value: count(offers.open), sub: "still valid now" },
    { label: "Median time to order", value: seconds(offers.medianSecondsToOrder), sub: "from signing to the order" },
  ];
  return (
    <section className="block" aria-labelledby="offers-title">
      <header className="block-head">
        <h2 id="offers-title">Offers we signed</h2>
      </header>
      <dl className="kpis offer-kpis">
        {cells.map((cell) => (
          <div key={cell.label} className="kpi">
            <dt>{cell.label}</dt>
            <dd>
              <span className="kpi-value">{cell.value}</span>
              <span className="kpi-sub">{cell.sub}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
