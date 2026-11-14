"use client";

import { ChevronRight, Smartphone } from "lucide-react";
import Link from "next/link";
import { basketHeading, limitUsed, lineCounts } from "@/lib/console/basket";
import { useBaskets } from "@/lib/console/basket-store";
import type { Basket } from "@/lib/contracts";
import { day } from "@/lib/console/format/time";
import { useUi } from "../shell/ui-context";
import { BasketLines } from "./BasketLines";
import { BasketSummary } from "./BasketSummary";
import { useResolve } from "./useResolve";

interface BasketViewProps {
  basket: Basket;
  /** Net spent this week and the weekly limit, for the one line under the basket. */
  spend?: { spent: number; limit: number };
  /** On the basket's own page every line shows and the link to it is left out. */
  full?: boolean;
}

type BasketCardProps = (Omit<BasketViewProps, "basket"> & { basket: Basket }) | (Omit<BasketViewProps, "basket"> & { basketId: string });

/** A basket card by value, or by id for a screen that only has the id it just started (the menu planner). */
export function BasketCard(props: BasketCardProps) {
  const { baskets } = useBaskets();
  const basket = "basket" in props ? props.basket : baskets.find((item) => item.id === props.basketId);
  if (!basket) {
    return (
      <section className="basket-card" data-tour="basket" data-status="running" aria-busy="true">
        <p className="basket-kicker">Starting the order…</p>
      </section>
    );
  }
  return <BasketView {...props} basket={basket} />;
}

/** The title, the three counts, then the lines, with the choices on the lines that need a person. */
function BasketView({ basket, spend, full = false }: BasketViewProps) {
  const ui = useUi();
  const resolver = useResolve(basket.id);
  const needs = lineCounts(basket).orange;
  return (
    <section className="basket-card" data-tour="basket" data-status={basket.status} aria-label={basketHeading(basket)}>
      {full ? null : (
        <header className="basket-head">
          <div>
            <p className="basket-kicker">Delivers {day(basket.deliverBy)}</p>
            <h2>{basketHeading(basket)}</h2>
          </div>
          <Link href={`/buyer/basket/${encodeURIComponent(basket.id)}`} className="text-link strong basket-open">
            Open
            <ChevronRight aria-hidden="true" />
          </Link>
        </header>
      )}
      <BasketSummary basket={basket} />
      {spend ? <p className="basket-limit">{limitUsed(spend.spent, spend.limit)}</p> : null}
      <BasketLines lines={basket.lines} resolver={resolver} onOpenOrder={ui.openOrder} expanded={full} />
      {needs > 0 ? (
        <Link href={`/approve/basket/${encodeURIComponent(basket.id)}`} className="text-link basket-phone">
          <Smartphone aria-hidden="true" />
          Decide on your phone
        </Link>
      ) : null}
    </section>
  );
}
