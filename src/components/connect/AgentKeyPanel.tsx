"use client";

import type { WorkspaceInfo } from "@/lib/contracts";
import { buyersFirst, keyFor, keyNote } from "@/lib/connect/keys";
import { WorkspaceIndicator } from "../session/WorkspaceIndicator";
import { CodeBlock } from "./CodeBlock";

interface Props {
  info: WorkspaceInfo | undefined;
  primaryBuyerId: string;
  buyerId: string;
  onBuyer: (buyerId: string) => void;
}

/** The agent key every command on this page carries, which demo buyer it acts for, and whose workspace it reaches. */
export function AgentKeyPanel({ info, primaryBuyerId, buyerId, onBuyer }: Props) {
  const buyers = buyersFirst(info, primaryBuyerId);
  const chosen = buyers.find((entry) => entry.buyer.id === buyerId);
  const note = keyNote(info?.kind);

  return (
    <div className="cx-key">
      <div className="cx-key-head">
        <h3>Agent key</h3>
        {chosen && <p className="cx-key-agent">Acts as {chosen.agent.name}</p>}
      </div>
      {buyers.length > 1 && (
        <div className="segmented inline cx-buyers" role="group" aria-label="Demo buyer">
          {buyers.map((entry) => (
            <button key={entry.buyer.id} type="button" aria-pressed={entry.buyer.id === buyerId} onClick={() => onBuyer(entry.buyer.id)}>
              {entry.buyer.name}
            </button>
          ))}
        </div>
      )}
      <CodeBlock code={{ value: keyFor(info, buyerId), label: `Copy the agent key${chosen ? ` for ${chosen.buyer.name}` : ""}` }} />
      {note && <p className="cx-key-note">{note}</p>}
      <WorkspaceIndicator variant="panel" />
    </div>
  );
}
