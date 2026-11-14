"use client";

import { useSyncExternalStore } from "react";

/** What the "Ask Valio Aimo" sheet is about: a basket line, an order, or nothing in particular. */
export interface HandoffTopic {
  basketId?: string;
  lineId?: string;
  orderId?: string;
  /** "Line: 20 kg almond flour. Blocked: contains nuts." Filled in for the person. */
  context: string;
}

let topic: HandoffTopic | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the "Ask Valio Aimo" sheet from anywhere: a line, the order sheet or the link on Today. */
export function askValioAimo(next: HandoffTopic): void {
  topic = next;
  emit();
}

export function closeHandoff(): void {
  topic = null;
  emit();
}

export function useHandoffTopic(): HandoffTopic | null {
  return useSyncExternalStore(
    subscribe,
    () => topic,
    () => null,
  );
}

export const GENERAL_TOPIC: HandoffTopic = { context: "A question about your orders." };
