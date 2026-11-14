"use client";

import { LayoutGroup } from "motion/react";
import { useState } from "react";
import { groupLines, LINE_STATE } from "@/lib/console/basket";
import type { BasketLine, LineState } from "@/lib/contracts";
import { count } from "@/lib/console/format/money";
import { BasketLineRow } from "./BasketLineRow";
import { StateMark } from "./StateMark";
import type { Resolver } from "./useResolve";

const ORDERED_FIRST = 5;
const WORKING_FIRST = 3;

interface BasketLinesProps {
  lines: BasketLine[];
  resolver?: Resolver;
  onOpenOrder?: (orderId: string) => void;
  /** Show every ordered line at once, as the basket's own page does. */
  expanded?: boolean;
}

function Group({ state, lines, children }: { state: LineState; lines: BasketLine[]; children?: React.ReactNode }) {
  if (lines.length === 0) return null;
  return (
    <section className="line-group" data-state={state} aria-label={`${LINE_STATE[state].word}: ${lines.length}`}>
      <h3 className="line-group-head">
        <StateMark state={state} />
        <span className="line-group-count num">{count(lines.length)}</span>
      </h3>
      {children}
    </section>
  );
}

/** The lines grouped: needs you first, then blocked, then still working, then ordered (the first five, then all). */
export function BasketLines({ lines, resolver, onOpenOrder, expanded = false }: BasketLinesProps) {
  const [showAll, setShowAll] = useState(expanded);
  const groups = groupLines(lines);
  const ordered = showAll ? groups.ordered : groups.ordered.slice(0, ORDERED_FIRST);
  const row = (line: BasketLine) => <BasketLineRow key={line.id} line={line} resolver={resolver} onOpenOrder={onOpenOrder} />;

  return (
    <LayoutGroup>
      <div className="basket-groups">
        <Group state="orange" lines={groups.needsYou}>
          <ul>{groups.needsYou.map(row)}</ul>
        </Group>
        <Group state="red" lines={groups.blocked}>
          <ul>{groups.blocked.map(row)}</ul>
        </Group>
        <Group state="working" lines={groups.working}>
          <ul>{groups.working.slice(0, WORKING_FIRST).map(row)}</ul>
          {groups.working.length > WORKING_FIRST ? (
            <p className="line-group-rest">
              {count(groups.working.length - WORKING_FIRST)} more {groups.working.length - WORKING_FIRST === 1 ? "line waits" : "lines wait"} their turn.
            </p>
          ) : null}
        </Group>
        <Group state="green" lines={groups.ordered}>
          <ul>{ordered.map(row)}</ul>
          {groups.ordered.length > ORDERED_FIRST ? (
            <button type="button" className="btn btn-quiet line-group-more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${count(groups.ordered.length)}`}
            </button>
          ) : null}
        </Group>
      </div>
    </LayoutGroup>
  );
}
