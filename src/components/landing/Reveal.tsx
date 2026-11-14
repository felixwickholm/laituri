"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

type RevealState = "shown" | "waiting" | "in";

/**
 * A section whose parts rise in once when it scrolls into view. Without script, or when it is already
 * on screen at load, everything is simply shown. Children opt in with the `rv` class and a `--i` order.
 */
export function Reveal({ as: Tag = "section", className, children, ...rest }: { as?: "section" | "footer" | "div"; className?: string; children: ReactNode; id?: string; "aria-labelledby"?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    const set = (state: RevealState) => (element.dataset.reveal = state);
    set("waiting");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        set("in");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={className} data-reveal="shown" {...rest}>
      {children}
    </Tag>
  );
}
