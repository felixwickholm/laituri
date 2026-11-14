"use client";

import { useSyncExternalStore } from "react";

export interface Polled<T> {
  data?: T;
  /** The last failure's sentence; cleared by the next success. */
  error?: string;
  /** When the data last arrived, as epoch ms. */
  updatedAt?: number;
}

type Listener = () => void;

/**
 * One shared poller per resource: it runs while something on screen listens and the tab is visible,
 * keeps the last good data through a failure, and skips a re-render when the answer did not change.
 */
export class Poller<T> {
  private state: Polled<T> = {};
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private busy = false;
  private text = "";

  constructor(
    private readonly load: () => Promise<T>,
    private readonly everyMs: number,
  ) {}

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      document.addEventListener("visibilitychange", this.onVisibility);
      void this.refresh();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        document.removeEventListener("visibilitychange", this.onVisibility);
        clearTimeout(this.timer);
      }
    };
  };

  getSnapshot = (): Polled<T> => this.state;
  getServerSnapshot = (): Polled<T> => EMPTY;

  private onVisibility = (): void => {
    clearTimeout(this.timer);
    if (document.visibilityState === "visible") void this.refresh();
  };

  /** Loads now, then keeps polling. A call while a load is under way is dropped. */
  async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const data = await this.load();
      const text = JSON.stringify(data);
      if (text !== this.text || this.state.error) {
        this.text = text;
        this.set({ data, updatedAt: Date.now() });
      }
    } catch (error) {
      this.set({ ...this.state, error: error instanceof Error ? error.message : "The server did not answer." });
    } finally {
      this.busy = false;
      clearTimeout(this.timer);
      if (this.listeners.size > 0 && document.visibilityState === "visible") {
        this.timer = setTimeout(() => void this.refresh(), this.everyMs);
      }
    }
  }

  private set(state: Polled<T>): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

const EMPTY: Polled<never> = {};

export function usePolled<T>(poller: Poller<T>): Polled<T> {
  return useSyncExternalStore(poller.subscribe, poller.getSnapshot, poller.getServerSnapshot);
}
