"use client";

import { Eye, Lock } from "lucide-react";
import { useState } from "react";
import { workspaceLine } from "@/lib/console/format/workspace";
import { consoleStore } from "@/lib/console/store";
import { useWorkspace } from "@/lib/console/workspace-store";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";

/** Switches this browser between its own sandbox and the shared workspace, and reloads what the page shows. */
export function useViewSwitch(): { busy: boolean; switchTo: (view: "shared" | "sandbox") => Promise<void> } {
  const [busy, setBusy] = useState(false);
  async function switchTo(view: "shared" | "sandbox") {
    setBusy(true);
    try {
      await consoleStore.setView(view);
    } catch {
      toast("The switch did not reach the server.", "danger");
    } finally {
      setBusy(false);
    }
  }
  return { busy, switchTo };
}

/**
 * "Your demo workspace": its label, that it is private to this browser, the time left before an unused one is
 * replaced, and the way to look at the shared workspace instead.
 */
export function WorkspaceIndicator({ variant = "line" }: { variant?: "line" | "panel" }) {
  const info = useWorkspace();
  const now = useNow(30_000);
  const { busy, switchTo } = useViewSwitch();
  if (!info) return null;
  const line = workspaceLine(info, now);
  const Icon = line.shared ? Eye : Lock;

  return (
    <div className="ws-indicator" data-variant={variant} data-shared={line.shared}>
      <p className="ws-line">
        <Icon aria-hidden="true" />
        <span>
          <span className="ws-title">{line.shared ? line.label : "Your demo workspace"}</span>
          <span className="ws-meta">
            {line.shared ? line.privacy : [line.label, line.privacy, line.timeLeft].filter(Boolean).join(" · ")}
          </span>
        </span>
      </p>
      <button type="button" className="text-link ws-switch" disabled={busy} onClick={() => void switchTo(line.shared ? "sandbox" : "shared")}>
        {line.shared ? "Back to my workspace" : "View the shared workspace"}
      </button>
    </div>
  );
}

/** Shown across the top while the browser looks at the shared workspace: nothing here can be changed. */
export function SharedViewBanner() {
  const info = useWorkspace();
  const { busy, switchTo } = useViewSwitch();
  if (info?.kind !== "shared") return null;
  return (
    <div className="ws-banner" role="status">
      <Eye aria-hidden="true" />
      <p>
        <strong>You are viewing the shared workspace.</strong> It is read-only here: every visitor sees it, so nothing can be changed
        without the passcode.
      </p>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void switchTo("sandbox")}>
        Back to my workspace
      </button>
    </div>
  );
}
