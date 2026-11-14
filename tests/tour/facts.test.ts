import { describe, expect, it } from "vitest";
import type { Check, Order } from "@/lib/contracts";
import type { ConsoleSnapshot } from "@/lib/console/types";
import { CONDITIONS, storyFacts, takenInstead } from "@/lib/tour/facts";
import { STEPS } from "@/lib/tour/steps";

function check(rule: string, status: Check["status"], extra: Partial<Check> = {}): Check {
  return { rule, status, message: `${rule} ${status}`, ...extra } as Check;
}

const PASSES = ["mandate.signature", "offer.signature", "spend.per_week", "dietary.claims"].map((rule) => check(rule, "pass"));

function order(id: string, createdAt: string, overrides: { status?: Order["status"]; checks?: Check[]; substitute?: string; seeded?: true; amount?: number } = {}): Order {
  return {
    id,
    status: overrides.status ?? "confirmed",
    createdAt,
    updatedAt: createdAt,
    seeded: overrides.seeded,
    decision: { checks: overrides.checks ?? [...PASSES, check("spend.per_order", "pass")] },
    offer: {
      totals: { net: { amount: overrides.amount ?? 1010, currency: "EUR" } },
      lines: [
        {
          name: "Valio Eila semi-skimmed milk drink 1 l lactose free",
          substituteFor: overrides.substitute ? { productId: "462775", name: "Arla Milkdrink", reason: overrides.substitute, likeForLike: true, priceChangePct: -5 } : undefined,
        },
      ],
    },
  } as unknown as Order;
}

function snapshot(patch: Partial<ConsoleSnapshot>): ConsoleSnapshot {
  return { ready: true, online: true, activity: [], orders: [], audit: [], chain: { state: "verified", entries: 10 }, ...patch };
}

const overLimitChecks = [...PASSES, check("spend.per_order", "ask", { observed: "1,616.00 EUR", limit: "1,500.00 EUR" })];
const story = [
  order("seeded", "2026-11-10T08:00:00Z", { seeded: true }),
  order("milk", "2026-11-14T08:00:00Z"),
  order("over", "2026-11-14T08:01:00Z", { status: "pending_approval", checks: overLimitChecks, amount: 1616 }),
  order("short", "2026-11-14T08:02:00Z", { substitute: "Only 51 of 200 units of Arla Milkdrink are in stock." }),
];

describe("story facts", () => {
  it("finds each scene's order among the live ones and quotes its figures", () => {
    const facts = storyFacts(snapshot({ orders: story }));
    expect(facts.milk?.id).toBe("milk");
    expect(facts.milkTotal).toBe("€1,010.00");
    expect(facts.milkRulesPassed).toBe(5);
    expect(facts.overLimit?.id).toBe("over");
    expect(facts.overBy).toBe("€116.00");
    expect(facts.limit).toBe("€1,500.00");
    expect(facts.shortStock?.id).toBe("short");
    expect(facts.shortAvailable).toBe(51);
    expect(facts.shortRequested).toBe(200);
    expect(takenInstead(facts.shortStock)).toBeTruthy();
  });

  it("ignores seeded history and falls back to the demo approver", () => {
    const facts = storyFacts(snapshot({ orders: [story[0]] }));
    expect(facts.milk).toBeUndefined();
    expect(facts.approver).toBe("Maria Lind");
    expect(facts.approverFirst).toBe("Maria");
  });

  it("names the broken entry once the log fails", () => {
    expect(storyFacts(snapshot({ chain: { state: "broken", entries: 10, brokenAt: 7, reason: "hash" } })).brokenAt).toBe(7);
  });
});

describe("step conditions", () => {
  const facts = (s: ConsoleSnapshot) => storyFacts(s);

  it("waits for the milk order to be confirmed and the run to end", () => {
    const pending = snapshot({ orders: [order("milk", "2026-11-14T08:00:00Z", { status: "pending_approval" })] });
    expect(CONDITIONS.milkConfirmed(pending, facts(pending))).toBe(false);
    const running = snapshot({ orders: [story[1]], run: { id: "r", status: "running", request: "" } });
    expect(CONDITIONS.milkConfirmed(running, facts(running))).toBe(true);
    expect(CONDITIONS.milkShown(running, facts(running))).toBe(false);
    const done = { ...running, run: { id: "r", status: "done" as const, request: "" } };
    expect(CONDITIONS.milkShown(done, facts(done))).toBe(true);
  });

  it("sees the over-limit order waiting, then decided", () => {
    const waiting = snapshot({ orders: story });
    expect(CONDITIONS.overLimitWaiting(waiting, facts(waiting))).toBe(true);
    expect(CONDITIONS.overLimitDecided(waiting, facts(waiting))).toBe(false);
    const approved = snapshot({ orders: story.map((item) => (item.id === "over" ? { ...item, status: "confirmed" as const } : item)) });
    expect(CONDITIONS.overLimitDecided(approved, facts(approved))).toBe(true);
  });

  it("counts only live activity as the agent working, and a broken chain as the log step's outcome", () => {
    const seeded = snapshot({ activity: [{ id: "1", at: "", agent: { id: "a", name: "A" }, kind: "note", title: "x", status: "ok", seeded: true }] });
    expect(CONDITIONS.agentWorking(seeded, facts(seeded))).toBe(false);
    const broken = snapshot({ chain: { state: "broken", entries: 3, brokenAt: 2, reason: "hash" } });
    expect(CONDITIONS.logBroken(broken, facts(broken))).toBe(true);
  });
});

describe("step sentences", () => {
  it("read with and without facts, and quote the live figures when they exist", () => {
    const empty = storyFacts(snapshot({}));
    const full = storyFacts(snapshot({ orders: story, chain: { state: "broken", entries: 10, brokenAt: 7, reason: "hash" } }));
    for (const step of STEPS) {
      expect(step.copy(empty).title.length).toBeGreaterThan(20);
      expect(step.copy(full).title.length).toBeGreaterThan(20);
    }
    const byId = Object.fromEntries(STEPS.map((step) => [step.id, step]));
    expect(byId.offer.copy(full).title).toContain("€1,010.00");
    expect(byId.phone.copy(full).title).toContain("€116.00 over the limit");
    expect(byId.stock.copy(full).title).toContain("only 51 of the 200");
    expect(byId.log.copy(full).detail).toContain("entry 7");
  });
});
