import { RuleId, type AuditEntry, type AuditEvent, type Order } from "@/lib/contracts";
import { agentName } from "@/lib/supplier-console/names";
import { eur } from "./money";
import { offerSubject } from "./proof";
import { askSentence, blockSentence } from "./rules";
import { plainSentence } from "./sentence";
import { day } from "./time";

const RULES = RuleId.options.length;

const TITLES: Record<AuditEvent, string> = {
  "agent.connected": "Agent connected",
  "agent.suspended": "Agent suspended by Valio Aimo",
  "agent.resumed": "Agent resumed by Valio Aimo",
  "catalog.searched": "Catalogue searched",
  "offer.issued": "Fixed price from Valio Aimo",
  "order.requested": "Order requested",
  "policy.evaluated": "Checked against your limits",
  "order.confirmed": "Order confirmed",
  "order.blocked": "Order blocked",
  "approval.requested": "Needs you",
  "approval.granted": "Approved",
  "approval.rejected": "Rejected",
  "mandate.updated": "Your limits changed",
  "access.refused": "Attempt refused",
  "basket.started": "Basket started",
  "basket.line_resolved": "Basket line decided",
  "handoff.requested": "Question to Valio Aimo",
  "handoff.answered": "Valio Aimo answered",
};

/** A log entry's event in plain English: "Approved by the purchasing manager", "Checked against your limits". */
export function auditTitle(entry: Pick<AuditEntry, "event" | "actor">): string {
  const title = TITLES[entry.event] ?? entry.event;
  if (entry.event === "approval.granted" || entry.event === "approval.rejected") {
    return entry.actor.type === "human" ? `${title} by the purchasing manager` : entry.event === "approval.rejected" ? "Approval refused" : title;
  }
  return title;
}

type Data = Record<string, unknown>;

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function netOf(data: Data): number | undefined {
  const totals = data.totals as { net?: { amount?: unknown } } | undefined;
  return num(totals?.net?.amount);
}

function checksOf(data: Data): { status?: string }[] {
  return Array.isArray(data.checks) ? (data.checks as { status?: string }[]) : [];
}

function orderLine(order: Order): string {
  return `${offerSubject(order.offer)} · ${eur(order.offer.totals.net.amount)}${NBSP}net`;
}

const NBSP = "\u00a0";

/**
 * An offer that could not cover the request in full. Its own total would mislead next to the order
 * that used an alternative, so say what was short and how many signed alternatives came with it.
 */
function partialOffer(summary: string, data: Data): string {
  const alternatives = num(data.alternatives) ?? 0;
  const tail = alternatives > 0 ? ` · ${alternatives} signed ${alternatives === 1 ? "alternative" : "alternatives"}` : "";
  const shortOf = summary.match(/Only ([\d,]+) of ([\d,]+)/i);
  if (shortOf) return `Only ${shortOf[1]} of ${shortOf[2]} in stock${tail}`;
  const offered = summary.match(/offered ([\d,]+) x/i);
  if (offered) return `Partial: ${offered[1]} in stock${tail}`;
  return `Partial offer${tail}`;
}

/**
 * One short line of detail for a log row, written from the entry's structured data and its order.
 * Falls back to the entry's own sentence when the data it needs is missing.
 */
export function auditDetail(entry: Pick<AuditEntry, "event" | "actor" | "summary" | "refs" | "data">, orders: Order[] = []): string {
  const data = (entry.data ?? {}) as Data;
  const order =
    orders.find((item) => item.id === entry.refs.orderId) ?? orders.find((item) => item.offer.id === entry.refs.offerId);
  switch (entry.event) {
    case "agent.connected":
      return `${agentName(entry.actor)} connected`;
    case "catalog.searched": {
      const found = num(data.previews) ?? (Array.isArray(data.hits) ? data.hits.length : undefined);
      if (found !== undefined && typeof data.query === "string") return `Found ${found} ${found === 1 ? "product" : "products"} for '${data.query}'`;
      break;
    }
    case "offer.issued": {
      if (data.fulfilment && data.fulfilment !== "full") return partialOffer(entry.summary, data);
      if (order) return orderLine(order);
      const net = netOf(data);
      if (net !== undefined) return `${eur(net)}${NBSP}net${typeof data.deliveryDate === "string" ? ` · delivers ${day(data.deliveryDate)}` : ""}`;
      break;
    }
    case "policy.evaluated": {
      const outcome = data.outcome;
      const open = checksOf(data);
      if (outcome === "auto_approved") return `All ${RULES} checks passed`;
      if (outcome === "needs_approval") {
        const asks = open.filter((check) => check.status === "ask").length || 1;
        return `${asks} of ${RULES} checks ${asks === 1 ? "needs" : "need"} a person`;
      }
      if (outcome === "blocked") {
        const blocks = open.filter((check) => check.status === "block").length || 1;
        return `${blocks} of ${RULES} checks ${blocks === 1 ? "blocks" : "block"} the order`;
      }
      break;
    }
    case "approval.requested": {
      const ask = order?.decision.checks.find((check) => check.status === "ask");
      if (ask) return askSentence(ask);
      break;
    }
    case "order.blocked": {
      const block = order?.decision.checks.find((check) => check.status === "block");
      if (block) return blockSentence(block);
      break;
    }
    case "access.refused":
      return plainSentence(entry.summary);
    case "mandate.updated":
      if (num(data.version) !== undefined) return `Version ${data.version}, signed again by the buyer`;
      break;
    default:
      if (order) return orderLine(order);
  }
  return plainSentence(entry.summary);
}
