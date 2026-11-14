import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/contracts";
import { IDLE_CAPTION, RULES_TOTAL, orbStateFor, orderDigits } from "@/lib/console/orb-state";
import type { Activity, ConsoleSnapshot } from "@/lib/console/types";
import { blockedOrder, pendingOrder } from "./fixtures";

const NOW = Date.parse("2026-11-14T07:00:02.000Z");
const AGENT = { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };

function snapshot(patch: Partial<ConsoleSnapshot> = {}): ConsoleSnapshot {
  return { ready: true, online: true, activity: [], orders: [], audit: [], chain: { state: "empty" }, ...patch };
}

function note(id: string, at: string, title: string): Activity {
  return { id, at, agent: AGENT, kind: "note", title, status: "ok" };
}

function confirmed(): Order {
  const order = pendingOrder({ id: "ord_3", status: "confirmed", updatedAt: "2026-11-14T07:00:01.000Z" });
  order.decision = { outcome: "auto_approved", checks: order.decision.checks.map((check) => ({ ...check, status: "pass" })) };
  return order;
}

describe("orbStateFor", () => {
  it("is idle with the whole mandate in force when nothing has happened", () => {
    const view = orbStateFor(snapshot(), NOW);
    expect(view).toMatchObject({ state: "idle", caption: IDLE_CAPTION, rulesPassed: RULES_TOTAL, rulesTotal: RULES_TOTAL });
  });

  it("draws an idle orb from the audit head hash", () => {
    const view = orbStateFor(snapshot({ chain: { state: "verified", entries: 3, head: "sha256:7c41e2" } }), NOW);
    expect(view.digits).toBe("7c41e2");
  });

  it("thinks with the run's newest step while a run is running", () => {
    const view = orbStateFor(
      snapshot({
        run: { id: "run_1", status: "running", request: "1,000 l milk" },
        activity: [note("a1", "2026-11-14T06:59:58.000Z", "Looking for 1000 L lactose-free milk by 2026-11-16.")],
      }),
      NOW,
    );
    expect(view.state).toBe("thinking");
    expect(view.caption).toBe("Looking for 1000 l lactose-free milk by Mon 16 Nov.");
    expect(view.rulesPassed).toBe(0);
  });

  it("acts right after a tool call", () => {
    const tool: Activity = { id: "t1", at: "2026-11-14T07:00:01.500Z", agent: AGENT, kind: "tool", tool: "search_catalog", title: "Searched", status: "ok" };
    const view = orbStateFor(snapshot({ run: { id: "run_1", status: "running", request: "milk" }, activity: [note("a1", "2026-11-14T07:00:01.000Z", "Looking for milk."), tool] }), NOW);
    expect(view.state).toBe("acting");
  });

  it("waits for the approver with the reason in one line", () => {
    const order = pendingOrder({ updatedAt: "2026-11-14T06:00:00.000Z" });
    const view = orbStateFor(snapshot({ orders: [order] }), NOW);
    expect(view.state).toBe("approval");
    expect(view.caption).toBe("Waiting for a person. €318.00 over the €1,500.00 per-order limit.");
    expect(view.rulesPassed).toBe(2);
    expect(view.rulesTotal).toBe(3);
    expect(view.digits).toBe(orderDigits(order));
  });

  it("shows a just-blocked order as blocked, then lets it go", () => {
    const order = { ...blockedOrder(), updatedAt: "2026-11-14T07:00:01.000Z" };
    expect(orbStateFor(snapshot({ orders: [order] }), NOW)).toMatchObject({ state: "blocked", caption: "Blocked. Contains nuts. The mandate forbids nuts." });
    expect(orbStateFor(snapshot({ orders: [order] }), NOW + 10_000).state).toBe("idle");
  });

  it("shows a just-confirmed order as signed for a few seconds", () => {
    const view = orbStateFor(snapshot({ orders: [confirmed()] }), NOW);
    expect(view.state).toBe("signed");
    expect(view.caption).toBe("Signed and confirmed. €1,818.00 net, arrives Mon 16 Nov.");
    expect(view.rulesPassed).toBe(view.rulesTotal);
  });

  it("reads the order's product codes and net total as its digits", () => {
    expect(orderDigits(pendingOrder())).toBe("464306181800");
  });
});
