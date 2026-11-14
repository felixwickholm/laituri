import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/contracts";
import { CHECK_MS, IDLE_CAPTION, RULES_TOTAL, SUSPENDED_CAPTION, orbStateFor, orderDigits } from "@/lib/console/orb-state";
import type { AuditEntry } from "@/lib/contracts";
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
    expect(view.caption).toBe("Waiting for the purchasing manager: €318.00 over the limit.");
    expect(view.rulesPassed).toBe(2);
    expect(view.rulesTotal).toBe(3);
    expect(view.digits).toBe(orderDigits(order));
  });

  it("shows a just-blocked order as blocked after its check, then lets it go", () => {
    const order = { ...blockedOrder(), updatedAt: "2026-11-14T07:00:01.000Z" };
    expect(orbStateFor(snapshot({ orders: [order] }), NOW + CHECK_MS)).toMatchObject({ state: "blocked", caption: "Blocked. Contains nuts. Your limits forbid nuts." });
    expect(orbStateFor(snapshot({ orders: [order] }), NOW + 10_000).state).toBe("idle");
  });

  it("replays a just-decided order's checks rule by rule first", () => {
    const order = confirmed();
    const at = Date.parse(order.updatedAt);
    expect(orbStateFor(snapshot({ orders: [order] }), at)).toMatchObject({ state: "thinking", caption: "Checking rule 1 of 3…", rulesPassed: 0 });
    expect(orbStateFor(snapshot({ orders: [order] }), at + CHECK_MS * 0.7)).toMatchObject({ caption: "Checking rule 3 of 3…", rulesPassed: 2 });
  });

  it("is idle with the rules ready, and says so in words", () => {
    expect(IDLE_CAPTION).toBe(`Ready. It checks ${RULES_TOTAL} rules on every order.`);
  });

  it("says the agent is suspended while Valio Aimo's newest word on it is a suspension", () => {
    const entry = (seq: number, event: AuditEntry["event"]): AuditEntry => ({
      seq,
      at: "2026-11-14T06:00:00.000Z",
      actor: { type: "supplier", id: "op", name: "Anna" },
      event,
      summary: "",
      refs: {},
      data: { agentId: AGENT.id },
      prevHash: "",
      hash: "",
      signature: "",
    });
    const mandate = { jws: "", mandate: { agent: AGENT } } as unknown as ConsoleSnapshot["mandate"];
    const suspended = orbStateFor(snapshot({ mandate, audit: [entry(1, "agent.suspended")] }), NOW);
    expect(suspended).toMatchObject({ state: "blocked", caption: SUSPENDED_CAPTION });
    expect(orbStateFor(snapshot({ mandate, audit: [entry(1, "agent.suspended"), entry(2, "agent.resumed")] }), NOW).state).toBe("idle");
  });

  it("shows a just-confirmed order as signed for a few seconds", () => {
    const view = orbStateFor(snapshot({ orders: [confirmed()] }), Date.parse(confirmed().updatedAt) + CHECK_MS);
    expect(view.state).toBe("signed");
    expect(view.caption).toBe("Signed and confirmed. €1,818.00 net, arrives Mon 16 Nov.");
    expect(view.rulesPassed).toBe(view.rulesTotal);
  });

  it("reads the order's product codes and net total as its digits", () => {
    expect(orderDigits(pendingOrder())).toBe("464306181800");
  });
});
