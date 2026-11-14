import type { AuditEntry, AuditEvent } from "@/lib/contracts";
import { helsinkiDate } from "./week";

export type EventGroup = "orders" | "approvals" | "agent" | "mandate" | "refused";

const GROUP_OF: Record<AuditEvent, EventGroup> = {
  "agent.connected": "agent",
  "agent.suspended": "agent",
  "agent.resumed": "agent",
  "catalog.searched": "agent",
  "offer.issued": "orders",
  "order.requested": "orders",
  "policy.evaluated": "orders",
  "order.confirmed": "orders",
  "order.blocked": "orders",
  "approval.requested": "approvals",
  "approval.granted": "approvals",
  "approval.rejected": "approvals",
  "mandate.updated": "mandate",
  "access.refused": "refused",
};

export const EVENT_GROUPS: { key: EventGroup; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "approvals", label: "Approvals" },
  { key: "agent", label: "Agent" },
  { key: "mandate", label: "Mandate" },
  { key: "refused", label: "Refused" },
];

export function eventGroup(event: AuditEvent): EventGroup {
  return GROUP_OF[event] ?? "agent";
}

/** Who wrote an entry, in the log's own words. */
export function actorKind(entry: Pick<AuditEntry, "actor">): string {
  switch (entry.actor.type) {
    case "human":
      return "Approver";
    case "supplier":
      return "Valio Aimo";
    default:
      return "Agent";
  }
}

export interface DayCount {
  date: string;
  label: string;
  count: number;
  today: boolean;
}

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Entries per Helsinki day for the seven days that end today, oldest first. */
export function entriesPerDay(entries: Pick<AuditEntry, "at">[], nowMs: number): DayCount[] {
  const today = helsinkiDate(nowMs);
  const days: DayCount[] = [];
  for (let back = 6; back >= 0; back -= 1) {
    const date = new Date(`${today.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - back);
    const iso = date.toISOString().slice(0, 10);
    days.push({ date: iso, label: WEEKDAY[(today.weekday - back + 7) % 7], count: 0, today: back === 0 });
  }
  const index = new Map(days.map((day, i) => [day.date, i]));
  for (const entry of entries) {
    const at = Date.parse(entry.at);
    if (Number.isNaN(at)) continue;
    const slot = index.get(helsinkiDate(at).date);
    if (slot !== undefined) days[slot].count += 1;
  }
  return days;
}
