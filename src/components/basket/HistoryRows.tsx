"use client";

import { ChevronRight, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import type { LineState } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { feedTime } from "@/lib/console/format/time";
import type { HistoryItem, Light } from "@/lib/console/history";
import { useNow } from "../ui/useNow";
import { STATE_ICON } from "./StateMark";

const LIGHT_STATE: Record<Light, LineState> = { green: "green", orange: "orange", red: "red", refused: "red" };
const COUNTED: Exclude<LineState, "working">[] = ["green", "orange", "red"];
const COUNT_WORD: Record<Exclude<LineState, "working">, string> = { green: "ordered", orange: "need you", red: "blocked" };

/** Three small counts, each with its icon and colour; the words are there for screen readers. */
function Counts({ counts }: { counts: Record<Exclude<LineState, "working">, number> }) {
  return (
    <span className="history-counts">
      {COUNTED.map((state) => {
        const Icon = STATE_ICON[state];
        return (
          <span key={state} className="history-count" data-state={state} data-zero={counts[state] === 0}>
            <Icon aria-hidden="true" />
            <span className="num">{count(counts[state])}</span>
            <span className="sr-only">{COUNT_WORD[state]}</span>
          </span>
        );
      })}
    </span>
  );
}

function BasketRow({ item, now }: { item: Extract<HistoryItem, { kind: "basket" }>; now: number }) {
  return (
    <li className="history-row" data-kind="basket">
      <ShoppingBasket className="history-kind" aria-hidden="true" />
      <span className="history-main">
        <Link className="history-title row-open" href={`/buyer/basket/${encodeURIComponent(item.id)}`}>
          {item.title}
        </Link>
        <span className="history-sub">
          <time dateTime={item.at}>{feedTime(item.at, now)}</time>
          {item.running ? " · working" : null}
        </span>
      </span>
      <Counts counts={item.counts} />
      <span className="history-net num">{eur(item.net)}</span>
      <ChevronRight className="history-go" aria-hidden="true" />
    </li>
  );
}

function OrderRow({ item, now, onOpen }: { item: Extract<HistoryItem, { kind: "order" }>; now: number; onOpen: (id: string) => void }) {
  const Icon = STATE_ICON[LIGHT_STATE[item.light]];
  return (
    <li className="history-row" data-kind="order" data-light={item.light}>
      <Icon className="history-kind history-light" data-state={LIGHT_STATE[item.light]} aria-hidden="true" />
      <span className="history-main">
        <button type="button" className="history-title row-open" onClick={() => onOpen(item.id)}>
          {item.title}
        </button>
        <span className="history-sub">
          <time dateTime={item.at}>{feedTime(item.at, now)}</time> · {item.sentence}
        </span>
      </span>
      <span className="history-net num">{eur(item.net)}</span>
      <ChevronRight className="history-go" aria-hidden="true" />
    </li>
  );
}

/** Past baskets and single requests as compact rows, each opening its detail. */
export function HistoryRows({ items, onOpenOrder }: { items: HistoryItem[]; onOpenOrder: (id: string) => void }) {
  const now = useNow(60_000);
  return (
    <ul className="history-rows">
      {items.map((item) =>
        item.kind === "basket" ? <BasketRow key={item.id} item={item} now={now} /> : <OrderRow key={item.id} item={item} now={now} onOpen={onOpenOrder} />,
      )}
    </ul>
  );
}
