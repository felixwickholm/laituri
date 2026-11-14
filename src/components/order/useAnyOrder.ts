"use client";

import { useEffect, useState } from "react";
import type { AuditEntry, Order } from "@/lib/contracts";
import { api } from "@/lib/console/api";
import { buyerOfOrder } from "@/lib/console/order-buyer";
import type { SignedMandate } from "@/lib/console/types";

export interface AnyOrder {
  order?: Order;
  /** The mandate the order was placed under: this console's own, or the other buyer's. */
  mandate?: SignedMandate;
  /** True when the order belongs to the buyer this console acts for, so its approver may decide it. */
  own: boolean;
  loading: boolean;
}

interface Loaded {
  id: string;
  order?: Order;
  mandate?: SignedMandate;
}

/**
 * The order the sheet shows: from the polled list when it is this buyer's, else loaded once with its buyer's
 * mandate, from the buyer the signed log names. That is how an order of Kaisla or Laine opens from Valio Aimo's audit.
 */
export function useAnyOrder(orderId: string | null, orders: Order[], audit: AuditEntry[], ownMandate: SignedMandate | undefined): AnyOrder {
  const polled = orders.find((item) => item.id === orderId);
  const buyerId = !polled && orderId ? buyerOfOrder(audit, orderId) : undefined;
  const [loaded, setLoaded] = useState<Loaded>();

  useEffect(() => {
    if (!orderId || !buyerId) return;
    let cancelled = false;
    void Promise.all([api.ordersOf(buyerId).catch(() => []), api.mandateOf(buyerId).catch(() => undefined)]).then(([list, mandate]) => {
      if (!cancelled) setLoaded({ id: orderId, order: list.find((item) => item.id === orderId), mandate });
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, buyerId]);

  if (polled) return { order: polled, mandate: ownMandate, own: true, loading: false };
  const other = loaded?.id === orderId ? loaded : undefined;
  return { order: other?.order, mandate: other?.mandate, own: false, loading: Boolean(buyerId) && !other };
}
