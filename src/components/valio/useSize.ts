"use client";

import { useEffect, useRef, useState } from "react";

/** The rendered size of an element, so an SVG chart can be drawn at its real pixel size. */
export function useSize<T extends HTMLElement>(fallback: { width: number; height: number }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
