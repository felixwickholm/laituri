"use client";

import { Ellipsis } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SessionRole } from "@/lib/console/types";
import { useDismiss } from "../ui/useDismiss";
import { MorePanel } from "./MorePanel";

const WIDTH = 320;
const GAP = 8;
const EDGE = 16;

interface Spot {
  left: number;
  bottom: number;
}

/** Above the trigger, left edges aligned, kept inside the window. */
function place(anchor: DOMRect): Spot {
  const left = Math.min(Math.max(EDGE, anchor.left), window.innerWidth - WIDTH - EDGE);
  return { left, bottom: window.innerHeight - anchor.top + GAP };
}

/** One quiet "More" line in the sidebar; it opens a small menu that grows from the line. */
export function MoreMenu({ role }: { role: SessionRole }) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = spot !== null;

  const close = useCallback(() => setSpot(null), []);
  const closeAndReturn = useCallback(() => {
    setSpot(null);
    trigger.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(root, open, closeAndReturn);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("a, button:not([disabled])")?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setSpot(null);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  return (
    <div ref={root} className="more-menu">
      <button
        ref={trigger}
        type="button"
        className="nav-item"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => setSpot(open ? null : place(event.currentTarget.getBoundingClientRect()))}
      >
        <Ellipsis aria-hidden="true" />
        <span className="nav-label">More</span>
      </button>
      {spot ? (
        <div ref={menu} id={id} className="popover demo-pop glass-strong" role="dialog" aria-label="More" style={{ position: "fixed", left: spot.left, bottom: spot.bottom, width: WIDTH }}>
          <MorePanel role={role} onLeave={close} />
        </div>
      ) : null}
    </div>
  );
}
