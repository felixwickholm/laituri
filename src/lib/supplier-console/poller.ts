"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/console/api";

export interface Polled<T> {
  data?: T;
  /** The last failure's sentence; cleared by the next success. */
  error?: string;
  /** When the data last arrived, as epoch ms. */
  updatedAt?: number;
  /**
   * The server wants a credential first (401): the shell shows one calm state for that, so a screen shows no
   * error of its own. Polling goes on, and the first answer after sign-in clears it.
   */
  locked?: boolean;
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
  private inflight: Promise<void> | undefined;
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

  /** Loads now, then keeps polling. A call while a load is under way joins that load instead of starting another. */
  refresh(): Promise<void> {
    this.inflight ??= this.run().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  /** The data, waiting for the load under way (or starting one) when none has arrived yet. */
  async current(): Promise<T | undefined> {
    if (this.state.data === undefined) await this.refresh();
    return this.state.data;
  }

  private async run(): Promise<void> {
    try {
      const data = await this.load();
      const text = JSON.stringify(data);
      if (text !== this.text || this.state.error || this.state.locked) {
        this.text = text;
        this.set({ data, updatedAt: Date.now() });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (!this.state.locked) this.set({ locked: true });
        this.text = "";
      } else {
        this.set({ ...this.state, error: error instanceof Error ? error.message : "The server did not answer." });
      }
    } finally {
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
