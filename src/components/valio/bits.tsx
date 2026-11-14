import type { ReactNode } from "react";
import type { ControlAgent } from "@/lib/supplier-console/types";
import { statusWord } from "@/lib/supplier-console/format";

/** The client applications an agent was seen through, as plain text chips. */
export function ClientChips({ clients, max = 3 }: { clients: string[]; max?: number }) {
  if (clients.length === 0) return <span className="dim">–</span>;
  const shown = clients.slice(0, max);
  const rest = clients.length - shown.length;
  return (
    <span className="client-chips">
      {shown.map((client) => (
        <span key={client} className="client-chip">
          {client}
        </span>
      ))}
      {rest > 0 ? <span className="client-chip" data-more="true">+{rest}</span> : null}
    </span>
  );
}

/** A status dot with its word: green active, grey idle, red suspended. */
export function StatusMark({ agent }: { agent: Pick<ControlAgent, "status"> }) {
  const { word, tone } = statusWord(agent);
  return (
    <span className="status-mark" data-tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {word}
    </span>
  );
}

/** The honest line every control page ends with. */
export function ControlFoot() {
  return <p className="control-foot">Prices and stock are live from the challenge&rsquo;s mock API. Orders are simulated. History is demo data.</p>;
}

/** A frame for a block whose data failed to load or has not arrived. */
export function BlockNote({ children }: { children: ReactNode }) {
  return <p className="empty-frame">{children}</p>;
}
