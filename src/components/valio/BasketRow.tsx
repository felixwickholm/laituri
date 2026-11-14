import { ChevronRight } from "lucide-react";
import type { Basket } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { LINE_WORD, basketSentence, lineTone, linesByAttention } from "@/lib/supplier-console/baskets";
import { callTime } from "@/lib/supplier-console/format";
import { StateWord } from "../ui/StateWord";

/** A kitchen's multi-line order as one event in the live feed; it opens to its lines, the ones that stopped first. */
export function BasketRow({ basket, at, now }: { basket: Basket; at: string; now: number }) {
  const tone = basket.totals.red > 0 ? "danger" : basket.totals.orange > 0 ? "waiting" : "neutral";
  return (
    <li className="live-row basket-row" data-tone={tone}>
      <details className="basket-event">
        <summary>
          <ChevronRight aria-hidden="true" className="basket-chevron" />
          <span className="live-body">
            <span className="live-title">{basketSentence(basket)}</span>
            <span className="live-sub">
              <span>{basket.buyer.name}</span>
              {basket.status === "running" ? <span>Working now</span> : null}
            </span>
          </span>
          <time className="live-when" dateTime={at}>
            {callTime(at, now)}
          </time>
        </summary>
        <ul className="basket-lines">
          {linesByAttention(basket.lines).map((line) => (
            <li key={line.id} className="basket-line-row" data-state={line.state}>
              <span className="basket-line-words">
                {line.words}
                <span className="sub">
                  {count(line.asked.amount)} {line.asked.unit}
                  {line.net !== undefined ? ` · ${eur(line.net)}` : ""}
                </span>
              </span>
              <StateWord word={LINE_WORD[line.state]} tone={lineTone(line.state)} />
              <span className="basket-line-reason">{line.reason}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
