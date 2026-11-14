import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ControlAgent, UnmetReason } from "@/lib/supplier-console/types";
import { reasonLabel, statusWord } from "@/lib/supplier-console/format";
import { clientName } from "@/lib/supplier-console/names";
import { Dash } from "../ui/Dash";

/** The client applications an agent was seen through, by their friendly names, as neutral pills. */
export function ClientChips({ clients, max = 3 }: { clients: string[]; max?: number }) {
  const names = [...new Set(clients.map(clientName))];
  if (names.length === 0) return <Dash reason="no app named" />;
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="client-chips">
      {shown.map((name) => (
        <span key={name} className="state">
          {name}
        </span>
      ))}
      {rest > 0 ? <span className="client-more">+{rest}</span> : null}
    </span>
  );
}

/** A status dot with its word: green active, grey idle or read-only, red suspended. */
export function StatusMark({ agent }: { agent: Pick<ControlAgent, "status" | "agent"> }) {
  const { word, tone } = statusWord(agent);
  return (
    <span className="status-mark" data-tone={tone}>
      <span className="status-dot" aria-hidden="true" />
      {word}
    </span>
  );
}

/** A page's title with its date or scope line under it, and at most one quiet control at the right. */
export function ValioHead({ title, date, lead, actions }: { title: string; date?: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {date ? <p className="page-date">{date}</p> : null}
        {lead ? <p className="page-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

/** A frame for a block whose data failed to load or has not arrived. */
export function BlockNote({ children }: { children: ReactNode }) {
  return <p className="empty-frame">{children}</p>;
}

/** An empty block: an icon, one sentence, and the next thing to do. */
export function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="empty-state">
      <Icon aria-hidden="true" />
      <p>{text}</p>
      {action ? (
        <Link href={action.href} className="btn btn-secondary">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Why a request went unserved, as a pill: amber when timing or stock failed, grey when we do not stock it. */
export function ReasonTag({ reason }: { reason: UnmetReason }) {
  return (
    <span className="state reason-tag" data-tone={reason === "not_found" ? undefined : "waiting"}>
      {reasonLabel(reason)}
    </span>
  );
}
