"use client";

import { useLayoutEffect, useRef } from "react";

const MS_PER_CHAR = 18;
const MAX_MS = 520;

/** How much of the new text is already on screen: "Checking rule 9 of 17…" keeps "Checking rule " while the count moves. */
function keptPrefix(before: string, after: string): number {
  let n = 0;
  while (n < before.length && n < after.length && before[n] === after[n]) n++;
  return n;
}

/** A caption that types each new sentence in, fast, from where it differs from the last one. Screen readers get the whole sentence at once. */
export function TypedCaption({ text, className }: { text: string; className?: string }) {
  const shownRef = useRef<HTMLSpanElement>(null);
  const lastRef = useRef("");

  useLayoutEffect(() => {
    const shown = shownRef.current;
    if (!shown) return;
    const from = keptPrefix(lastRef.current, text);
    lastRef.current = text;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.textContent = text;
      return;
    }
    const rest = text.length - from;
    const total = Math.min(MAX_MS, rest * MS_PER_CHAR);
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const share = total === 0 ? 1 : Math.min(1, (now - began) / total);
      shown.textContent = text.slice(0, from + Math.ceil(rest * share));
      if (share < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text]);

  return (
    <p className={className ? `typed-caption ${className}` : "typed-caption"}>
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      <span ref={shownRef} aria-hidden="true" />
    </p>
  );
}
