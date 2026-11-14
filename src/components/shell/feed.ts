"use client";

import { useSyncExternalStore } from "react";
import { HandoffList, type Handoff } from "@/lib/contracts";

const POLL_MS = 4000;
const NONE: Handoff[] = [];

/**
 * The questions kitchens asked Valio Aimo, for the count beside Questions. It polls only while the Valio Aimo frame is
 * on screen and the tab is visible. A route that does not answer leaves the list empty: nothing is invented.
 */
class HandoffFeed {
  private items: Handoff[] = NONE;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) void this.poll();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) clearTimeout(this.timer);
    };
  };

  getSnapshot = (): Handoff[] => this.items;
  getServerSnapshot = (): Handoff[] => NONE;

  private async poll(): Promise<void> {
    clearTimeout(this.timer);
    if (document.visibilityState === "visible") {
      try {
        const response = await fetch("/api/v1/handoffs", { cache: "no-store" });
        const parsed = response.ok ? HandoffList.safeParse(await response.json()) : undefined;
        if (parsed?.success) {
          this.items = parsed.data.handoffs;
          for (const listener of this.listeners) listener();
        }
      } catch {
        // Offline or not built yet: the count stays as it was.
      }
    }
    if (this.listeners.size > 0) this.timer = setTimeout(() => void this.poll(), POLL_MS);
  }
}

const handoffFeed = new HandoffFeed();

function noSubscribe(): () => void {
  return () => undefined;
}

export function useHandoffs(enabled: boolean): Handoff[] {
  const list = useSyncExternalStore(enabled ? handoffFeed.subscribe : noSubscribe, handoffFeed.getSnapshot, handoffFeed.getServerSnapshot);
  return enabled ? list : NONE;
}
