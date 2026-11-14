"use client";

import { useSyncExternalStore } from "react";
import { ApiError, api } from "./api";
import type { Basket, CreateBasketRequest } from "@/lib/contracts";

/** While a basket is worked, lines turn one by one: poll fast. Otherwise a calm refresh. */
const FAST_MS = 700;
const CALM_MS = 4000;

interface BasketSnapshot {
  ready: boolean;
  /** False while the baskets route does not answer (404): the screens stay quiet instead of showing an error. */
  available: boolean;
  baskets: Basket[];
}

const EMPTY: BasketSnapshot = { ready: false, available: true, baskets: [] };

type Listener = () => void;

/** Newest first, with one basket replaced by a fresher copy. */
export function mergeBasket(baskets: Basket[], basket: Basket): Basket[] {
  const rest = baskets.filter((item) => item.id !== basket.id);
  return [basket, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One poller for every basket screen. */
class BasketStore {
  private snapshot: BasketSnapshot = EMPTY;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private text = "";
  private busy = false;
  /** Set right after a start, so the first rounds poll fast before the basket shows up in the list. */
  private eager = 0;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      document.addEventListener("visibilitychange", this.onVisibility);
      void this.tick();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        document.removeEventListener("visibilitychange", this.onVisibility);
        clearTimeout(this.timer);
      }
    };
  };

  getSnapshot = (): BasketSnapshot => this.snapshot;
  getServerSnapshot = (): BasketSnapshot => EMPTY;

  private set(patch: Partial<BasketSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private onVisibility = (): void => {
    clearTimeout(this.timer);
    if (document.visibilityState === "visible") void this.tick();
  };

  private schedule(): void {
    clearTimeout(this.timer);
    if (document.visibilityState !== "visible" || this.listeners.size === 0) return;
    const running = this.snapshot.baskets.some((basket) => basket.status === "running");
    const fast = running || this.eager > 0;
    if (this.eager > 0) this.eager -= 1;
    this.timer = setTimeout(() => void this.tick(), fast ? FAST_MS : CALM_MS);
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const text = JSON.stringify(await api.baskets());
      if (text !== this.text || !this.snapshot.ready) {
        this.text = text;
        this.set({ ready: true, available: true, baskets: (JSON.parse(text) as Basket[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
      }
    } catch (error) {
      this.set({ ready: true, available: !(error instanceof ApiError && error.status === 404) });
    } finally {
      this.busy = false;
      this.schedule();
    }
  }

  private async started(basketId: string): Promise<string> {
    this.eager = 10;
    try {
      this.set({ baskets: mergeBasket(this.snapshot.baskets, await api.basket(basketId)) });
    } catch {
      // The list read picks it up on the next round.
    }
    void this.tick();
    return basketId;
  }

  /** Starts this buyer's standing weekly order and returns the new basket's id. */
  async startWeekly(): Promise<string> {
    const { basketId } = await api.startWeekly();
    return this.started(basketId);
  }

  /** Sends a basket a person wrote or changed. */
  async place(body: CreateBasketRequest): Promise<string> {
    const { basketId } = await api.placeBasket(body);
    return this.started(basketId);
  }

  /** Takes one option on a line; the answer is the whole basket, applied at once. */
  async resolve(basketId: string, lineId: string, optionId: string): Promise<Basket> {
    const basket = await api.resolveLine(basketId, lineId, optionId);
    this.set({ baskets: mergeBasket(this.snapshot.baskets, basket) });
    return basket;
  }
}

export const basketStore = new BasketStore();

export function useBaskets(): BasketSnapshot {
  return useSyncExternalStore(basketStore.subscribe, basketStore.getSnapshot, basketStore.getServerSnapshot);
}
