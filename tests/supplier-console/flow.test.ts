import { describe, expect, it } from "vitest";
import type { OrderStats, UnmetRequest } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";
import {
  alternativeRequests,
  demandFlow,
  flowRows,
  flowSummary,
  layoutFlow,
  nodeFigure,
  nodeLines,
  spreadLabels,
  type FlowInput,
} from "@/lib/supplier-console/flow";

const tally = (count: number, net: number) => ({ count, net });

const ORDERS: OrderStats["byOutcome"] = {
  confirmed_auto: tally(12, 2057.9),
  confirmed_after_approval: tally(7, 2147.16),
  waiting: tally(1, 909),
  rejected: tally(1, 454.5),
  blocked: tally(3, 312.94),
  refused: tally(0, 0),
};

function unmet(reason: UnmetRequest["reason"], estimatedLostNet?: number, at = "2026-11-12T08:00:00.000Z"): UnmetRequest {
  return {
    requestId: `req_${reason}_${estimatedLostNet ?? "none"}_${at}`,
    at,
    agent: { id: "agent:a", name: "A" },
    client: "ChatGPT",
    reason,
    reasonText: reason,
    ...(estimatedLostNet === undefined ? {} : { estimatedLostNet }),
  };
}

const INPUT: FlowInput = {
  requests: 31,
  ordered: 24,
  alternatives: 4,
  unmet: [unmet("cutoff_passed", 600), unmet("cutoff_passed", 303), unmet("cutoff_passed", 128.55), unmet("not_found"), unmet("not_found"), unmet("not_found")],
  orders: ORDERS,
  week: { orders: 24, confirmed: 19, confirmedNet: 4205.06 },
};

const node = (model: ReturnType<typeof demandFlow>, id: string) => model.nodes.find((item) => item.id === id);

describe("demand flow", () => {
  it("splits requests into served in full, served with an alternative and unserved by reason", () => {
    const model = demandFlow(INPUT);
    expect(model.requests).toBe(31);
    expect(model.served).toBe(25);
    expect(node(model, "in_full")?.count).toBe(21);
    expect(node(model, "alternative")?.count).toBe(4);
    expect(node(model, "cutoff_passed")).toMatchObject({ count: 3, net: 1031.55 });
    expect(node(model, "not_found")).toMatchObject({ count: 3, unpriced: 3 });
    expect(node(model, "not_found")?.net).toBeUndefined();
    expect(node(model, "short_stock")).toBeUndefined();
  });

  it("splits served requests into those that led to an order and those that did not", () => {
    const model = demandFlow(INPUT);
    expect(node(model, "ordered")?.count).toBe(24);
    expect(node(model, "no_order")?.count).toBe(1);
  });

  it("counts orders by outcome, folds rejected into stopped and shares the ordered band by proportion", () => {
    const model = demandFlow({ ...INPUT, ordered: 12 });
    expect(model.orders).toBe(24);
    expect(node(model, "stopped")).toMatchObject({ count: 4, net: 767.44, detail: "3 blocked by the buyer's rules · 1 rejected by a person" });
    expect(node(model, "confirmed_auto")?.weight).toBeCloseTo(6);
    const weights = model.nodes.filter((item) => item.stage === 3).reduce((sum, item) => sum + item.weight, 0);
    expect(weights).toBeCloseTo(12);
    expect(model.note).toBe("12 requests led to 24 orders: one request can lead to several, so the last column shows each outcome's share of orders.");
    expect(demandFlow(INPUT).note).toBe("24 requests led to 24 orders.");
  });

  it("shows orders refused as invalid apart from the buyer's own stops", () => {
    const model = demandFlow({ ...INPUT, orders: { ...ORDERS, refused: tally(2, 100) }, week: { ...INPUT.week, orders: 26 } });
    expect(node(model, "refused")).toMatchObject({ label: "Refused", count: 2, net: 100, tone: "refused" });
    expect(model.orders).toBe(26);
    expect(node(demandFlow(INPUT), "refused")).toBeUndefined();
  });

  it("uses only the window's own totals when the all-time split does not match the window", () => {
    const model = demandFlow({ ...INPUT, week: { orders: 20, confirmed: 15, confirmedNet: 3000 } });
    expect(model.orders).toBe(20);
    expect(model.nodes.filter((item) => item.stage === 3).map((item) => [item.id, item.count, item.net])).toEqual([
      ["confirmed", 15, 3000],
      ["not_confirmed", 5, undefined],
    ]);
    expect(node(model, "confirmed_auto")).toBeUndefined();
  });

  it("never lets a stage hold more than the one before it", () => {
    const model = demandFlow({ ...INPUT, requests: 5, ordered: 40, alternatives: 9 });
    expect(model.served).toBe(0);
    expect(node(model, "ordered")).toBeUndefined();
    expect(node(model, "cutoff_passed")?.count).toBe(3);
    expect(node(model, "not_found")?.count).toBe(2);
    expect(model.note).toBeUndefined();
  });

  it("keeps served requests as one node when the alternative split is unknown", () => {
    const model = demandFlow({ ...INPUT, alternatives: undefined });
    expect(node(model, "in_full")).toMatchObject({ label: "Signed offer", count: 25 });
    expect(node(model, "alternative")).toBeUndefined();
  });

  it("links every node to the stage before it", () => {
    const model = demandFlow(INPUT);
    expect(model.links.filter((link) => link.source === "requests").map((link) => link.target)).toEqual(["in_full", "alternative", "cutoff_passed", "not_found"]);
    expect(model.links.filter((link) => link.source === "served").map((link) => link.target)).toEqual(["ordered", "no_order"]);
    expect(model.links.filter((link) => link.source === "ordered")).toHaveLength(4);
  });

  it("writes figures and tooltip lines without inventing euros", () => {
    const model = demandFlow(INPUT);
    expect(nodeFigure(node(model, "confirmed_auto")!)).toBe("12 · €2,057.90");
    expect(nodeFigure(node(model, "cutoff_passed")!)).toBe("3 · €1,031.55 est.");
    expect(nodeFigure(node(model, "not_found")!)).toBe("3 · no price");
    expect(nodeFigure(node(model, "in_full")!)).toBe("21");
    expect(nodeLines(node(model, "no_order")!, model)).toEqual(["1 request of 25 served"]);
    expect(nodeLines(node(model, "not_found")!, model)).toEqual(["3 requests of 31", "3 requests without a price"]);
    expect(nodeLines(node(model, "waiting")!, model)).toEqual(["1 order of 24", "€909.00 net", "A person at the buyer decides"]);
    expect(flowSummary(model)).toBe("31 requests: 25 served with a signed offer, 6 could not be served; 24 led to 24 orders.");
    expect(flowSummary(demandFlow({ ...INPUT, requests: 0, unmet: [] }))).toBe("No requests yet.");
  });

  it("gives the phone three stacked rows", () => {
    const rows = flowRows(demandFlow(INPUT));
    expect(rows.map((row) => [row.label, row.total, row.parts.length])).toEqual([
      ["Requests", "31", 4],
      ["Served", "25", 2],
      ["Orders", "24", 4],
    ]);
  });
});

describe("alternatives from activity", () => {
  const quote = (id: string, at: string, detail: string, run?: string): Activity => ({
    id,
    at,
    agent: { id: "agent:a", name: "A" },
    kind: "tool",
    tool: "request_quote",
    title: "Asked for a quote",
    detail,
    status: "ok",
    ...(run ? { run: { id: run, title: "t" } } : {}),
  });
  const week = [{ date: "2026-11-13" }, { date: "2026-11-14" }];

  it("counts one request per run whose quote offered alternatives, inside the window", () => {
    const activity = [
      quote("a", "2026-11-13T08:00:00.000Z", "Partial offer, 131.07 EUR net, 3 alternatives", "run_1"),
      quote("b", "2026-11-13T08:01:00.000Z", "Partial offer, 131.07 EUR net, 1 alternative", "run_1"),
      quote("c", "2026-11-14T08:00:00.000Z", "Partial offer, 272.69 EUR net, 2 alternatives"),
      quote("d", "2026-11-14T08:00:00.000Z", "Full offer, 404.00 EUR net"),
      quote("e", "2026-11-10T08:00:00.000Z", "Partial offer, 1.00 EUR net, 3 alternatives"),
      quote("f", "2026-11-14T08:00:00.000Z", "Partial offer, 0 alternatives"),
    ];
    expect(alternativeRequests(activity, week)).toBe(2);
  });
});

describe("flow layout", () => {
  const box = { width: 600, height: 300, node: 10, gap: 10, labelRoom: 170 };

  it("places four columns, the last one leaving room for its labels", () => {
    const layout = layoutFlow(demandFlow(INPUT), box);
    expect(layout.columns).toEqual([0, 140, 280, 420]);
    expect(layoutFlow(demandFlow(INPUT), { ...box, spans: [1, 2, 1] }).columns).toEqual([0, 105, 315, 420]);
  });

  it("scales stage one to the full height: served block on top, unserved below with gaps", () => {
    const layout = layoutFlow(demandFlow(INPUT), box);
    expect(layout.scale).toBeCloseTo(280 / 31);
    const at = (id: string) => layout.nodes.find((item) => item.id === id)!;
    expect(at("in_full").y).toBe(0);
    expect(at("alternative").y).toBeCloseTo(21 * layout.scale);
    expect(at("cutoff_passed").y).toBeCloseTo(25 * layout.scale + 10);
    expect(at("not_found").y + at("not_found").h).toBeCloseTo(300);
    expect(at("requests").y).toBe(10);
    expect(at("requests").h).toBeCloseTo(280);
  });

  it("starts the outcome bars at the ordered bar and runs links from each source without overlap", () => {
    const layout = layoutFlow(demandFlow(INPUT), box);
    const at = (id: string) => layout.nodes.find((item) => item.id === id)!;
    expect(at("confirmed_auto").y).toBe(at("ordered").y);
    const fromRequests = layout.links.filter((link) => link.source === "requests");
    for (let i = 1; i < fromRequests.length; i += 1) {
      expect(fromRequests[i].y0 - fromRequests[i].width / 2).toBeCloseTo(fromRequests[i - 1].y0 + fromRequests[i - 1].width / 2);
    }
    expect(fromRequests[0].path).toMatch(/^M10,/);
  });
});

describe("label spreading", () => {
  it("pushes labels apart and keeps them inside the box", () => {
    expect(spreadLabels([10, 12, 100], 30, 0, 300)).toEqual([15, 45, 100]);
    expect(spreadLabels([280, 290, 295], 30, 0, 300)).toEqual([225, 255, 285]);
    expect(spreadLabels([], 30, 0, 300)).toEqual([]);
  });
});
