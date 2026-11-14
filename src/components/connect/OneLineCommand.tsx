"use client";

import type { CSSProperties } from "react";
import { oneLineCommand } from "@/lib/connect/guides";
import { keyFor, keyNote } from "@/lib/connect/keys";
import { useWorkspace } from "@/lib/console/workspace-store";
import { CopyButton } from "../ui/CopyButton";
import { useOrigin } from "./useOrigin";

/** The landing page's connect line, carrying this visitor's own key for the buyer once the workspace answers. */
export function OneLineCommand({ buyerId, style }: { buyerId: string; style?: CSSProperties }) {
  const origin = useOrigin("https://laituri.example");
  const info = useWorkspace();
  const command = oneLineCommand(origin, keyFor(info, buyerId));
  const note = keyNote(info?.kind);
  return (
    <div className="lp-connect-key rv" style={style}>
      <div className="lp-command">
        <pre>
          <code>{command}</code>
        </pre>
        <CopyButton value={command} label="Copy the connect command" />
      </div>
      {note && <p className="lp-connect-note">{note}</p>}
    </div>
  );
}
