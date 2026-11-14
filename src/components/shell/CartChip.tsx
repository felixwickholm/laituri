"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "@/lib/console/workspace-store";
import { useCartCount } from "@/lib/shop-console/use-cart";

/** The customer's cart, always in view at the top: how many lines wait, one tap to the shop. */
export function CartChip() {
  const info = useWorkspace();
  const lines = useCartCount(info ? `${info.kind}:${info.label}` : undefined);
  const label = lines === 0 ? "Cart is empty" : `Cart: ${lines} ${lines === 1 ? "line" : "lines"}`;
  return (
    <Link href="/buyer/shop" className="cart-chip" aria-label={`${label}. Open the shop`} data-tour="cart">
      <ShoppingCart aria-hidden="true" />
      <span>Cart</span>
      {lines > 0 ? <span className="cart-chip-count num">{lines}</span> : null}
    </Link>
  );
}
