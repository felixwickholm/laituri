"use client";

import { useCallback, useEffect, useState } from "react";
import { addLine, parseCart, setPacks, type Cart, type CartLine } from "./cart";

const PREFIX = "laituri-cart:";

function read(key: string): Cart {
  try {
    return parseCart(window.localStorage.getItem(PREFIX + key));
  } catch {
    return [];
  }
}

function write(key: string, cart: Cart): void {
  try {
    if (cart.length) window.localStorage.setItem(PREFIX + key, JSON.stringify(cart));
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Storage is blocked or full: the cart still works for this visit.
  }
}

/** The person's cart, kept in this browser for this workspace only. `key` is undefined until the workspace is known. */
export function useCart(key: string | undefined) {
  const [state, setState] = useState<{ key?: string; cart: Cart }>({ cart: [] });
  if (key && state.key !== key) setState({ key, cart: read(key) });

  useEffect(() => {
    if (state.key) write(state.key, state.cart);
  }, [state]);

  const update = useCallback((change: (cart: Cart) => Cart) => setState((current) => ({ ...current, cart: change(current.cart) })), []);
  return {
    cart: state.cart,
    add: useCallback((line: CartLine) => update((cart) => addLine(cart, line)), [update]),
    set: useCallback((productId: string, packs: number) => update((cart) => setPacks(cart, productId, packs)), [update]),
    clear: useCallback(() => update(() => []), [update]),
  };
}
