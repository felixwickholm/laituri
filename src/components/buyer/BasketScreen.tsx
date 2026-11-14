"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { basketHeading, basketVerdict } from "@/lib/console/basket";
import { useBaskets } from "@/lib/console/basket-store";
import { day } from "@/lib/console/format/time";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { useConsole } from "@/lib/console/store";
import { BasketCard } from "../basket/BasketCard";
import { PageHeader } from "../shell/PageHeader";

/** Every line of one basket, grouped by state, each with its order behind it. */
export function BasketScreen({ basketId }: { basketId: string }) {
  const { baskets, ready, available } = useBaskets();
  const { locked } = useConsole();
  const basket = baskets.find((item) => item.id === basketId);

  return (
    <div className="page basket-page">
      <Link href="/buyer" className="text-link back-link">
        <ChevronLeft aria-hidden="true" />
        Today
      </Link>
      {basket ? (
        <>
          <PageHeader title={basketHeading(basket)} meta={`Delivers ${day(basket.deliverBy)}`} lede={<strong className="verdict-lead">{basketVerdict(basket)}</strong>} />
          <BasketCard basket={basket} full />
        </>
      ) : (
        <PageHeader
          title="Basket"
          lede={locked ? LOCKED_NOTE : !ready ? "Loading the basket…" : available ? "We could not find this basket. Starting over may have cleared it." : "Baskets are not ready yet."}
        />
      )}
    </div>
  );
}
