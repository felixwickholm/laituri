import { describe, expect, it } from "vitest";
import type { SupplierOverview } from "@/lib/contracts";
import { demandFlow } from "@/lib/supplier-console/flow";
import { FALLBACK_AGENTS, agentsView } from "@/components/landing/agent-rows";
import { landingFigures, shown } from "@/components/landing/counts";
import { demandKey } from "@/components/landing/demand-key";

function agent(name: string, calls: number, extra: Partial<SupplierOverview["agents"][number]> = {}): SupplierOverview["agents"][number] {
  return {
    agent: { id: `agent:${name}`, name },
    buyer: { id: `buyer:${name}`, name: `${name} Kitchens` },
    clients: ["Scripted buyer agent", "Claude Code"],
    firstSeen: "2026-11-09T05:00:00.000Z",
    lastSeen: "2026-11-14T07:00:00.000Z",
    calls,
    quotes: 1,
    orders: { confirmed_auto: 2, confirmed_after_approval: 1, waiting: 0, rejected: 0, blocked: 1, refused: 0 },
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
        refused: { count: 0, net: 0 },
      },
    },
    rules: [],
    daily: [],
    ...patch,
  };
}

function day(date: string, requests: number, ordered: number, confirmed: number, confirmedNet: number) {
  return { date, requests, ordered, orders: confirmed, confirmed, confirmedNet };
}

describe("landingFigures", () => {
  const week = [day("2026-11-08", 4, 3, 2, 300.1), day("2026-11-09", 0, 0, 0, 0), day("2026-11-14", 6, 5, 4, 1000.2)];

  it("counts the same seven days as the Valio Aimo overview: agents, requests, confirmed orders and their net", () => {
    expect(landingFigures(overview({ daily: week }))).toEqual({ agents: 4, requests: 10, ordersConfirmed: 6, confirmedNet: 1300.3 });
  });

  it("does not count orders from outside the seven days, even when the all-time outcome counts are higher", () => {
    const allTime = overview({ daily: week }).orders;
    allTime.byOutcome.confirmed_auto = { count: 22, net: 9000 };
    expect(landingFigures(overview({ daily: week, orders: allTime })).ordersConfirmed).toBe(6);
  });

  it("gives nothing when the overview did not answer", () => {
    expect(landingFigures(undefined)).toEqual({});
  });

  it("shows a figure only when it is a positive number; zero and missing become a dash", () => {
    expect(shown(3)).toBe(true);
    expect(shown(0)).toBe(false);
    expect(shown(undefined)).toBe(false);
    expect(shown(Number.NaN)).toBe(false);
  });
});

describe("demandKey", () => {
  it("reads served, unserved with its estimated net, and requests that led to an order from the flow", () => {
    const model = demandFlow({
      requests: 10,
      ordered: 5,
      unmet: [
        { ...overview().unmet[0], reason: "short_stock", estimatedLostNet: 120.5 },
        { ...overview().unmet[0], requestId: "req_2", reason: "not_found" },
      ],
      orders: overview().orders.byOutcome,
      week: { orders: 0, confirmed: 0, confirmedNet: 0 },
    });
    expect(demandKey(model)).toEqual({ served: 8, unserved: 2, unservedNet: 120.5, ordered: 5 });
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
