import { describe, expect, it } from "vitest";
import type { AuditEntry, UnmetRequest } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";
import {
  ago,
  buyersOf,
  callTime,
  conceptLabel,
  exportName,
  filterAudit,
  isActiveAgent,
  kitchenOutcomes,
  orderBars,
  liveCalls,
  mainReason,
  overviewVerdict,
  percent,
  plainSummary,
  quantityText,
  reasonTotals,
  ruleTitle,
  recentAsks,
  runSentence,
  seconds,
  statusWord,
  unmetInWeek,
  unmetNet,
  weekFigures,
  weekday,
} from "@/lib/supplier-console/format";
import { KEYLESS_AGENT_ID } from "@/lib/supplier-console/names";
import type { ControlAgent, ControlOverview } from "@/lib/supplier-console/types";

const HOTEL = { id: "fi:ovt:1", name: "Nordic Harbour Hotels" };
const SCHOOL = { id: "fi:ovt:2", name: "Kaisla School Kitchens" };
const HOTEL_AGENT = { id: "agent:hotel", name: "Harbour purchasing agent" };
const SCHOOL_AGENT = { id: "agent:school", name: "Kaisla menu planner" };

function unmet(reason: UnmetRequest["reason"], at: string, lost?: number): UnmetRequest {
  return {
    requestId: `req_${at}`,
    at,
    buyer: HOTEL,
    agent: HOTEL_AGENT,
    client: "ChatGPT",
    reason,
    reasonText: reason,
    ...(lost === undefined ? {} : { estimatedLostNet: lost }),
  };
}

function agent(overrides: Partial<ControlAgent> = {}): ControlAgent {
  return {
    agent: HOTEL_AGENT,
    buyer: HOTEL,
    clients: ["Claude Code"],
    firstSeen: "2026-11-09T05:00:00.000Z",
    lastSeen: "2026-11-14T06:00:00.000Z",
    calls: 10,
    quotes: 3,
    orders: { confirmed_auto: 2, confirmed_after_approval: 1, waiting: 0, rejected: 0, blocked: 1, refused: 0 },
    confirmedNet: 500,
    status: "active",
    ...overrides,
  };
}

function overview(overrides: Partial<ControlOverview> = {}): ControlOverview {
  const tally = { count: 0, net: 0 };
  return {
    generatedAt: "2026-11-14T07:00:00.000Z",
    includesSeeded: true,
    agents: [agent(), agent({ agent: SCHOOL_AGENT, buyer: SCHOOL, confirmedNet: 200 })],
    demand: { requests: 4, topConcepts: [] },
    unmet: [unmet("cutoff_passed", "2026-11-13T10:00:00.000Z", 600.1), unmet("not_found", "2026-11-12T10:00:00.000Z")],
    offers: { signed: 10, ordered: 6, expiredUnused: 3, open: 1, conversionRate: 0.6, medianSecondsToOrder: 35 },
    orders: {
      total: tally,
      byOutcome: { confirmed_auto: tally, confirmed_after_approval: tally, waiting: tally, rejected: tally, blocked: tally, refused: tally },
    },
    rules: [],
    daily: [
      { date: "2026-11-12", requests: 1, ordered: 0, orders: 0, confirmed: 0, confirmedNet: 0 },
      { date: "2026-11-13", requests: 3, ordered: 2, orders: 3, confirmed: 2, confirmedNet: 100.1 },
      { date: "2026-11-14", requests: 2, ordered: 1, orders: 1, confirmed: 1, confirmedNet: 0.2 },
    ],
    ...overrides,
  };
}

function call(id: string, at: string, overrides: Partial<Activity> = {}): Activity {
  return { id, at, agent: HOTEL_AGENT, buyer: HOTEL, kind: "tool", tool: "search_catalog", title: id, status: "ok", ...overrides };
}

describe("words", () => {
  it("turns concept keys into labels", () => {
    expect(conceptLabel("cooking_cream")).toBe("Cooking cream");
    expect(conceptLabel(undefined)).toBe("Unrecognised product");
  });

  it("writes quantities with separators and units", () => {
    expect(quantityText([{ amount: 4550, unit: "l" }])).toBe("4,550 l");
    expect(quantityText({ amount: 60, unit: "kg" })).toBe("60 kg");
    expect(quantityText(undefined)).toBe("–");
  });

  it("formats rates and durations", () => {
    expect(percent(0.6)).toBe("60%");
    expect(percent(Number.NaN)).toBe("–");
    expect(seconds(35)).toBe("35 s");
    expect(seconds(3900)).toBe("1 h 5 min");
    expect(seconds(undefined)).toBe("–");
  });

  it("says how long ago in words", () => {
    const now = Date.parse("2026-11-14T07:00:00.000Z");
    expect(ago("2026-11-14T06:59:40.000Z", now)).toBe("just now");
    expect(ago("2026-11-14T06:56:00.000Z", now)).toBe("4 min ago");
    expect(ago("2026-11-13T07:00:00.000Z", now)).toBe("yesterday");
    expect(ago(undefined, now)).toBe("–");
  });

  it("names weekdays of calendar dates", () => {
    expect(weekday("2026-11-14")).toBe("Sat");
  });

  it("reads an agent's status", () => {
    expect(statusWord({ status: "suspended" })).toEqual({ word: "Paused", tone: "danger" });
    expect(statusWord({ status: "idle" }).tone).toBe("neutral");
  });

  it("calls a caller without a key read-only, unless it is suspended", () => {
    expect(statusWord({ status: "active", agent: { id: KEYLESS_AGENT_ID } })).toEqual({ word: "Read-only", tone: "neutral" });
    expect(statusWord({ status: "suspended", agent: { id: KEYLESS_AGENT_ID } }).word).toBe("Paused");
    expect(statusWord({ status: "active", agent: HOTEL_AGENT }).word).toBe("Active");
    expect(isActiveAgent({ status: "active", agent: { id: KEYLESS_AGENT_ID, name: "Unidentified agent" } })).toBe(false);
    expect(isActiveAgent({ status: "active", agent: HOTEL_AGENT })).toBe(true);
  });
});

describe("figures", () => {
  it("never shows more requests that led to an order than requests", () => {
    const week = weekFigures(overview().daily);
    expect(week.ordered).toBeLessThanOrEqual(week.requests);
    for (const day of overview().daily) expect(day.ordered).toBeLessThanOrEqual(day.requests);
  });

  it("keeps only the unserved requests inside the week", () => {
    const rows = [unmet("short_stock", "2026-11-14T06:00:00.000Z", 10), unmet("not_found", "2026-11-01T06:00:00.000Z")];
    expect(unmetInWeek(rows, overview().daily).map((item) => item.reason)).toEqual(["short_stock"]);
  });

  it("sums the seven days in whole cents", () => {
    const week = weekFigures(overview().daily);
    expect(week).toMatchObject({ requests: 6, ordered: 3, confirmed: 3, confirmedNet: 100.3, since: "2026-11-12" });
    expect(week.today?.date).toBe("2026-11-14");
  });

  it("totals unserved demand per reason in a fixed order", () => {
    const rows = overview().unmet;
    const totals = reasonTotals(rows);
    expect(totals.map((total) => total.key)).toEqual(["cutoff_passed", "short_stock", "not_found"]);
    expect(totals[0]).toMatchObject({ count: 1, net: 600.1, unpriced: 0 });
    expect(totals[1]).toMatchObject({ count: 0, net: 0 });
    expect(totals[2]).toMatchObject({ count: 1, net: 0, unpriced: 1 });
    expect(unmetNet(rows)).toBe(600.1);
  });

  it("picks the main reason by euros, then by count", () => {
    expect(mainReason(overview().unmet)?.key).toBe("cutoff_passed");
    expect(mainReason([unmet("not_found", "a"), unmet("not_found", "b"), unmet("short_stock", "c")])?.key).toBe("not_found");
    expect(mainReason([])).toBeUndefined();
  });

  it("states the verdict first, then the reason", () => {
    expect(overviewVerdict(overview())).toEqual({
      lead: "2 agents bought €100.30 in the last 7 days.",
      reason: "€600.10 of demand went unserved, mostly because the order cut-off had passed.",
    });
    const quiet = overviewVerdict(overview({ unmet: [], agents: [agent({ status: "suspended" })] }));
    expect(quiet.lead).toBe("1 agent bought €100.30 in the last 7 days.");
    expect(quiet.reason).toBe("Every request was served. 1 agent is paused.");
    expect(overviewVerdict(overview({ agents: [] })).lead).toBe("No agent has connected yet.");
  });
});

describe("calls", () => {
  it("merges every buyer's tool calls, newest first, without repeats or notes", () => {
    const a = call("a", "2026-11-14T06:00:00.000Z");
    const b = call("b", "2026-11-14T06:05:00.000Z", { buyer: SCHOOL });
    const note = call("n", "2026-11-14T06:06:00.000Z", { kind: "note" });
    expect(liveCalls([[a, note], [b, a]], 5).map((item) => item.id)).toEqual(["b", "a"]);
    expect(liveCalls([[a, b]], 1).map((item) => item.id)).toEqual(["b"]);
  });

  it("orders by instant, not by text, and breaks ties by id", () => {
    const late = call("x", "2026-11-14T06:05:00Z");
    const early = call("y", "2026-11-14T06:04:59.999Z");
    const twin = call("z", "2026-11-14T06:05:00.000Z");
    expect(liveCalls([[early, late, twin]], 5).map((item) => item.id)).toEqual(["z", "x", "y"]);
  });

  it("lists an agent's quotes, or its searches when it never quoted", () => {
    const search = call("s", "2026-11-14T06:00:00.000Z");
    const quote = call("q", "2026-11-14T06:01:00.000Z", { tool: "request_quote" });
    const other = call("o", "2026-11-14T06:02:00.000Z", { tool: "request_quote", agent: SCHOOL_AGENT });
    expect(recentAsks([search, quote, other], HOTEL_AGENT.id, 5).map((item) => item.id)).toEqual(["q"]);
    expect(recentAsks([search], HOTEL_AGENT.id, 5).map((item) => item.id)).toEqual(["s"]);
  });

  it("finds the buyers behind the agents once each", () => {
    expect(buyersOf([agent(), agent({ agent: SCHOOL_AGENT }), agent({ agent: SCHOOL_AGENT, buyer: SCHOOL })])).toEqual([HOTEL, SCHOOL]);
  });
});

describe("audit", () => {
  const entry = (seq: number, event: AuditEntry["event"], buyerId?: string): AuditEntry => ({
    seq,
    at: "2026-11-14T06:00:00.000Z",
    actor: { type: "supplier", id: "valio-aimo", name: "Valio Aimo" },
    event,
    summary: "",
    refs: buyerId ? { buyerId } : {},
    data: {},
    prevHash: "",
    hash: "",
    signature: "",
  });

  it("filters by buyer and event group, newest first", () => {
    const entries = [entry(1, "order.confirmed", HOTEL.id), entry(2, "approval.granted", SCHOOL.id), entry(3, "order.blocked", SCHOOL.id)];
    expect(filterAudit(entries, { buyer: "all", group: "all" }).map((item) => item.seq)).toEqual([3, 2, 1]);
    expect(filterAudit(entries, { buyer: SCHOOL.id, group: "all" }).map((item) => item.seq)).toEqual([3, 2]);
    expect(filterAudit(entries, { buyer: SCHOOL.id, group: "orders" }).map((item) => item.seq)).toEqual([3]);
  });

  it("names the export after the day and the buyer", () => {
    expect(exportName("2026-11-14T07:00:00.000Z", "Nordic Harbour Hotels")).toBe("laituri-audit-2026-11-14-nordic-harbour-hotels.json");
    expect(exportName("2026-11-14T07:00:00.000Z", undefined)).toBe("laituri-audit-2026-11-14-all-buyers.json");
  });
});

describe("two kitchens", () => {
  it("names each kitchen from its order, else by the scene's order", () => {
    const outcomes = kitchenOutcomes(
      [
        { status: "confirmed", summary: "Confirmed.", orderId: "ord_1" },
        { status: "blocked", summary: "Blocked: may contain sesame." },
      ],
      (orderId) => (orderId === "ord_1" ? "Nordic Harbour Hotels" : undefined),
    );
    expect(outcomes).toEqual([
      { buyer: "Nordic Harbour Hotels", word: "Confirmed", tone: "success", summary: "Confirmed.", orderId: "ord_1" },
      { buyer: "Kaisla School Kitchens", word: "Stopped by a rule", tone: "danger", summary: "Blocked: may contain sesame.", orderId: undefined },
    ]);
    expect(kitchenOutcomes(undefined, () => undefined)).toEqual([]);
  });

  it("drops the order id from a purchase summary", () => {
    expect(plainSummary("Order ord_kmmldznh45 confirmed: 3 cases of Dafgårds ciabatta 58g = 13.92 kg, €81.65 net, delivery Mon 16 Nov.")).toBe(
      "3 cases of Dafgårds ciabatta 58g = 13.92 kg, €81.65 net, delivery Mon 16 Nov.",
    );
    expect(plainSummary("Order ord_1 was blocked: Dafgårds ciabatta 58g may contain sesame. Nothing was ordered.")).toBe(
      "Dafgårds ciabatta 58g may contain sesame. Nothing was ordered.",
    );
    expect(plainSummary("Order ord_1 is waiting for Maria Lind: 1,600 l, €1,616.00 net. Over my limit.")).toBe("Waiting for Maria Lind: 1,600 l, €1,616.00 net. Over my limit.");
  });

  it("reads the sentence from the first purchase after the run started", () => {
    const run = { id: "run_1", title: "10 kg of ciabatta rolls by Monday" };
    const activity = [
      call("old", "2026-11-14T05:00:00.000Z", { run: { id: "run_0", title: "Earlier" } }),
      call("new", "2026-11-14T06:00:01.000Z", { run }),
    ];
    expect(runSentence(activity, "2026-11-14T06:00:00.000Z")).toBe(run.title);
    expect(runSentence(activity, undefined)).toBeUndefined();
  });
});

describe("call times", () => {
  const now = Date.parse("2026-11-14T10:00:00.000Z");
  it("shows the time today, the weekday this week and the date before that, in Helsinki", () => {
    expect(callTime("2026-11-14T08:15:00.000Z", now)).toBe("10:15");
    expect(callTime("2026-11-13T14:35:00.000Z", now)).toBe("Fri 16:35");
    expect(callTime("2026-11-13T22:30:00.000Z", now)).toBe("00:30");
    expect(callTime("2026-11-02T14:35:00.000Z", now)).toBe("Mon 2\u00a0Nov 16:35");
    expect(callTime("nonsense", now)).toBe("–");
  });
});

describe("rule titles", () => {
  it("names the allergen rule's ask case apart from its block case", () => {
    expect(ruleTitle({ rule: "dietary.allergens", title: "Never-buy allergens", tier: "ask" })).toBe("Allergen data missing");
    expect(ruleTitle({ rule: "dietary.allergens", title: "Never-buy allergens", tier: "block" })).toBe("Never-buy allergens");
    expect(ruleTitle({ rule: "spend.per_order", title: "per order", tier: "ask" })).toBe("Per-order limit");
    expect(ruleTitle({ rule: "request.words", title: "request.words", tier: "ask" })).toBe("Buyer's words sent");
  });
});

describe("order bars", () => {
  it("leaves out outcomes with no order and names the rest plainly", () => {
    const bars = orderBars({ confirmed_auto: 5, confirmed_after_approval: 0, waiting: 1, rejected: 0, blocked: 2, refused: 0 });
    expect(bars.map((bar) => [bar.label, bar.count, bar.tone])).toEqual([
      ["Confirmed alone", 5, "good"],
      ["Waiting for the customer", 1, "warn"],
      ["Blocked by a rule", 2, "lost"],
    ]);
  });
});
