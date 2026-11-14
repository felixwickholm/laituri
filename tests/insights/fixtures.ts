import type { Approval, Check, Order, SignedOffer } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";
import type { Activity } from "@/lib/store/types";
import { offer } from "../policy/fixtures";

export const NOW = new Date("2026-11-14T09:00:00+02:00");

export const HARBOUR = { id: "fi:ovt:003712345678", name: "Nordic Harbour Hotels" };
export const KAISLA = { id: "fi:ovt:003723456789", name: "Kaisla School Kitchens" };
export const HARBOUR_AGENT = { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };
export const KAISLA_AGENT = { id: "agent:kaisla-menu-planner", name: "Kaisla menu planner" };

const APPROVAL: Approval = {
  decidedBy: { id: "user:maria.lind", name: "Maria Lind" },
  decision: "approved",
  decidedAt: "2026-11-13T07:10:00.000Z",
  jws: "a.b.c",
};

export function signedOffer(id: string, issuedAt: string, expiresAt: string): SignedOffer {
  return { offer: offer({ id, issuedAt, expiresAt }), jws: "a.b.c" };
}

interface OrderSpec {
  id: string;
  status: Order["status"];
  net: number;
  createdAt: string;
  offerId?: string;
  approved?: boolean;
  checks?: Check[];
  agent?: Order["agent"];
  buyer?: Order["buyer"];
  seeded?: true;
}

export function order(spec: OrderSpec): Order {
  return {
    id: spec.id,
    status: spec.status,
    createdAt: spec.createdAt,
    updatedAt: spec.createdAt,
    mandateId: "mandate:test",
    agent: spec.agent ?? HARBOUR_AGENT,
    buyer: spec.buyer ?? HARBOUR,
    offer: offer({ id: spec.offerId ?? `off_${spec.id}`, totals: { net: { amount: spec.net, currency: "EUR" }, tax: { amount: 0, currency: "EUR" }, gross: { amount: spec.net, currency: "EUR" } } }),
    decision: { outcome: spec.checks?.length ? "needs_approval" : "auto_approved", checks: spec.checks ?? [] },
    ...(spec.approved ? { approval: APPROVAL } : {}),
    simulated: true,
    ...(spec.seeded ? { seeded: spec.seeded } : {}),
  };
}

export function record(patch: Partial<DemandRecord> & Pick<DemandRecord, "id" | "requestId" | "at">): DemandRecord {
  return { kind: "search", agent: HARBOUR_AGENT, buyer: HARBOUR, client: "Claude Code", productIds: [], outcome: "met_in_full", ...patch };
}

export function activity(patch: Partial<Activity> & Pick<Activity, "id" | "at">): Activity {
  return { agent: HARBOUR_AGENT, buyer: HARBOUR, client: "Claude Code", kind: "tool", tool: "search_catalog", title: "Searched", status: "ok", ...patch };
}
