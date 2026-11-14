"use client";

import { RotateCcw } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { consoleStore } from "@/lib/console/store";
import { withApprover } from "../session/gate";
import { toast } from "../ui/toast";

/** Clears orders, runs and the log back to the demo's start. Only the approver may do it. */
export function ResetButton() {
  const [busy, setBusy] = useState(false);

  async function reset(event: MouseEvent<HTMLButtonElement>) {
    setBusy(true);
    try {
      const done = await withApprover(event.currentTarget, async () => {
        await consoleStore.reset();
        return true;
      });
      if (done) toast("Demo reset. The log starts again and verifies.", "neutral");
    } catch {
      toast("Reset did not reach the server.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="nav-item" onClick={reset} disabled={busy}>
      <RotateCcw aria-hidden="true" />
      <span className="nav-label">{busy ? "Resetting…" : "Reset demo"}</span>
    </button>
  );
}
