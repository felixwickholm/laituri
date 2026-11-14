"use client";

import { ChevronDown, ChevronRight, Smartphone } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useState } from "react";
import { basketHeading, groupLines, lineCounts, LINE_STATE } from "@/lib/console/basket";
import { basketVerdictOf } from "@/lib/console/basket-verdict";
import type { Basket, BasketLine, LineState } from "@/lib/contracts";
import { count, eurWhole } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { useUi } from "../shell/ui-context";
import { BasketLineRow } from "./BasketLineRow";
import { STATE_ICON } from "./StateMark";
import { useResolve } from "./useResolve";

const COUNTED: Exclude<LineState, "working">[] = ["green", "orange", "red"];
const TONE = { green: "success", orange: "warn", red: "danger" } as const;

/** Scrolls to the first line that needs a person and puts focus on its first choice. */
function goToFirstOpen(card: HTMLElement | null): void {
  const line = card?.querySelector<HTMLElement>('.basket-line[data-open="true"]');
  if (!line) return;
  line.scrollIntoView({ behavior: "smooth", block: "center" });
  line.querySelector<HTMLElement>(".line-actions button")?.focus({ preventScroll: true });
}

/**
 * This week's order as one verdict: the most urgent thing biggest with one action, the counts,
 * then only the lines a person must look at. The ordered lines wait behind one button.
 */
export function WeeklyVerdict({ basket }: { basket: Basket }) {
  const ui = useUi();
  const resolver = useResolve(basket.id);
  const [showOrdered, setShowOrdered] = useState(false);
  const [card, setCard] = useState<HTMLElement | null>(null);
  const verdict = basketVerdictOf(basket);
  const n = lineCounts(basket);
  const groups = groupLines(basket.lines);
  const attention: BasketLine[] = [...groups.needsYou, ...groups.blocked];
  const row = (line: BasketLine) => <BasketLineRow key={line.id} line={line} resolver={resolver} onOpenOrder={ui.openOrder} />;
  const net = eurWhole(basket.totals.netOrdered);
  const href = `/buyer/basket/${encodeURIComponent(basket.id)}`;

  return (
    <section ref={setCard} className="glass pad weekly-verdict" data-tour="basket" data-status={basket.status} data-kind={verdict.kind} aria-label={basketHeading(basket)}>
      <div className="weekly-verdict-top">
        <div className="verdict">
          <p className="verdict-label">
            {basket.source === "weekly" ? "Weekly order" : basketHeading(basket)} · {day(basket.deliverBy)}
          </p>
          <h2 className="verdict-title" aria-live="polite">
            {verdict.headline}
          </h2>
        </div>
        <div className="weekly-verdict-actions">
          {verdict.open > 0 ? (
            <button type="button" className="btn btn-primary verdict-action" onClick={() => goToFirstOpen(card)}>
              {verdict.kind === "needs" ? "Decide now" : "Look at it"}
            </button>
          ) : verdict.kind === "done" ? (
            <Link href={href} className="btn btn-secondary verdict-action">
              Open order
            </Link>
          ) : null}
          {n.orange > 0 && verdict.kind !== "working" ? (
            <Link href={`/approve/basket/${encodeURIComponent(basket.id)}`} className="text-link weekly-verdict-phone">
              <Smartphone aria-hidden="true" />
              On your phone
            </Link>
          ) : null}
        </div>
      </div>

      <ul className="count-tiles weekly-tiles">
        {COUNTED.map((state) => {
          const Icon = STATE_ICON[state];
          return (
            <li key={state} className="count-tile" data-state={state} data-tone={n[state] === 0 ? undefined : TONE[state]}>
              <span className="count-tile-number">{count(n[state])}</span>
              <span className="count-tile-word">
                <Icon aria-hidden="true" />
                {LINE_STATE[state].word}
              </span>
            </li>
          );
        })}
        <li className="count-tile" data-state="net" style={{ "--chars": net.length } as CSSProperties}>
          <span className="count-tile-number">{net}</span>
          <span className="count-tile-word">Net</span>
        </li>
      </ul>

      {attention.length > 0 ? <ul className="weekly-lines">{attention.map(row)}</ul> : null}
      {groups.working.length > 0 ? (
        <p className="weekly-working">
          <span className="num">{count(groups.working.length)}</span> {LINE_STATE.working.word.toLowerCase()}
        </p>
      ) : null}

      <div className="weekly-foot">
        {groups.ordered.length > 0 ? (
          <button type="button" className="weekly-more" aria-expanded={showOrdered} onClick={() => setShowOrdered(!showOrdered)}>
            <ChevronDown aria-hidden="true" data-open={showOrdered} />
            {count(groups.ordered.length)} ordered
          </button>
        ) : (
          <span />
        )}
        <Link href={href} className="text-link weekly-open">
          All lines
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
      {showOrdered ? <ul className="weekly-lines weekly-ordered">{groups.ordered.map(row)}</ul> : null}
    </section>
  );
}
