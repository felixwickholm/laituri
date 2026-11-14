"use client";

import { Check, ChevronRight, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { lineCounts } from "@/lib/console/basket";
import { basketStore, useBaskets } from "@/lib/console/basket-store";
import type { SearchHit } from "@/lib/contracts";
import { count, eur } from "@/lib/console/format/money";
import { shortProductName } from "@/lib/console/format/product";
import { day } from "@/lib/console/format/time";
import { useWorkspace } from "@/lib/console/workspace-store";
import { cartDeliveryDay, cartEstimate, lineAmountText, lineFor, toBasketRequest, type CartLine } from "@/lib/shop-console/cart";
import { availabilityText, packLabel, unitPriceText } from "@/lib/shop-console/format";
import { useCart } from "@/lib/shop-console/use-cart";
import { useShopSearch } from "@/lib/shop-console/use-search";
import { QtyStepper } from "./QtyStepper";
import { StockWord } from "./StockWord";
import { ProductImage } from "./ProductImage";

const SHOWN = 8;

/** The search field for the "Order directly" card. Results show below it as the person types. */
export function QuickSearch({ value, onChange, onEnter, placeholder = "Milk, butter, rice…" }: { value: string; onChange: (value: string) => void; onEnter?: (value: string) => void; placeholder?: string }) {
  return (
    <div className="quick-search">
      <label htmlFor="quick-q" className="sr-only">
        Search products
      </label>
      <Search className="quick-search-icon" aria-hidden="true" />
      <input
        id="quick-q"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onEnter(value);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {value ? (
        <button type="button" className="icon-btn" onClick={() => onChange("")} aria-label="Clear the search">
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function QuickRow({ hit, inCart, onAdd, onSet }: { hit: SearchHit; inCart?: CartLine; onAdd: (line: CartLine) => void; onSet: (id: string, packs: number) => void }) {
  const { product, offerPreview: preview } = hit;
  const name = shortProductName(product.name.en);
  const pack = packLabel(product);
  const stock = availabilityText(preview);
  return (
    <li className="quick-row">
      <ProductImage productId={product.id} name={name} group={product.categoryGroup} src={hit.image} size={48} className="quick-row-img" />
      <div className="quick-row-main">
        <p className="quick-row-name">{name}</p>
        <p className="quick-row-meta">
          {name.toLowerCase().endsWith(pack.toLowerCase()) ? null : <span>{pack}</span>}
          {stock.tone === "neutral" ? null : <StockWord {...stock} />}
        </p>
      </div>
      <p className="quick-row-price num">{preview ? unitPriceText(preview, product.salesUnit) : "–"}</p>
      {inCart ? (
        <QtyStepper packs={inCart.packs} step={inCart.step} amount={lineAmountText(inCart)} name={name} onChange={(packs) => onSet(product.id, packs)} />
      ) : (
        <button type="button" className="btn btn-secondary quick-add" disabled={!(preview?.orderable ?? false)} onClick={() => onAdd(lineFor(hit, name, pack))} aria-label={`Add ${name}`}>
          <Plus aria-hidden="true" />
          Add
        </button>
      )}
    </li>
  );
}

/** What the order just sent turned into: its counts as the lines settle. */
function Placed({ basketId }: { basketId: string }) {
  const { baskets } = useBaskets();
  const basket = baskets.find((item) => item.id === basketId);
  const n = basket ? lineCounts(basket) : undefined;
  const running = !basket || basket.status === "running" || (n?.working ?? 0) > 0;
  return (
    <div className="quick-placed" role="status" data-running={running}>
      <Check aria-hidden="true" />
      <p>
        {running ? (
          "Sent. Checking…"
        ) : (
          <>
            <strong>{count(n?.green ?? 0)} ordered</strong>
            {n && n.orange > 0 ? ` · ${count(n.orange)} need${n.orange === 1 ? "s" : ""} you` : ""}
            {n && n.red > 0 ? ` · ${count(n.red)} blocked` : ""}
          </>
        )}
      </p>
      <Link href={`/buyer/basket/${encodeURIComponent(basketId)}`} className="text-link">
        Open
        <ChevronRight aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * The catalogue inline on Today: the same search agents use, a small cart and one Order button.
 * The order goes through the same basket and checks as the shop's and the agent's.
 */
export function QuickCatalogue({ query }: { query: string }) {
  const info = useWorkspace();
  const { cart, add, set, clear } = useCart(info ? `${info.kind}:${info.label}` : undefined);
  const search = useShopSearch(query, undefined, "price");
  const [order, setOrder] = useState<{ sending: boolean; error?: string; placedId?: string }>({ sending: false });
  const byId = useMemo(() => new Map(cart.map((line) => [line.productId, line])), [cart]);
  const addLine = useCallback(
    (line: CartLine) => {
      add(line);
      setOrder((current) => ({ ...current, error: undefined }));
    },
    [add],
  );

  async function place() {
    const deliverBy = cartDeliveryDay(cart);
    if (!deliverBy) return;
    setOrder({ sending: true });
    try {
      const placedId = await basketStore.place(toBasketRequest(cart, deliverBy));
      clear();
      setOrder({ sending: false, placedId });
    } catch (error) {
      setOrder({ sending: false, error: error instanceof Error ? error.message : "The order did not go through. Try again." });
    }
  }

  const searching = query.trim().length >= 2;
  if (!searching && cart.length === 0 && !order.placedId) return null;
  const hits = search.hits.slice(0, SHOWN);
  const deliverBy = cartDeliveryDay(cart);

  return (
    <section className="glass quick-catalogue" aria-label="Products">
      {searching ? (
        <>
          {search.status === "failed" ? (
            <p className="quick-note" role="alert">
              {search.error}
            </p>
          ) : hits.length === 0 ? (
            <p className="quick-note" aria-live="polite">
              {search.status === "done" ? "Nothing found." : "Searching…"}
            </p>
          ) : (
            <ul className="quick-rows" data-stale={search.status === "loading" ? "" : undefined}>
              {hits.map((hit) => (
                <QuickRow key={hit.product.id} hit={hit} inCart={byId.get(hit.product.id)} onAdd={addLine} onSet={set} />
              ))}
            </ul>
          )}
        </>
      ) : null}
      {order.placedId && cart.length === 0 ? <Placed basketId={order.placedId} /> : null}
      {cart.length > 0 ? (
        <div className="quick-cart">
          <p className="quick-cart-sum">
            <strong className="num">
              {count(cart.length)} {cart.length === 1 ? "line" : "lines"}
            </strong>
            <span className="num">{eur(cartEstimate(cart))}</span>
            {deliverBy ? <span>{day(deliverBy)}</span> : null}
          </p>
          {order.error ? (
            <p className="quick-error" role="alert">
              {order.error}
            </p>
          ) : null}
          <button type="button" className="btn btn-primary big quick-go" onClick={() => void place()} disabled={order.sending || !deliverBy}>
            {order.sending ? "Sending…" : "Order"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
