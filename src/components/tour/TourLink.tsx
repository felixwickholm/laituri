"use client";

import type { MouseEvent, ReactNode } from "react";
import { tourStore } from "./tour-store";

/** The address every "See it in 2 minutes" uses; without script it opens the buyer side with the intro card. */
const TOUR_HREF = "/buyer?tour=start";

/** Every "See it in 2 minutes" entry: opens the tour's intro card in place, the same way from any page. */
export function TourLink({ className, children }: { className?: string; children: ReactNode }) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    tourStore.open();
  }

  return (
    <a href={TOUR_HREF} className={className} onClick={open}>
      {children}
    </a>
  );
}
