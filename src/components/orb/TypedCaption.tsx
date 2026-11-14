"use client";

import { useLayoutEffect, useRef } from "react";

const MS_PER_CHAR = 18;
const MAX_MS = 520;

/** A caption that types each new sentence in, fast. Screen readers get the whole sentence at once. */
export function TypedCaption({ text, className }: { text: string; className?: string }) {
  const shownRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const shown = shownRef.current;
    if (!shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.textContent = text;
      return;
    }
    const total = Math.min(MAX_MS, text.length * MS_PER_CHAR);
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const share = total === 0 ? 1 : Math.min(1, (now - began) / total);
      shown.textContent = text.slice(0, Math.ceil(text.length * share));
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
