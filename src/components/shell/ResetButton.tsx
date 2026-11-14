"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { consoleStore } from "@/lib/console/store";
import { useWorkspace } from "@/lib/console/workspace-store";
import { toast } from "../ui/toast";

/**
 * Puts this browser's own copy of the demo back to its start: orders, runs and the log. Nobody else's copy changes,
 * so no sign-in is needed. While the browser looks at the shared workspace there is nothing of its own to reset.
 */
export function ResetButton() {
  const [busy, setBusy] = useState(false);
  const shared = useWorkspace()?.kind === "shared";

  async function reset() {
    setBusy(true);
    try {
      await consoleStore.reset();
      toast("Your demo is back to its start. The log verifies again; nobody else's copy changed.", "neutral");
    } catch {
      toast("Reset did not reach the server.", "danger");
    } finally {
      setBusy(false);
    }
  }

  if (shared) return null;
  return (
    <button type="button" className="nav-item" onClick={reset} disabled={busy}>
      <RotateCcw aria-hidden="true" />
      <span className="nav-label">{busy ? "Resetting…" : "Reset my demo"}</span>
    </button>
  );
}
