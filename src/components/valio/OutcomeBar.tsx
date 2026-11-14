import { count } from "@/lib/console/format/money";
import { OUTCOMES, orderCount } from "@/lib/supplier-console/format";
import type { OutcomeCounts } from "@/lib/supplier-console/types";

/** Orders by outcome as one stacked bar, each segment its true share, split by 2px seams. */
export function OutcomeBar({ orders, legend = false }: { orders: OutcomeCounts; legend?: boolean }) {
  const total = orderCount(orders);
  const label = OUTCOMES.filter((item) => orders[item.key] > 0)
    .map((item) => `${orders[item.key]} ${item.label.toLowerCase()}`)
    .join(", ");
  return (
    <div className="outcome">
      <span className="outcome-bar" role="img" aria-label={total === 0 ? "No orders" : `${total} orders: ${label}`}>
        {total === 0
          ? null
          : OUTCOMES.filter((item) => orders[item.key] > 0).map((item) => (
              <span key={item.key} data-outcome={item.key} style={{ flexGrow: orders[item.key] }} />
            ))}
      </span>
      {legend ? (
        <ul className="outcome-legend">
          {OUTCOMES.map((item) => (
            <li key={item.key} data-zero={orders[item.key] === 0}>
              <span className="swatch" data-outcome={item.key} aria-hidden="true" />
              <span>{item.label}</span>
              <span className="num">{count(orders[item.key])}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The key to the outcome colours, for a table of outcome bars. */
export function OutcomeKey() {
  return (
    <ul className="outcome-key" aria-label="Outcome colours">
      {OUTCOMES.map((item) => (
        <li key={item.key}>
          <span className="swatch" data-outcome={item.key} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
