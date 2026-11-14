"use client";

import { useSyncExternalStore } from "react";
import type { Box } from "@/lib/tour/geometry";
import { CLOSED, fromUrl, reduce, restore, type TourEvent, type TourState } from "@/lib/tour/machine";
import { STEPS } from "@/lib/tour/steps";

const STORAGE_KEY = "laituri-tour";

/**
 * One walkthrough for the whole tab. It lives outside React so it survives the layout change between the
 * landing page, the buyer side and Valio Aimo's side, and it is saved to sessionStorage so a reload resumes it.
 */
class TourStore {
  private state: TourState = CLOSED;
  private loaded = false;
  private listeners = new Set<() => void>();
  /** The cut-outs last drawn, so the spotlight on a newly mounted page starts from where it was. */
  lastHoles: Box[] = [];
  /** Where focus was before the tour opened, so closing returns it there. */
  returnFocus: HTMLElement | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.load();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): TourState => {
    this.load();
    return this.state;
  };

  getServerSnapshot = (): TourState => CLOSED;

  dispatch = (event: TourEvent): void => {
    this.load();
    const next = reduce(STEPS, this.state, event);
    if (next === this.state) return;
    if (this.state.status === "closed" && next.status !== "closed" && document.activeElement instanceof HTMLElement) {
      this.returnFocus = document.activeElement;
    }
    this.state = next;
    this.save();
    for (const listener of this.listeners) listener();
  };

  /** The story starts from the entry links; the intro card says what Start will do. */
  open = (): void => this.dispatch({ type: "open" });

  private load(): void {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    let saved: unknown = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      saved = null;
    }
    this.state = fromUrl(STEPS, restore(STEPS, saved), new URLSearchParams(window.location.search).get("tour"));
  }

  private save(): void {
    try {
      if (this.state.status === "closed" && !this.state.tampered) window.sessionStorage.removeItem(STORAGE_KEY);
      else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      return;
    }
  }
}

export const tourStore = new TourStore();

export function useTour(): TourState {
  return useSyncExternalStore(tourStore.subscribe, tourStore.getSnapshot, tourStore.getServerSnapshot);
}
