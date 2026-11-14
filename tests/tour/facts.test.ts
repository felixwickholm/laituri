import { describe, expect, it } from "vitest";
import { RuleId, type Check, type Order } from "@/lib/contracts";
import type { ConsoleSnapshot } from "@/lib/console/types";
import type { Activity } from "@/lib/console/types";
import { CONDITIONS, storyFacts } from "@/lib/tour/facts";
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
          availability: { status: "available", requested: 200, deliveryDate: "2026-11-16" },
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
  });

  it("counts the rules from the contract, then from the order's own checks, never a typed number", () => {
    expect(storyFacts(snapshot({})).rulesTotal).toBe(RuleId.options.length);
    const seventeen = Array.from({ length: 17 }, (_, n) => check(`rule.${n}`, "pass"));
    const facts = storyFacts(snapshot({ orders: [order("milk", "2026-11-14T08:00:00Z", { checks: seventeen })] }));
    expect(facts).toMatchObject({ rulesTotal: 17, milkRulesPassed: 17 });
    expect(STEPS.find((step) => step.id === "rules")?.copy(facts, true).title).toBe("All 17 of Maria’s rules passed, so the agent ordered on its own.");
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

  it("counts only a live quote as the milk priced, and a broken chain as the log step's outcome", () => {
    const quote = { id: "1", at: "", agent: { id: "a", name: "A" }, kind: "tool" as const, tool: "request_quote", title: "Asked for a quote", detail: "Full offer, 1,010.00 EUR net", status: "ok" as const };
    expect(facts(snapshot({ activity: [{ ...quote, seeded: true }] })).milkQuoted).toBe(false);
    expect(facts(snapshot({ activity: [quote] }))).toMatchObject({ milkQuoted: true, milkTotal: "€1,010.00" });
    expect(facts(snapshot({ orders: [story[1]] })).milkQuoted).toBe(true);
    const broken = snapshot({ chain: { state: "broken", entries: 3, brokenAt: 2, reason: "hash" } });
    expect(CONDITIONS.logBroken(broken, facts(broken))).toBe(true);
  });
});

function note(n: number, title: string, status: Activity["status"] = "ok"): Activity {
  return { id: `act_${n}`, at: `2026-11-14T09:00:${String(n).padStart(2, "0")}Z`, agent: { id: "a", name: "Agent" }, kind: "note", title, status };
}

/** The cheating scene's notes up to `refused` refusals, the next attempt still running. */
function attempts(refused: number): Activity[] {
  const notes: Activity[] = [];
  for (let n = 1; n <= Math.min(refused + 1, 5); n++) {
    notes.push(note(n * 2, `Attempt ${n} of 5: trying something.`));
    if (n <= refused) notes.push(note(n * 2 + 1, "Stopped. A rule held.", "blocked"));
  }
  return notes;
}

describe("the cheating scene", () => {
  it("counts the refused attempts in the newest live block, ignoring seeded history", () => {
    const seeded = attempts(5).map((item) => ({ ...item, id: `old_${item.id}`, at: item.at.replace("2026-11-14", "2026-11-10"), seeded: true as const }));
    expect(storyFacts(snapshot({ activity: seeded }))).toMatchObject({ attempts: 0, refused: 0 });
    const two = storyFacts(snapshot({ activity: [...seeded, ...attempts(2)] }));
    expect(two).toMatchObject({ attempts: 3, refused: 2 });
  });

  it("waits for four refusals on screen before the step's outcome is in", () => {
    const three = snapshot({ activity: attempts(3) });
    expect(CONDITIONS.rulesRefused(three, storyFacts(three))).toBe(false);
    const four = snapshot({ activity: attempts(4) });
    expect(CONDITIONS.rulesRefused(four, storyFacts(four))).toBe(true);
  });
});

describe("step sentences", () => {
  const byId = Object.fromEntries(STEPS.map((step) => [step.id, step]));
  const copy = (id: string, s: ConsoleSnapshot, shown = true) => byId[id].copy(storyFacts(s), shown);

  it("read with and without facts", () => {
    const empty = storyFacts(snapshot({}));
    const full = storyFacts(snapshot({ orders: story, activity: attempts(4), chain: { state: "broken", entries: 10, brokenAt: 7, reason: "hash" } }));
    for (const step of STEPS) {
      for (const shown of [false, true]) {
        expect(step.copy(empty, shown).title.length).toBeGreaterThan(20);
        expect(step.copy(full, shown).title.length).toBeGreaterThan(20);
        expect(`${step.copy(full, shown).title} ${step.copy(full, shown).detail ?? ""}`).not.toMatch(/\u2014/);
      }
    }
  });

  it("step 2 never runs ahead: searching, then the signed price being checked, then confirmed", () => {
    expect(copy("offer", snapshot({})).title).toContain("asks for a price");
    const quote: Activity = { id: "q", at: "2026-11-14T08:00:00Z", agent: { id: "a", name: "A" }, kind: "tool", tool: "request_quote", title: "Asked for a quote", detail: "Full offer, 1,010.00 EUR net", status: "ok" };
    const quoted = copy("offer", snapshot({ activity: [quote] }));
    expect(quoted.title).toContain("€1,010.00");
    expect(quoted.detail).toContain("now checks");
    expect(quoted.detail).not.toContain("confirmed");
    const confirmed = copy("offer", snapshot({ orders: [story[1]] }));
    expect(confirmed.detail).toContain("confirmed");
    expect(confirmed.detail).not.toContain("now checks");
  });

  it("step 3 says the rules passed only once the order is confirmed", () => {
    expect(copy("rules", snapshot({})).title).not.toContain("passed");
    expect(copy("rules", snapshot({ orders: [story[1]] })).title).toBe("All 5 of Maria’s rules passed, so the agent ordered on its own.");
  });

  it("step 4 quotes the limit only once the order waits on the phone", () => {
    expect(copy("phone", snapshot({})).title).not.toContain("over the");
    expect(copy("phone", snapshot({ orders: story })).title).toContain("€116.00 over the €1,500.00 limit");
  });

  it("step 4 after the press says what the approval led to, a stopped approval included", () => {
    const phone = byId.phone;
    const withStatus = (status: Order["status"]) => storyFacts(snapshot({ orders: story.map((item) => (item.id === "over" ? { ...item, status } : item)) }));
    expect(phone.pressAction?.copy(withStatus("confirmed")).title).toContain("approved it on her phone");
    expect(phone.pressAction?.copy(withStatus("blocked")).title).toContain("stock ran short");
    expect(phone.pressAction?.copy(withStatus("rejected")).title).toContain("rejected it");
    expect(phone.pressAction?.copy(withStatus("pending_approval")).title).toContain("still waiting");
  });

  it("step 5 reads the shortfall and the reason for the alternative from the signed order", () => {
    expect(copy("stock", snapshot({})).detail).toBeUndefined();
    const full = copy("stock", snapshot({ orders: story }));
    expect(full.title).toContain("only 51 of the 200");
    expect(full.detail).toMatch(/^The signed alternative, .* in full on Monday\./);
    const other = order("short", "2026-11-14T08:02:00Z", { substitute: "Out of stock until Friday." });
    expect(copy("stock", snapshot({ orders: [other] })).title).toBe("Short stock. Out of stock until Friday.");
  });

  it("step 7 states the four refusals only when all four are on screen", () => {
    expect(copy("cheat", snapshot({ activity: attempts(0) })).title).not.toContain("Four");
    expect(copy("cheat", snapshot({ activity: attempts(2) })).detail).toBe("Refused so far: 2 of 3.");
    expect(copy("cheat", snapshot({ activity: attempts(4) })).title).toBe("Four attempts to break the rules. Each one was refused, and each refusal is signed.");
  });

  it("step 8 names the changed entry and the business consequence only once the log fails", () => {
    expect(copy("log", snapshot({})).detail).not.toContain("paused");
    const notYetShown = copy("log", snapshot({ chain: { state: "broken", entries: 10, brokenAt: 7, reason: "hash" } }), false);
    expect(notYetShown.title).not.toContain("entry 7");
    const broken = copy("log", snapshot({ chain: { state: "broken", entries: 10, brokenAt: 7, reason: "hash" } }));
    expect(broken.title).toContain("entry 7");
    expect(broken.detail).toContain("Approvals stay paused until the log is restored from the last signed checkpoint.");
    expect(broken.detail).toContain("If a customer disputes an order, both sides check the same record in seconds.");
  });
});
