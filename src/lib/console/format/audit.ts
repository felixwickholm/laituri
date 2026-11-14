import type { AuditEntry, AuditEvent } from "@/lib/contracts";
import { shortName } from "./rules";

const TITLES: Record<AuditEvent, string> = {
  "agent.connected": "Agent connected",
  "catalog.searched": "Catalogue searched",
  "offer.issued": "Offer signed by Valio Aimo",
  "order.requested": "Order requested",
  "policy.evaluated": "Checked against the mandate",
  "order.confirmed": "Order confirmed",
  "order.blocked": "Order blocked",
  "approval.requested": "Waiting for approval",
  "approval.granted": "Approved",
  "approval.rejected": "Rejected",
  "mandate.updated": "Mandate re-signed",
};

/** A log entry's event in plain English: "Approved by Maria Lind", "Checked against the mandate". */
export function auditTitle(entry: Pick<AuditEntry, "event" | "actor">): string {
  const title = TITLES[entry.event] ?? entry.event;
  if (entry.event === "approval.granted" || entry.event === "approval.rejected") {
    return entry.actor.type === "human" ? `${title} by ${shortName(entry.actor.name)}` : entry.event === "approval.rejected" ? "Approval refused" : title;
  }
  return title;
}
