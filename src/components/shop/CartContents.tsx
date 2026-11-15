"use client";

import { ChevronRight, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { eur } from "@/lib/console/format/money";
import { day } from "@/lib/console/format/time";
import { cartDeliveryDay, cartEstimate, lineAmountText, type Cart } from "@/lib/shop-console/cart";
import type { AgentBasket } from "@/lib/shop-console/agent-watch";
import { BasketCard } from "../basket/BasketCard";
import { AgentBasketNote } from "./AgentBasketNote";
import { QtyStepper } from "./QtyStepper";
import { ProductImage } from "./ProductImage";

export interface CartProps {
  cart: Cart;
  onSet: (productId: string, packs: number) => void;
  onOrder: () => void;
  ordering: boolean;
  error?: string;
  /** The basket this cart was just ordered as. */
  placedId?: string;
  agentBasket?: AgentBasket;
}

/** The cart's lines, the estimate and the one Order button; after ordering, the basket with its line states. */
export function CartContents({ cart, onSet, onOrder, ordering, error, placedId, agentBasket }: CartProps) {
  const deliverBy = cartDeliveryDay(cart);
  return (
    <div className="store-cart-body">
      {agentBasket ? <AgentBasketNote basket={agentBasket} /> : null}
      {placedId ? (
        <div className="store-placed">
          <p>Sent. Each line is checked against your limits now.</p>
          <BasketCard basketId={placedId} />
          <Link href={`/buyer?basket=${encodeURIComponent(placedId)}`} className="text-link">
            Open in Today
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>
      ) : null}
      {cart.length === 0 ? (
        placedId ? null : (
          <p className="store-cart-empty">
            <ShoppingBasket aria-hidden="true" />
            Your cart is empty. Add products from the list.
          </p>
        )
      ) : (
        <>
          <ul className="store-cart-lines">
            {cart.map((line) => (
              <li key={line.productId}>
                <ProductImage productId={line.productId} name={line.name} group={line.group ?? ""} src={line.image} size={40} className="store-cart-img" />
                <div>
                  <p className="store-cart-name">{line.name}</p>
                  <p className="store-cart-pack">
                    {line.pack}
                    {line.unitPrice !== undefined ? ` · ${eur(line.unitPrice * line.packs)}` : ""}
                  </p>
                </div>
                <QtyStepper packs={line.packs} step={line.step} amount={lineAmountText(line)} name={line.name} onChange={(packs) => onSet(line.productId, packs)} />
              </li>
            ))}
          </ul>
          <div className="store-total">
            <p>
              <span>Estimated net total</span>
              <strong>{eur(cartEstimate(cart))}</strong>
            </p>
            <p className="store-total-note">Estimate. Your order gets a fixed price.</p>
            {deliverBy ? <p className="store-total-day">Delivery {day(deliverBy)}</p> : null}
          </div>
          {error ? (
            <p className="store-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="button" className="btn btn-primary big wide" onClick={onOrder} disabled={ordering || !deliverBy}>
            {ordering ? "Sending…" : "Order"}
          </button>
          <p className="store-cart-same">Your order gets the same checks as your agent’s.</p>
        </>
      )}
    </div>
  );
}
