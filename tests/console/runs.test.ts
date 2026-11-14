import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/console/types";
import { runOutcome, runTitle, toolLine } from "@/lib/console/format/run-view";
import { buildRuns } from "@/lib/console/runs";
import { blockedOrder, pendingOrder } from "./fixtures";

const AGENT = { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };
let clock = Date.parse("2026-11-14T07:00:00.000Z");
let counter = 0;

function note(title: string, status: Activity["status"] = "ok"): Activity {
  clock += 1000;
  counter += 1;
  return { id: `n${counter}`, at: new Date(clock).toISOString(), agent: AGENT, kind: "note", title, status };
}

function tool(name: string, title: string, extra: Partial<Activity> = {}): Activity {
  clock += 500;
  counter += 1;
  return { id: `t${counter}`, at: new Date(clock).toISOString(), agent: AGENT, kind: "tool", tool: name, title, status: "ok", ...extra };
}

describe("runs", () => {
  it("groups tagged activity exactly by run id and titles it with the buyer's words", () => {
    const first = { id: "run_a", title: "1,600 litres of lactose-free milk by Monday" };
    const second = { id: "run_b", title: "200 litres of Arla lactose-free UHT milk by Monday" };
    const activity = [
      { ...note("Looking for lactose-free milk, 1,600 litres, by Mon 16 Nov."), run: first },
      { ...tool("place_order", "Placed an order", { refs: { orderId: "ord_1" }, status: "waiting" }), run: first },
      { ...note("Looking for Arla lactose-free UHT milk, 200 litres, by Mon 16 Nov."), run: second },
      { ...tool("request_quote", "Asked for a quote"), run: second },
      { ...note("Arla Milkdrink 1L lactose free fat free UHT: only 51 in stock."), run: second },
      { ...note("Looking for something else, 5 litres, by Mon 16 Nov."), run: second },
      note("Looking for butter, 5 kg, by Mon 16 Nov."),
    ];
    const runs = buildRuns(activity, []);
    expect(runs.map((run) => run.runId)).toEqual([undefined, "run_b", "run_a"]);
    expect(runs[1].steps).toHaveLength(3);
    const ctx = { orders: new Map(), active: false };
    expect(runTitle(runs[1], ctx)).toBe("200 litres of Arla lactose-free UHT milk by Monday");
    expect(runTitle(runs[2], ctx)).toBe("1,600 litres of lactose-free milk by Monday");
  });

  it("groups each request into one block, newest first, steps oldest first", () => {
    const activity = [
      note("Harbour purchasing agent connected"),
      note("Looking for lactose-free milk, 1,000 l, by Mon 16 Nov."),
      tool("search_catalog", "Searched the catalogue", { detail: "10 products", durationMs: 4 }),
      note("Offer signed by Valio Aimo."),
      tool("place_order", "Placed an order", { refs: { orderId: "ord_1" }, status: "waiting" }),
      note("Purchase 2 of 2: a product with only 51 in stock."),
      note("Looking for product 462775, 200 units, by Mon 16 Nov."),
      tool("request_quote", "Asked for a quote"),
    ];
    const runs = buildRuns(activity, [pendingOrder()]);
    expect(runs).toHaveLength(2);
    expect(runs[1].steps.map((step) => step.text)).toEqual(["Looking for lactose-free milk, 1,000 l, by Mon 16 Nov.", "Offer signed by Valio Aimo."]);
    expect(runs[1].steps[0].tools.map((item) => item.tool)).toEqual(["search_catalog"]);
    expect(runs[1].orderIds).toEqual(["ord_1"]);
    expect(runs[0].label).toBe("a product with only 51 in stock.");
    expect(runs[0].lookingFor).toBe("product 462775, 200 units, by Mon 16 Nov");
  });

  it("titles a run with the buyer's words and states one outcome", () => {
    const [run] = buildRuns([note("Looking for milk."), tool("place_order", "Placed", { refs: { orderId: "ord_1" } })], [pendingOrder()]);
    const ctx = { orders: new Map([["ord_1", pendingOrder()]]), active: false, approver: "Maria Lind, Head of Purchasing" };
    expect(runTitle(run, ctx)).toBe("1,800 l lactose-free milk");
    expect(runOutcome(run, ctx)).toEqual({ word: "Waiting for Maria Lind", detail: "€1,818.00 net", tone: "waiting" });
    const confirmed = pendingOrder({ status: "confirmed" });
    expect(runOutcome(run, { ...ctx, orders: new Map([["ord_1", confirmed]]) }).detail).toBe("€1,818.00 net · Mon 16 Nov");
  });

  it("reads scene 3 as four attempts and the rule that stopped each", () => {
    const activity = [
      note("Attempt 1 of 4: ordering a product that contains nuts."),
      tool("place_order", "Placed an order", { refs: { orderId: "ord_2" }, status: "blocked" }),
      note("Stopped. Hazelnut spread contains nuts.", "blocked"),
      note("Attempt 2 of 4: Trying to change the price in the signed offer."),
      note("Stopped. The signature no longer matches.", "blocked"),
      note("2 of 4 attempts to break the mandate were stopped.", "error"),
    ];
    const [run] = buildRuns(activity, [blockedOrder()]);
    expect(run.kind).toBe("attempts");
    expect(run.attempts).toMatchObject([
      { n: 1, stopped: true, rule: "Never-buy allergens", reason: "Hazelnut spread contains nuts." },
      { n: 2, stopped: true, reason: "The signature no longer matches." },
    ]);
    expect(runOutcome(run, { orders: new Map(), active: false })).toMatchObject({ word: "Got through", detail: "2 of 4 attempts stopped" });
  });

  it("starts a new block after a long pause", () => {
    const first = note("Looking for milk.");
    clock += 120_000;
    expect(buildRuns([first, tool("search_catalog", "Searched")])).toHaveLength(2);
  });

  it("writes a tool call as one small line", () => {
    expect(toolLine({ tool: "search_catalog", title: "Searched", detail: "Full offer, 1,010.00 EUR net", durationMs: 4 })).toBe(
      "search_catalog · Full offer, €1,010.00 net · 4 ms",
    );
  });
});

describe("late decisions", () => {
  it("files a person's decision under the run that placed the order", () => {
    const activity = [
      note("Looking for milk."),
      tool("place_order", "Placed", { refs: { orderId: "ord_1" }, status: "waiting" }),
      note("Looking for cream."),
      note("Maria Lind approved the order for milk", "ok"),
    ];
    activity[3].refs = { orderId: "ord_1" };
    const runs = buildRuns(activity);
    expect(runs[1].steps.map((step) => step.text)).toContain("Maria Lind approved the order for milk");
    expect(runs[0].steps.map((step) => step.text)).toEqual(["Looking for cream."]);
  });
});

describe("same-millisecond notes", () => {
  it("keeps the order the server appended them in", () => {
    const at = "2026-11-14T09:00:00.000Z";
    const label: Activity = { id: "z9", at, agent: AGENT, kind: "note", title: "Purchase 2 of 2: a product with only 51 in stock.", status: "ok" };
    const looking: Activity = { id: "a1", at, agent: AGENT, kind: "note", title: "Looking for product 462775, 200 units, by Mon 16 Nov.", status: "ok" };
    const runs = buildRuns([label, looking]);
    expect(runs).toHaveLength(1);
    expect(runs[0].steps.map((step) => step.text)).toEqual([looking.title]);
  });
});
