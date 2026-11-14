import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/lib/contracts";
import { agentsInOverview, landingCounts } from "@/components/landing/counts";
import { orderOfRun, spokenRunResult } from "@/lib/console/orb-speech";
import type { DemoRun } from "@/lib/console/types";
import { blockedOrder, pendingOrder } from "./fixtures";

const STARTED = Date.parse("2026-11-14T06:59:00.000Z");
const RUN: DemoRun = { id: "run_1", status: "done", request: "1,800 l milk", summary: "Waiting for approval." };

describe("spokenRunResult", () => {
  it("finds the order the run placed", () => {
    const earlier = pendingOrder({ id: "ord_0", createdAt: "2026-11-14T06:00:00.000Z" });
    expect(orderOfRun([earlier, pendingOrder()], STARTED)?.id).toBe("ord_1");
  });

  it("says why an order waits for a person", () => {
    expect(spokenRunResult(RUN, [pendingOrder()], STARTED)).toBe("This one needs you: order total 1,818.00 EUR is over the 1,500.00 EUR limit.");
  });

  it("says nothing was ordered when a rule blocked it", () => {
    expect(spokenRunResult(RUN, [blockedOrder()], STARTED)).toBe("Nothing was ordered. Hazelnut spread contains nuts.");
  });

  it("falls back to the run's own summary, and admits failure", () => {
    expect(spokenRunResult(RUN, [], STARTED)).toBe("Waiting for approval.");
    expect(spokenRunResult({ ...RUN, status: "failed" }, [], STARTED)).toBe("Something went wrong, so nothing was ordered.");
  });
});

function entry(seq: number, event: AuditEntry["event"], actor: AuditEntry["actor"]): AuditEntry {
  return { seq, at: "2026-11-14T07:00:00.000Z", actor, event, summary: "", refs: {}, data: {}, prevHash: "", hash: "", signature: "" };
}

describe("landingCounts", () => {
  const agent = { type: "agent" as const, id: "agent:a", name: "A" };
  const other = { type: "agent" as const, id: "agent:b", name: "B" };
  const supplier = { type: "supplier" as const, id: "valio", name: "Valio Aimo" };
  const audit = [entry(1, "offer.issued", supplier), entry(2, "order.requested", agent), entry(3, "offer.issued", supplier), entry(4, "catalog.searched", other)];

  it("counts offers, confirmed orders, log steps and agents", () => {
    const confirmed = { ...pendingOrder(), status: "confirmed" as const };
    expect(landingCounts({ orders: [confirmed, pendingOrder()], audit })).toEqual({ signedOffers: 2, ordersConfirmed: 1, logSteps: 4, connectedAgents: 2 });
  });

  it("prefers the supplier overview for connected agents", () => {
    expect(agentsInOverview({ agents: [{}, {}, {}] })).toBe(3);
    expect(agentsInOverview({ connectedAgents: 5 })).toBe(5);
    expect(agentsInOverview("nope")).toBeUndefined();
    expect(landingCounts({ audit, overview: { connectedAgents: 7 } }).connectedAgents).toBe(7);
  });

  it("leaves a figure out when its source did not answer", () => {
    expect(landingCounts({})).toEqual({ signedOffers: undefined, ordersConfirmed: undefined, logSteps: undefined, connectedAgents: undefined });
  });
});
