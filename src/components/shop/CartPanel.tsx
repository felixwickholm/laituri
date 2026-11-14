"use client";

import { ShoppingBasket } from "lucide-react";
import { useState } from "react";
import { eur } from "@/lib/console/format/money";
import { cartEstimate } from "@/lib/shop-console/cart";
import { Sheet } from "../ui/Sheet";
import { CartContents, type CartProps } from "./CartContents";

/** The cart: a right column on a wide screen; on a phone, a bar at the bottom that opens it as a sheet. */
export function CartPanel(props: CartProps) {
  const [open, setOpen] = useState(false);
  const lines = props.cart.length;
  const note = props.agentBasket || props.placedId;
  return (
    <>
      <section className="store-cart" aria-labelledby="store-cart-title">
        <h2 id="store-cart-title">Cart</h2>
        <CartContents {...props} />
      </section>
      {lines > 0 || note ? (
        <div className="store-cartbar">
          <button type="button" className="store-cartbar-btn" onClick={() => setOpen(true)}>
            <ShoppingBasket aria-hidden="true" />
            <span>{lines ? `${lines} ${lines === 1 ? "line" : "lines"}` : "Your orders"}</span>
            {lines ? <strong>{eur(cartEstimate(props.cart))}</strong> : null}
            <span className="store-cartbar-open">Open cart</span>
          </button>
        </div>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} title="Cart">
        <CartContents {...props} />
      </Sheet>
    </>
  );
}
