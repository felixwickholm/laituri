import { LINE_STATE, lineCounts, timeSaved } from "@/lib/console/basket";
import type { Basket, LineState } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { InfoTip } from "./InfoTip";
import { STATE_ICON } from "./StateMark";

const SHOWN: Exclude<LineState, "working">[] = ["green", "orange", "red"];

/** The three traffic-light counts: the number big first, the word with its icon under it (beside it in a narrow card). */
export function BasketCounts({ counts, className }: { counts: Record<Exclude<LineState, "working">, number>; className?: string }) {
  return (
    <ul className={className ? `basket-counts ${className}` : "basket-counts"} aria-label="Lines by state">
      {SHOWN.map((state) => {
        const Icon = STATE_ICON[state];
        return (
          <li key={state} className="basket-count" data-state={state} data-zero={counts[state] === 0}>
            <span className="basket-count-number num">{count(counts[state])}</span>
            <span className="basket-count-word">
              <Icon aria-hidden="true" />
              {LINE_STATE[state].word}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The basket at a glance: three large counts with their colour, icon and word, the net ordered and the time it took. */
export function BasketSummary({ basket }: { basket: Basket }) {
  const n = lineCounts(basket);
  const running = basket.status === "running" || n.working > 0;
  const perLine = basket.lines.length > 0 ? basket.totals.minutesByHand / basket.lines.length : 0;
  return (
    <div className="basket-summary">
      <BasketCounts counts={n} />
      <div className="basket-net">
        <p>
          <span className="basket-net-value num">{eur(basket.totals.netOrdered)}</span>
          <span className="basket-net-label">net ordered</span>
        </p>
        <p className="basket-time">
          {running ? `${count(n.working)} ${n.working === 1 ? "line" : "lines"} still working. ` : null}
          {timeSaved(basket.totals, running)}
          <InfoTip label="How we count the time">
            Our guess: about {count(Math.round(perLine * 10) / 10)} min per line for a person to find, check and order it.
          </InfoTip>
        </p>
      </div>
    </div>
  );
}
