"use client";

import { CircleHelp, Ellipsis, FileWarning, KeyRound } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { consoleStore } from "@/lib/console/store";
import { toast } from "../ui/toast";
import { useDismiss } from "../ui/useDismiss";

/** Tamper with the log, so the browser check can be seen failing. Reset restores it. */
export async function tamperWithLog(): Promise<void> {
  try {
    const seq = await consoleStore.tamper();
    toast(`Entry ${seq} was changed on the server.`, "danger");
  } catch {
    toast("The log could not be changed.", "danger");
  }
}

export function ProofTools() {
  const [open, setOpen] = useState<"how" | "menu" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useDismiss(root, open !== null, close);

  return (
    <div ref={root} style={{ position: "relative", display: "flex", gap: 2 }}>
      <button
        type="button"
        className="icon-btn"
        aria-label="How is this checked?"
        title="How is this checked?"
        aria-expanded={open === "how"}
        onClick={() => setOpen(open === "how" ? null : "how")}
      >
        <CircleHelp aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open === "menu"}
        onClick={() => setOpen(open === "menu" ? null : "menu")}
      >
        <Ellipsis aria-hidden="true" />
      </button>
      {open === "how" ? (
        <div className="popover glass" role="dialog" aria-label="How is this checked?" style={{ top: 40, right: 0 }}>
          <h3>How is this checked?</h3>
          <p>Each entry carries the hash of the one before it, so a changed entry breaks the chain.</p>
          <p>Each entry is also signed by Valio Aimo. Your browser checks both with the public keys.</p>
          <p>Your browser also remembers the newest entry it saw, so a shortened log is noticed.</p>
        </div>
      ) : null}
      {open === "menu" ? (
        <div className="menu glass" role="menu" style={{ top: 40, right: 0 }}>
          <button type="button" role="menuitem" onClick={() => { close(); window.open("/.well-known/jwks.json", "_blank", "noopener"); }}>
            <KeyRound aria-hidden="true" />
            Open the public keys
          </button>
          <button type="button" role="menuitem" onClick={() => { close(); void tamperWithLog(); }}>
            <FileWarning aria-hidden="true" />
            Tamper with the log
          </button>
          <p className="hint">Tampering changes one stored entry. Reset restores the log.</p>
        </div>
      ) : null}
    </div>
  );
}
