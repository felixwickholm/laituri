"use client";

import { ChevronsUpDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { workspaceLine } from "@/lib/console/format/workspace";
import type { SessionRole } from "@/lib/console/types";
import { useWorkspace } from "@/lib/console/workspace-store";
import { useDismiss } from "../ui/useDismiss";
import { useNow } from "../ui/useNow";
import { DemoPanel } from "./DemoPanel";

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

/**
 * One quiet "Demo" line in the sidebar. It opens a small menu that grows from the line and holds the demo's
 * machinery, so the frame itself reads as the product.
 */
export function DemoMenu({ role }: { role: SessionRole }) {
  const info = useWorkspace();
  const now = useNow(60_000);
  const [spot, setSpot] = useState<Spot | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = spot !== null;
  const label = info ? workspaceLine(info, now).label : undefined;

  const close = useCallback(() => setSpot(null), []);
  const closeAndReturn = useCallback(() => {
    setSpot(null);
    trigger.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(root, open, closeAndReturn);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("button:not([disabled]), summary")?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setSpot(null);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  return (
    <div ref={root} className="demo-menu">
      <button
        ref={trigger}
        type="button"
        className="demo-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => setSpot(open ? null : place(event.currentTarget.getBoundingClientRect()))}
      >
        <span className="demo-trigger-word">Demo</span>
        {label ? <span className="demo-trigger-label">· {label}</span> : null}
        <ChevronsUpDown aria-hidden="true" />
      </button>
      {spot ? (
        <div ref={menu} id={id} className="popover demo-pop" role="dialog" aria-label="Demo" style={{ position: "fixed", left: spot.left, bottom: spot.bottom, width: WIDTH }}>
          <DemoPanel role={role} onLeave={close} />
        </div>
      ) : null}
    </div>
  );
}
