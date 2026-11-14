"use client";

import { useCallback, useMemo, useState } from "react";
import type { SearchHit, SearchPreference } from "@/lib/contracts";
import { basketStore, useBaskets } from "@/lib/console/basket-store";
import { count } from "@/lib/console/format/money";
import { useConsole } from "@/lib/console/store";
import { useWorkspace } from "@/lib/console/workspace-store";
import { latestAgentStep, recentAgentBasket } from "@/lib/shop-console/agent-watch";
import { cartDeliveryDay, toBasketRequest, type CartLine } from "@/lib/shop-console/cart";
import { CATEGORIES, PREFERENCES, type Category } from "@/lib/shop-console/format";
import { useCart } from "@/lib/shop-console/use-cart";
import { useShopSearch } from "@/lib/shop-console/use-search";
import { PageHeader } from "../shell/PageHeader";
import { useNow } from "../ui/useNow";
import { AgentBand } from "./AgentBand";
import { AgentStrip } from "./AgentStrip";
import { CartPanel } from "./CartPanel";
import { CategoryChips } from "./CategoryChips";
import { ProductCard } from "./ProductCard";
import { ProductSheet } from "./ProductSheet";
import { SearchField } from "./SearchField";
import { SortControl } from "./SortControl";

const FIRST = CATEGORIES[0];

/** The catalogue as a webshop for a person: the same search agents use, a cart, and the same checks on ordering. */
export function ShopScreen({ serverOrigin, buyerId }: { serverOrigin: string; buyerId: string }) {
  const [query, setQuery] = useState(FIRST.starter);
  const [group, setGroup] = useState<string | undefined>(FIRST.group);
  const [prefer, setPrefer] = useState<SearchPreference>("price");
  const [opened, setOpened] = useState<{ hit?: SearchHit; open: boolean }>({ open: false });
  const [order, setOrder] = useState<{ sending: boolean; error?: string; placedId?: string }>({ sending: false });

  const info = useWorkspace();
  const { cart, add, set, clear } = useCart(info ? `${info.kind}:${info.label}` : undefined);
  const search = useShopSearch(query, group, prefer);
  const snapshot = useConsole();
  const { baskets } = useBaskets();
  const now = useNow(5000);

  const step = latestAgentStep(snapshot.activity, now);
  const agentBasket = recentAgentBasket(baskets, now);
  const agentIds = useMemo(() => new Set(agentBasket?.productIds ?? []), [agentBasket]);
  const byId = useMemo(() => new Map(cart.map((line) => [line.productId, line])), [cart]);

  const pickCategory = useCallback((category: Category | undefined) => {
    setGroup(category?.group);
    if (category) setQuery(category.starter);
  }, []);
  const showSearch = useCallback((words: string) => {
    setGroup(undefined);
    setQuery(words);
    setOpened((current) => ({ ...current, open: false }));
  }, []);
  const addLine = useCallback(
    (line: CartLine) => {
      add(line);
      setOrder((current) => ({ ...current, error: undefined }));
    },
    [add],
  );

  async function placeOrder() {
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

  const preference = PREFERENCES.find((item) => item.id === prefer);
  const results = search.hits;
  const waiting = search.status === "loading" || (search.status === "idle" && query.trim().length >= 2);

  return (
    <div className="page store">
      <PageHeader title="Shop" lede="Search, add and order. Agents search this same list." />
      {step ? <AgentStrip step={step} onShow={showSearch} /> : null}
      <div className="store-grid">
        <div className="store-main">
          <SearchField value={query} onChange={setQuery} busy={search.status === "loading"} />
          <CategoryChips value={group} onPick={pickCategory} />
          <div className="store-bar">
            <p className="store-count" aria-live="polite">
              {query.trim().length < 2 ? (
                "Type at least two letters."
              ) : waiting && !results.length ? (
                "Searching…"
              ) : (
                <>
                  <strong>{count(results.length)}</strong> {results.length === 1 ? "product" : "products"}
                  {preference ? <span className="store-count-sort"> · {preference.sentence}</span> : null}
                </>
              )}
            </p>
            <SortControl value={prefer} onChange={setPrefer} />
          </div>
          {search.note && search.status === "done" ? <p className="store-note">{search.note}</p> : null}
          {search.status === "failed" ? (
            <p className="store-error" role="alert">
              {search.error}
            </p>
          ) : null}
          {results.length ? (
            <ul className="store-cards" data-stale={search.status === "loading" ? "" : undefined}>
              {results.map((hit) => (
                <ProductCard
                  key={hit.product.id}
                  hit={hit}
                  inCart={byId.get(hit.product.id)}
                  agentPicked={agentIds.has(hit.product.id)}
                  onAdd={addLine}
                  onSet={set}
                  onOpen={(picked) => setOpened({ hit: picked, open: true })}
                />
              ))}
            </ul>
          ) : null}
        </div>
        <div className="store-side">
          <CartPanel
            cart={cart}
            onSet={set}
            onOrder={placeOrder}
            ordering={order.sending}
            error={order.error}
            placedId={order.placedId}
            agentBasket={agentBasket}
          />
          <AgentBand serverOrigin={serverOrigin} buyerId={buyerId} />
        </div>
      </div>
      <ProductSheet
        hit={opened.hit}
        open={opened.open}
        inCart={opened.hit ? byId.get(opened.hit.product.id) : undefined}
        onClose={() => setOpened((current) => ({ ...current, open: false }))}
        onAdd={addLine}
        onSet={set}
        onSearch={showSearch}
      />
    </div>
  );
}
