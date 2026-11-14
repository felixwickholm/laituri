import { describe, expect, it } from "vitest";
import type { AuditEntry, SupplierOverview } from "@/lib/contracts";
import { FALLBACK_AGENTS, agentsView } from "@/components/landing/agent-rows";
import { landingCounts } from "@/components/landing/counts";
import { pendingOrder } from "../console/fixtures";

function entry(seq: number, event: string, actor: AuditEntry["actor"]): AuditEntry {
  return { seq, event, actor } as unknown as AuditEntry;
}

function agent(name: string, calls: number, extra: Partial<SupplierOverview["agents"][number]> = {}): SupplierOverview["agents"][number] {
  return {
    agent: { id: `agent:${name}`, name },
    buyer: { id: `buyer:${name}`, name: `${name} Kitchens` },
    clients: ["Scripted buyer agent", "Claude Code"],
    firstSeen: "2026-11-09T05:00:00.000Z",
    lastSeen: "2026-11-14T07:00:00.000Z",
    calls,
    quotes: 1,
    orders: { confirmed_auto: 2, confirmed_after_approval: 1, waiting: 0, rejected: 0, blocked: 1 },
    confirmedNet: 100,
    status: "active",
    ...extra,
  };
}

function overview(patch: Partial<SupplierOverview> = {}): SupplierOverview {
  return {
    generatedAt: "2026-11-14T08:00:00.000Z",
    includesSeeded: true,
    agents: [agent("A", 5), agent("B", 30, { status: "idle", clients: ["Scripted buyer agent"] }), agent("C", 12), agent("D", 1)],
    demand: { requests: 0, topConcepts: [] },
    unmet: [
      {
        requestId: "req_1",
        at: "2026-11-13T14:35:00.000Z",
        buyer: { id: "b", name: "Kaisla School Kitchens" },
        agent: { id: "a", name: "Kaisla menu planner" },
        client: "Cursor",
        words: "60 kg of chicken fillet for tomorrow",
        reason: "cutoff_passed",
        reasonText: "The order cut-off for the date had passed.",
      },
    ],
    offers: { signed: 10, ordered: 6, expiredUnused: 4, open: 0, conversionRate: 0.6, medianSecondsToOrder: 34.6 },
    orders: {
      total: { count: 0, net: 0 },
      byOutcome: {
        confirmed_auto: { count: 0, net: 0 },
        confirmed_after_approval: { count: 0, net: 0 },
        waiting: { count: 0, net: 0 },
        rejected: { count: 0, net: 0 },
        blocked: { count: 0, net: 0 },
      },
    },
    rules: [],
    daily: [],
    ...patch,
  };
}

describe("landingCounts", () => {
  const agentActor = { type: "agent" as const, id: "agent:a", name: "A" };
  const other = { type: "agent" as const, id: "agent:b", name: "B" };
  const supplier = { type: "supplier" as const, id: "valio", name: "Valio Aimo" };
  const audit = [entry(1, "offer.issued", supplier), entry(2, "order.requested", agentActor), entry(3, "offer.issued", supplier), entry(4, "catalog.searched", other)];

  it("counts offers, confirmed orders, log steps and agents from the log when the overview is missing", () => {
    const confirmed = { ...pendingOrder(), status: "confirmed" as const };
    expect(landingCounts({ orders: [confirmed, pendingOrder()], audit })).toEqual({
      signedOffers: 2,
      ordersConfirmed: 1,
      logSteps: 4,
      connectedAgents: 2,
      secondsToOrder: undefined,
    });
  });

  it("reads connected agents and the median seconds to order from the supplier overview", () => {
    const counts = landingCounts({ audit, overview: overview() });
    expect(counts.connectedAgents).toBe(4);
    expect(counts.secondsToOrder).toBe(35);
  });

  it("leaves a figure out when its source did not answer", () => {
    expect(Object.values(landingCounts({})).every((value) => value === undefined)).toBe(true);
  });
});

describe("agentsView", () => {
  it("shows the three busiest agents with their buyer, app and confirmed orders", () => {
    const view = agentsView(overview());
    expect(view.agents.map((row) => row.name)).toEqual(["B", "C", "A"]);
    expect(view.agents[0]).toEqual({ name: "B", buyer: "B Kitchens", via: "REST", orders: "3 orders", live: false });
    expect(view.agents[1].via).toBe("Claude Code");
    expect(view.activeNow).toBe(2);
  });

  it("names the newest unserved request in the buyer's words", () => {
    expect(agentsView(overview()).unmet).toEqual({
      text: "60 kg of chicken fillet for tomorrow, from Kaisla School Kitchens.",
      note: "The order cut-off for the date had passed.",
    });
  });

  it("keeps the demo scene's rows when the overview has no agents or no unserved demand", () => {
    const view = agentsView(overview({ agents: [], unmet: [] }));
    expect(view.agents).toBe(FALLBACK_AGENTS.agents);
    expect(view.unmet).toBe(FALLBACK_AGENTS.unmet);
  });
});
