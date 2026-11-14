"use client";

import type { MouseEvent, ReactNode } from "react";
import { tourStore } from "./tour-store";

/** The address every "Demo walkthrough" uses; without script it opens the customer's side with the Start card. */
const TOUR_HREF = "/buyer?tour=start";

/** Every "Demo walkthrough" entry: opens the Start card in place, the same way from any page. */
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
