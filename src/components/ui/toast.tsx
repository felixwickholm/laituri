"use client";

import { AlertCircle, Check } from "lucide-react";
import { useSyncExternalStore } from "react";

type Tone = "success" | "danger" | "neutral";

interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const HIDE_MS = 4000;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Shows a short message above the dock for four seconds. */
export function toast(text: string, tone: Tone = "success"): void {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, text, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  }, HIDE_MS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Toast[] = [];

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <div className="toast-stack">
        {items.map((item) => (
          <div key={item.id} className="toast glass" data-tone={item.tone}>
            {item.tone === "danger" ? <AlertCircle aria-hidden="true" /> : item.tone === "success" ? <Check aria-hidden="true" /> : null}
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
}
