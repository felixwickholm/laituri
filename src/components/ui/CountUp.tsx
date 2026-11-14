"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 300;

/** A number that counts from its last value to the new one in 300 ms. Reduced motion shows it at once. */
export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    const began = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const t = Math.min(1, (time - began) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(start + (value - start) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="count-up">{format(shown)}</span>;
}
